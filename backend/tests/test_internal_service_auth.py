import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.auth import AuthenticationAudit, User
from app.services import auth_service
from citymind_agents.tools import response_tools, risk_tools

pytestmark = pytest.mark.real_auth
INTERNAL_TOKEN = "phase6-internal-test-token"
JWT_SECRET = "phase6-internal-tests-jwt-secret-value"


@pytest.fixture(autouse=True)
def internal_auth_environment(monkeypatch):
    monkeypatch.setenv("CITYMIND_INTERNAL_SERVICE_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("CITYMIND_JWT_SECRET", JWT_SECRET)
    db = SessionLocal()
    db.query(AuthenticationAudit).filter(AuthenticationAudit.google_sub.like("phase6-internal-%")).delete(synchronize_session=False)
    db.query(User).filter(User.google_sub.like("phase6-internal-%")).delete(synchronize_session=False)
    db.commit(); db.close()
    yield


@pytest.fixture
def client():
    with TestClient(app) as value:
        yield value


def internal_headers(token=INTERNAL_TOKEN):
    return {"X-CityMind-Internal-Token": token}


def user_token(role, suffix):
    db = SessionLocal()
    user = User(
        google_sub=f"phase6-internal-{suffix}", email=f"{suffix}@internal.test",
        name=suffix, email_verified=True, role=role, department="Tests",
        is_active=True, created_at=datetime.now(timezone.utc),
    )
    db.add(user); db.commit(); db.refresh(user)
    token, _, _ = auth_service.create_session_token(user)
    db.close()
    return token


def test_valid_internal_token_may_call_approved_read(client):
    response = client.get("/api/risk/summary", headers=internal_headers())
    assert response.status_code == 200
    assert "average_city_risk_score" in response.json()


def test_invalid_and_missing_internal_credentials_are_rejected(client):
    assert client.get("/api/risk/summary", headers=internal_headers("wrong-token")).status_code == 401
    assert client.get("/api/risk/summary").status_code == 401


def test_internal_token_cannot_create_or_approve_dispatch(client):
    created = client.post("/api/dispatches", headers=internal_headers(), json={
        "incident_id": 1, "use_recommended_resources": True,
    })
    changed = client.patch("/api/dispatches/1/status", headers=internal_headers(), json={"status": "En Route"})
    assert created.status_code == 401
    assert changed.status_code == 401


def test_normal_user_jwt_still_works_and_guest_remains_denied(client):
    police = user_token("Police", "police")
    guest = user_token("Guest", "guest")
    assert client.get("/api/risk/summary", headers={"Authorization": f"Bearer {police}"}).status_code == 200
    assert client.get("/api/risk/summary", headers={"Authorization": f"Bearer {guest}"}).status_code == 403


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def assert_internal_header(request):
    headers = {key.lower(): value for key, value in request.header_items()}
    assert headers["x-citymind-internal-token"] == INTERNAL_TOKEN


def test_adk_risk_tool_succeeds_with_internal_token(monkeypatch):
    def fake_urlopen(request, timeout):
        assert_internal_header(request)
        assert timeout == 10
        return FakeResponse({"average_city_risk_score": 42.0})
    monkeypatch.setattr(risk_tools, "urlopen", fake_urlopen)
    result = risk_tools.get_city_risk_summary()
    assert result["success"] is True
    assert result["data"]["average_city_risk_score"] == 42.0


def test_adk_response_planning_tool_succeeds_with_internal_token(monkeypatch):
    def fake_urlopen(request, timeout):
        assert_internal_header(request)
        assert timeout == 15
        return FakeResponse({"incident_id": 1, "plan_complete": True, "candidates": []})
    monkeypatch.setattr(response_tools, "urlopen", fake_urlopen)
    result = response_tools.get_incident_allocation_plan(1)
    assert result["success"] is True
    assert result["data"]["plan_complete"] is True


def test_adk_tool_missing_internal_token_is_structured(monkeypatch):
    monkeypatch.delenv("CITYMIND_INTERNAL_SERVICE_TOKEN")
    result = risk_tools.get_city_risk_summary()
    assert result == {
        "success": False,
        "error_type": "internal_auth_unavailable",
        "message": "CityMind internal service authentication is not configured.",
    }


def test_google_popup_security_header_is_present(client):
    response = client.get("/api/health")
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin-allow-popups"