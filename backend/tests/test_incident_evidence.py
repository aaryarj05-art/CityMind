from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Area, Incident
from app.schemas.evidence import EvidenceSource
from app.services.evidence_confidence import ConfidenceCalculator, SourceRankingEngine
from app.services.evidence_service import EvidenceAggregator, EvidenceService


class FakeProvider:
    name = "FakeLiveProvider"

    def __init__(self, sources=None, error=None):
        self.sources = sources or []
        self.error = error

    def fetch(self, incident, area, client):
        if self.error:
            raise self.error
        return self.sources


def source(publisher, url, hours_old=1, official=False, relevance=0.9):
    return EvidenceSource(
        publisher_name=publisher,
        title=f"{publisher} confirms Mysuru road accident",
        url=url,
        publication_time=datetime.now(timezone.utc) - timedelta(hours=hours_old),
        provider="mock",
        source_type="government" if official else "news",
        credibility_score=1.0 if official else 0.9,
        relevance_score=relevance,
        is_official=official,
    )


def first_incident_id():
    db = SessionLocal()
    incident = db.query(Incident).first()
    incident_id = incident.id
    db.close()
    return incident_id


def test_confidence_uses_independent_confirmations_and_official_source():
    sources = [
        source("The Hindu", "https://www.thehindu.com/example"),
        source("Times of India", "https://timesofindia.indiatimes.com/example"),
        source("Mysuru City Police", "https://mysurucitypolice.gov.in/advisory", official=True),
    ]
    score, factors, reasons, status = ConfidenceCalculator().calculate(sources)
    assert score >= 75
    assert status == "VERIFIED"
    assert factors["official_confirmation"] == 1.0
    assert any("Official" in reason for reason in reasons)


def test_single_source_confidence_is_reduced():
    score, _, reasons, status = ConfidenceCalculator().calculate([
        source("The Hindu", "https://www.thehindu.com/single")
    ])
    assert score <= 64
    assert status == "SINGLE-SOURCE VERIFICATION"
    assert any("Single-source" in reason for reason in reasons)


def test_source_ranking_prefers_official_or_strongest_source():
    official = source("Mysuru City Police", "https://mysurucitypolice.gov.in/advisory", official=True)
    generic = source("Example Blog", "http://example.com/report", relevance=0.6)
    assert SourceRankingEngine().primary_source([generic, official]).publisher_name == "Mysuru City Police"


def test_evidence_service_continues_when_one_provider_fails():
    db = SessionLocal()
    incident = db.query(Incident).first()
    aggregator = EvidenceAggregator(providers=[FakeProvider(error=RuntimeError("down")), FakeProvider([source("Reuters", "https://reuters.com/report")])])
    result = EvidenceService(aggregator=aggregator).get_incident_evidence(db, incident.id)
    db.close()
    assert result.verified_by[0].publisher_name == "Reuters"
    assert result.provider_errors
    assert result.primary_source.url == "https://reuters.com/report"


def test_evidence_endpoint_returns_normalized_payload_without_raw_provider(monkeypatch):
    evidence_source = source("The Hindu", "https://www.thehindu.com/incident")
    aggregator = EvidenceAggregator(providers=[FakeProvider([evidence_source])])
    monkeypatch.setattr("app.routes.incidents.get_incident_evidence", lambda db, incident_id: EvidenceService(aggregator=aggregator).get_incident_evidence(db, incident_id))
    with TestClient(app) as client:
        response = client.get(f"/api/incidents/{first_incident_id()}/evidence")
    assert response.status_code == 200
    data = response.json()
    assert data["verified_by"][0]["url"] == "https://www.thehindu.com/incident"
    assert "raw" not in data
    assert data["banner"].startswith("Evidence generated from live external sources")


def test_evidence_endpoint_does_not_fabricate_when_no_sources(monkeypatch):
    aggregator = EvidenceAggregator(providers=[FakeProvider([])])
    monkeypatch.setattr("app.routes.incidents.get_incident_evidence", lambda db, incident_id: EvidenceService(aggregator=aggregator).get_incident_evidence(db, incident_id))
    with TestClient(app) as client:
        response = client.get(f"/api/incidents/{first_incident_id()}/evidence")
    assert response.status_code == 200
    data = response.json()
    assert data["verification_status"] == "UNVERIFIED"
    assert data["confidence_score"] == 0
    assert data["verified_by"] == []
    assert data["primary_source"] is None