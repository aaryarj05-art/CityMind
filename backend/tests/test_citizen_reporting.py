from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
import shutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import CitizenReport, CitizenReportMedia, Incident
from app.schemas.evidence import EvidenceSource
from app.services.citizen_report_service import DEFAULT_UPLOAD_DIR, STORAGE_ERROR_MESSAGE, CitizenReportService, ImageStorageService, ReportStorageError, resolve_upload_dir
from app.services.evidence_service import EvidenceAggregator, EvidenceService

TEST_UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "test_uploads"
TEST_UPLOAD_DIR = TEST_UPLOAD_ROOT / "citizen_reports"


class FakeProvider:
    name = "FakeLiveProvider"

    def __init__(self, sources=None):
        self.sources = sources or []

    def fetch(self, incident, area, client):
        return self.sources


def source():
    return EvidenceSource(
        publisher_name="The Hindu",
        title="The Hindu confirms Mysuru incident",
        url="https://www.thehindu.com/news/cities/mysuru/example-incident",
        publication_time=datetime.now(timezone.utc) - timedelta(minutes=12),
        provider="mock",
        source_type="news",
        credibility_score=0.9,
        relevance_score=0.9,
    )


def cleanup_database():
    db = SessionLocal()
    try:
        db.query(CitizenReportMedia).delete()
        db.query(CitizenReport).delete()
        db.query(Incident).filter(Incident.category == "Citizen Report").delete()
        db.commit()
    finally:
        db.close()


def cleanup_uploads():
    if TEST_UPLOAD_ROOT.exists():
        shutil.rmtree(TEST_UPLOAD_ROOT)
    TEST_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@pytest.fixture(autouse=True)
def clean_citizen_reports():
    cleanup_database()
    cleanup_uploads()
    yield
    cleanup_database()
    cleanup_uploads()


@pytest.fixture
def client(monkeypatch):
    import app.routes.user as user_route

    monkeypatch.setenv("CITYMIND_UPLOAD_DIR", str(TEST_UPLOAD_DIR))

    def service_factory():
        return CitizenReportService(storage=ImageStorageService(base_dir=TEST_UPLOAD_DIR))

    monkeypatch.setattr(user_route, "CitizenReportService", service_factory)
    with TestClient(app) as test_client:
        yield test_client


def test_default_upload_dir_uses_cloud_run_writable_tmp(monkeypatch):
    monkeypatch.delenv("CITYMIND_UPLOAD_DIR", raising=False)

    assert resolve_upload_dir() == DEFAULT_UPLOAD_DIR
    assert ImageStorageService().base_dir == Path("/tmp/citymind_uploads/citizen_reports")


def test_upload_dir_can_be_overridden_by_environment(monkeypatch):
    configured_dir = TEST_UPLOAD_ROOT / "configured" / "citizen_reports"
    monkeypatch.setenv("CITYMIND_UPLOAD_DIR", str(configured_dir))

    assert resolve_upload_dir() == configured_dir
    assert ImageStorageService().base_dir == configured_dir


def test_image_storage_creates_directory_with_parents_and_exist_ok(monkeypatch):
    upload_dir = TEST_UPLOAD_ROOT / "nested" / "citizen_reports"
    calls = []
    original_mkdir = Path.mkdir

    def spy_mkdir(self, *args, **kwargs):
        calls.append((self, kwargs))
        return original_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", spy_mkdir)
    upload = SimpleNamespace(content_type="image/jpeg", filename="evidence.jpg", file=BytesIO(b"fake-jpeg-bytes"))

    stored = ImageStorageService(base_dir=upload_dir).store(upload)

    assert (upload_dir / stored.stored_filename).exists()
    assert any(path == upload_dir and kwargs.get("parents") is True and kwargs.get("exist_ok") is True for path, kwargs in calls)


def test_citizen_report_media_endpoint_serves_stored_upload(client):
    response, _ = submit_report(client)
    assert response.status_code == 201

    media_url = response.json()["media"][0]["media_url"]
    media_response = client.get(media_url)

    assert media_response.status_code == 200
    assert media_response.content == b"fake-jpeg-bytes"


def test_image_storage_permission_error_raises_controlled_error(monkeypatch):
    def fail_mkdir(self, *args, **kwargs):
        raise PermissionError("uploads")

    monkeypatch.setattr(Path, "mkdir", fail_mkdir)
    upload = SimpleNamespace(content_type="image/jpeg", filename="evidence.jpg", file=BytesIO(b"fake-jpeg-bytes"))

    with pytest.raises(ReportStorageError, match=STORAGE_ERROR_MESSAGE):
        ImageStorageService(base_dir=TEST_UPLOAD_DIR).store(upload)


def test_storage_failure_returns_controlled_error(client, monkeypatch):
    original_mkdir = Path.mkdir

    def fail_upload_mkdir(self, *args, **kwargs):
        if self == TEST_UPLOAD_DIR:
            raise PermissionError("uploads")
        return original_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", fail_upload_mkdir)
    response, _ = submit_report(client)

    assert response.status_code == 500
    assert response.json()["detail"] == STORAGE_ERROR_MESSAGE
    assert "PermissionError" not in response.text


