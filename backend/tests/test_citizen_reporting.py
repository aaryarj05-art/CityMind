from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import CitizenReport, CitizenReportMedia, Incident
from app.schemas.evidence import EvidenceSource
from app.services.citizen_report_service import CitizenReportService, ImageStorageService
from app.services.evidence_service import EvidenceAggregator, EvidenceService

TEST_UPLOAD_DIR = Path(__file__).resolve().parents[1] / "test_uploads" / "citizen_reports"


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
    TEST_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for child in TEST_UPLOAD_DIR.iterdir():
        if child.is_file():
            child.unlink()


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

    def service_factory():
        return CitizenReportService(storage=ImageStorageService(base_dir=TEST_UPLOAD_DIR))

    monkeypatch.setattr(user_route, "CitizenReportService", service_factory)
    with TestClient(app) as test_client:
        yield test_client


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