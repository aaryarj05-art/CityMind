from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Area
from app.services import bigquery_analytics as bq


class FailingBigQueryClient:
    def insert_rows_json(self, *_args, **_kwargs):
        raise RuntimeError("simulated BigQuery outage")


class SuccessfulBigQueryClient:
    def __init__(self):
        self.rows = []

    def insert_rows_json(self, table_name, rows):
        self.rows.append((table_name, rows))
        return []


def test_bigquery_disabled_without_env_does_not_crash(monkeypatch):
    monkeypatch.delenv("CITYMIND_BIGQUERY_ENABLED", raising=False)
    monkeypatch.delenv("CITYMIND_GCP_PROJECT_ID", raising=False)
    monkeypatch.delenv("CITYMIND_BIGQUERY_DATASET", raising=False)
    bq.reset_bigquery_client_cache()

    assert bq.bigquery_enabled() is False
    assert bq.get_bigquery_client() is None
    assert bq.safe_insert_rows("incident_events", [{"event_id": "test"}]) is False

    status = bq.bigquery_status()
    assert status["status"] == "disabled"
    assert status["project_id"] == "citymind-apac"
    assert status["dataset"] == "citymind_analytics"


def test_status_endpoint_reports_disabled(monkeypatch):
    monkeypatch.delenv("CITYMIND_BIGQUERY_ENABLED", raising=False)
    bq.reset_bigquery_client_cache()

    with TestClient(app) as client:
        response = client.get("/api/analytics/bigquery/status")

    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False
    assert data["status"] == "disabled"
    assert "incident_events" in data["tables_expected"]


def test_status_endpoint_reports_configured(monkeypatch):
    monkeypatch.setenv("CITYMIND_BIGQUERY_ENABLED", "true")
    monkeypatch.setenv("CITYMIND_GCP_PROJECT_ID", "citymind-apac")
    monkeypatch.setenv("CITYMIND_BIGQUERY_DATASET", "citymind_analytics")
    monkeypatch.setattr(bq, "get_bigquery_client", lambda: object())

    with TestClient(app) as client:
        response = client.get("/api/analytics/bigquery/status")

    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is True
    assert data["status"] == "configured"
    assert data["project_id"] == "citymind-apac"
    assert data["dataset"] == "citymind_analytics"


def test_safe_insert_rows_returns_false_when_export_fails(monkeypatch):
    monkeypatch.setenv("CITYMIND_BIGQUERY_ENABLED", "true")
    monkeypatch.setattr(bq, "get_bigquery_client", lambda: FailingBigQueryClient())
    monkeypatch.setattr(bq, "ensure_dataset_exists", lambda: True)

    assert bq.safe_insert_rows("incident_events", [{"event_id": "test"}]) is False


def test_export_failure_does_not_fail_incident_create(monkeypatch):
    monkeypatch.setenv("CITYMIND_BIGQUERY_ENABLED", "true")
    monkeypatch.setattr(bq, "get_bigquery_client", lambda: FailingBigQueryClient())
    monkeypatch.setattr(bq, "ensure_dataset_exists", lambda: True)

    db = SessionLocal()
    area = db.query(Area).first()
    db.close()
    payload = {
        "title": "BigQuery outage smoke test",
        "description": "API should complete even when analytics export fails",
        "category": "Road Accident",
        "severity": "High",
        "status": "Reported",
        "area_id": area.id,
        "latitude": area.latitude,
        "longitude": area.longitude,
        "responding_department": "Traffic Police",
    }

    with TestClient(app) as client:
        response = client.post("/api/incidents", json=payload)

    assert response.status_code == 201
    assert response.json()["title"] == payload["title"]