def active_incident():
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.status.notin_(["Resolved", "Closed"])).first()
        assert incident is not None
        return incident.id, incident.latitude, incident.longitude
    finally:
        db.close()


def submit_report(client, latitude=None, longitude=None, description="Smoke visible near the market entrance"):
    incident_id, incident_lat, incident_lng = active_incident()
    data = {
        "description": description,
        "latitude": str(latitude if latitude is not None else incident_lat),
        "longitude": str(longitude if longitude is not None else incident_lng),
        "readable_address": "Devaraja Market entrance, Mysuru",
    }
    files = [("images", ("evidence.jpg", b"fake-jpeg-bytes", "image/jpeg"))]
    response = client.post("/api/user/report", data=data, files=files)
    return response, incident_id


def test_citizen_report_submission_matches_existing_incident(client):
    response, incident_id = submit_report(client)

    assert response.status_code == 201
    payload = response.json()
    assert payload["incident_id"] == incident_id
    assert payload["match_status"] == "matched"
    assert payload["verification_status"] == "Pending Verification"
    assert payload["media"][0]["media_url"].startswith("/api/user/report-media/")


def test_citizen_report_rejects_unsupported_file_type(client):
    _, incident_lat, incident_lng = active_incident()
    response = client.post(
        "/api/user/report",
        data={"description": "Unverified clip", "latitude": str(incident_lat), "longitude": str(incident_lng), "readable_address": "Mysuru test location"},
        files=[("images", ("clip.gif", b"gif-bytes", "image/gif"))],
    )

    assert response.status_code == 422
    assert "JPG" in response.json()["detail"]


def test_citizen_report_creates_pending_incident_when_no_location_match(client):
    response, _ = submit_report(client, latitude=12.15, longitude=76.95, description="Road underpass flooding reported by commuters")

    assert response.status_code == 201
    payload = response.json()
    assert payload["match_status"] == "new_pending_incident"
    assert payload["distance_to_incident_meters"] == 0.0

    db = SessionLocal()
    try:
        incident = db.get(Incident, payload["incident_id"])
        assert incident.category == "Citizen Report"
        assert incident.status == "Reported"
    finally:
        db.close()


def test_incident_eyewitness_endpoint_returns_normalized_reports(client):
    response, incident_id = submit_report(client)
    assert response.status_code == 201

    eyewitness = client.get(f"/api/incidents/{incident_id}/eyewitness")

    assert eyewitness.status_code == 200
    payload = eyewitness.json()
    assert len(payload) == 1
    assert payload[0]["verification_status"] == "Pending Verification"
    assert payload[0]["media"][0]["original_filename"] == "evidence.jpg"


def test_evidence_service_includes_pending_eyewitness_without_fabricating_sources(client):
    response, incident_id = submit_report(client)
    assert response.status_code == 201

    db = SessionLocal()
    try:
        evidence = EvidenceService(aggregator=EvidenceAggregator(providers=[FakeProvider([])])).get_incident_evidence(db, incident_id)
    finally:
        db.close()

    assert evidence.verification_status == "PENDING VERIFICATION"
    assert evidence.verified_by == []
    assert evidence.primary_source is None
    assert evidence.eyewitness_evidence[0].verification_status == "Pending Verification"
    assert any("Single eyewitness" in reason for reason in evidence.trust_reasons)


def test_evidence_service_marks_eyewitness_verified_when_corroborated(client):
    response, incident_id = submit_report(client)
    assert response.status_code == 201

    db = SessionLocal()
    try:
        evidence = EvidenceService(aggregator=EvidenceAggregator(providers=[FakeProvider([source()])])).get_incident_evidence(db, incident_id)
    finally:
        db.close()

    assert evidence.verified_by[0].publisher_name == "The Hindu"
    assert evidence.eyewitness_evidence[0].verification_status == "Verified"
    assert any("corroborated" in reason for reason in evidence.trust_reasons)

def test_citizen_report_response_tracks_linked_incident_lifecycle(client):
    response, incident_id = submit_report(client)

    assert response.status_code == 201
    payload = response.json()
    assert payload["incident_id"] == incident_id
    assert payload["incident_status"] in {"Reported", "Assigned", "In Progress"}
    assert payload["incident_title"]
    assert payload["incident_reported_at"]
    assert payload["incident_updated_at"]

    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        incident.status = "In Progress"
        db.commit()
    finally:
        db.close()

    status_response = client.get(f"/api/user/report/{payload['id']}")

    assert status_response.status_code == 200
    refreshed = status_response.json()
    assert refreshed["incident_status"] == "In Progress"
    assert refreshed["verification_status"] == "Pending Verification"


def test_dashboard_recent_incidents_surfaces_matched_citizen_report(client):
    response, incident_id = submit_report(client)

    assert response.status_code == 201
    dashboard = client.get("/api/dashboard")

    assert dashboard.status_code == 200
    recent_incidents = dashboard.json()["recent_incidents"]
    assert recent_incidents[0]["id"] == incident_id
