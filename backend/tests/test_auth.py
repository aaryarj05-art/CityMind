import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config.permissions import ALL_PERMISSIONS, PERMISSION_MATRIX, ROLES, permissions_for_role, role_for_email
from app.database import SessionLocal
from app.main import app
from app.models.auth import AuthenticationAudit, User
from app.routes import ai as ai_route
from app.services import auth_service

pytestmark = pytest.mark.real_auth
TEST_SECRET = "phase-6-test-secret-that-is-long-and-random-enough"


@pytest.fixture(autouse=True)
def auth_environment(monkeypatch):
    monkeypatch.setenv("CITYMIND_JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "test-google-client.apps.googleusercontent.com")
    monkeypatch.setenv("CITYMIND_SESSION_MINUTES", "15")
    monkeypatch.setenv("CITYMIND_ROLE_MAPPINGS_JSON", json.dumps({
        "admin@example.com": {"role": "DemoAdmin", "department": "CityMind Demo"}
    }))
    db = SessionLocal()
    db.query(AuthenticationAudit).delete()
    db.query(User).filter(User.google_sub.like("phase6-%")).delete(synchronize_session=False)
    db.commit()
    db.close()
    yield


@pytest.fixture
def client():
    with TestClient(app) as value:
        yield value


def google_claims(**overrides):
    claims = {
        "sub": "phase6-google-user",
        "email": "admin@example.com",
        "name": "Phase Six Admin",
        "picture": "https://example.com/profile.png",
        "email_verified": True,
        "aud": "test-google-client.apps.googleusercontent.com",
        "iss": "https://accounts.google.com",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()),
    }
    claims.update(overrides)
    return claims


def create_user(role="DemoAdmin", active=True, suffix="user"):
    db = SessionLocal()
    user = User(
        google_sub=f"phase6-{suffix}",
        email=f"{suffix}@example.com",
        name=f"Phase Six {suffix}",
        email_verified=True,
        role=role,
        department="Testing",
        is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token, _, _ = auth_service.create_session_token(user)
    user_id = user.id
    db.close()
    return user_id, token


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_valid_google_credential_issues_citymind_session(client, monkeypatch):
    monkeypatch.setattr(auth_service.id_token, "verify_oauth2_token", lambda *args, **kwargs: google_claims())
    response = client.post("/api/auth/google", json={"credential": "mock-google-id-token"})
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer" and data["expires_in"] == 900
    assert data["user"]["role"] == "DemoAdmin"
    decoded = auth_service.decode_session_token(data["access_token"])
    assert decoded["google_sub"] == "phase6-google-user"
    assert decoded["iss"] == "citymind" and decoded["aud"] == "citymind-api"
    db = SessionLocal()
    assert db.query(AuthenticationAudit).filter_by(event_type="login_success", success=True).count() == 1
    db.close()


@pytest.mark.parametrize("claims,reason", [
    (google_claims(aud="wrong-client"), "wrong_audience"),
    (google_claims(exp=1), "expired_google_credential"),
    (google_claims(email_verified=False), "email_not_verified"),
    (google_claims(sub=None), "missing_required_claim"),
    (google_claims(email=None), "missing_required_claim"),
    (google_claims(iss="https://evil.example"), "wrong_issuer"),
])
def test_google_claim_rejections_are_generic(client, monkeypatch, claims, reason):
    monkeypatch.setattr(auth_service.id_token, "verify_oauth2_token", lambda *args, **kwargs: claims)
    response = client.post("/api/auth/google", json={"credential": "mock-token"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Unable to authenticate"}
    db = SessionLocal()
    audit = db.query(AuthenticationAudit).order_by(AuthenticationAudit.id.desc()).first()
    assert audit.reason_code == reason
    db.close()


def test_malformed_google_credential(client, monkeypatch):
    def fail(*args, **kwargs):
        raise ValueError("sensitive verifier detail")
    monkeypatch.setattr(auth_service.id_token, "verify_oauth2_token", fail)
    response = client.post("/api/auth/google", json={"credential": "malformed"})
    assert response.status_code == 401
    assert "sensitive" not in response.text


def test_missing_jwt_secret_fails_safely(client, monkeypatch):
    monkeypatch.delenv("CITYMIND_JWT_SECRET")
    monkeypatch.setattr(auth_service.id_token, "verify_oauth2_token", lambda *args, **kwargs: google_claims())
    response = client.post("/api/auth/google", json={"credential": "mock-token"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication service unavailable"}


def test_role_mapping_is_explicit_and_unknown_is_guest(monkeypatch):
    monkeypatch.setenv("CITYMIND_ROLE_MAPPINGS_JSON", json.dumps({
        "mapped@example.com": {"role": "Police", "department": "Police Department"},
        "invalid@example.com": {"role": "Root", "department": "Unsafe"},
    }))
    assert role_for_email("MAPPED@example.com").role == "Police"
    assert role_for_email("mapped@example.com").department == "Police Department"
    assert role_for_email("unknown@city.gov").role == "Guest"
    assert role_for_email("invalid@example.com").role == "Guest"


def test_citymind_jwt_creation_and_validation():
    user_id, token = create_user(suffix="jwt-valid")
    db = SessionLocal()
    current = auth_service.authenticate_session(db, token)
    assert current.user.id == user_id
    assert current.claims["session_id"]
    assert current.claims["role"] == "DemoAdmin"
    db.close()


def signed_token_for(user, **claim_updates):
    _, _, claims = auth_service.create_session_token(user)
    claims.update(claim_updates)
    return jwt.encode(claims, TEST_SECRET, algorithm="HS256")


def test_expired_wrong_issuer_and_wrong_audience_sessions():
    db = SessionLocal()
    user = User(google_sub="phase6-session-errors", email="errors@example.com", name="Errors", email_verified=True,
                role="DemoAdmin", department="Testing", is_active=True)
    db.add(user); db.commit(); db.refresh(user)
    cases = [
        (signed_token_for(user, exp=1), "session_expired"),
        (signed_token_for(user, iss="not-citymind"), "wrong_issuer"),
        (signed_token_for(user, aud="not-citymind-api"), "wrong_audience"),
    ]
    for token, reason in cases:
        with pytest.raises(auth_service.SessionError) as exc:
            auth_service.decode_session_token(token)
        assert exc.value.reason_code == reason
    db.close()


def test_inactive_user_is_rejected(client):
    _, token = create_user(active=False, suffix="inactive")
    response = client.get("/api/auth/me", headers=auth_header(token))
    assert response.status_code == 401


def test_auth_me_and_session_status(client):
    _, token = create_user(role="Police", suffix="me")
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "Police"
    assert "traffic.read" in me.json()["permissions"]
    status = client.get("/api/auth/session-status", headers=auth_header(token))
    assert status.status_code == 200
    assert status.json()["authenticated"] is True
    assert 0 < status.json()["remaining_seconds"] <= 900


def test_logout_records_audit_without_claiming_revocation(client):
    user_id, token = create_user(suffix="logout")
    response = client.post("/api/auth/logout", headers=auth_header(token))
    assert response.status_code == 200
    assert response.json()["logged_out"] is True
    assert response.json()["token_revoked"] is False
    db = SessionLocal()
    assert db.query(AuthenticationAudit).filter_by(event_type="logout", user_id=user_id).count() == 1
    db.close()


def test_every_role_has_a_centralized_permission_entry():
    assert set(ROLES) == set(PERMISSION_MATRIX)
    assert PERMISSION_MATRIX["DemoAdmin"] == ALL_PERMISSIONS
    assert PERMISSION_MATRIX["Guest"] == {"dashboard.read"}
    for role in ROLES:
        assert set(permissions_for_role(role)) <= ALL_PERMISSIONS
    assert "audit.read" in PERMISSION_MATRIX["Mayor"]
    assert "dispatch.approve" in PERMISSION_MATRIX["Commissioner"]
    assert "hospital_capacity.read" in PERMISSION_MATRIX["Healthcare"]


def test_unauthenticated_operational_route_returns_401(client):
    assert client.get("/api/dashboard").status_code == 401


def test_guest_is_forbidden_from_operational_and_ai_routes(client):
    _, token = create_user(role="Guest", suffix="guest")
    assert client.get("/api/dashboard", headers=auth_header(token)).status_code == 200
    assert client.get("/api/risk/summary", headers=auth_header(token)).status_code == 403
    assert client.post("/api/ai/query", headers=auth_header(token), json={"message": "status"}).status_code == 403
    db = SessionLocal()
    assert db.query(AuthenticationAudit).filter_by(event_type="permission_denied").count() >= 2
    db.close()


def test_allowed_role_can_access_protected_route(client):
    _, token = create_user(role="Police", suffix="police")
    assert client.get("/api/risk/summary", headers=auth_header(token)).status_code == 200


def test_ai_derives_identity_and_ignores_frontend_identity(client, monkeypatch):
    user_id, token = create_user(role="DemoAdmin", suffix="ai-identity")
    captured = {}

    async def fake_query(**kwargs):
        captured.update(kwargs)
        return {"session_id": "adk-session", "response": "ok", "agents_used": [], "grounded": True}

    monkeypatch.setattr(ai_route, "query_citymind_agents", fake_query)
    response = client.post("/api/ai/query", headers=auth_header(token), json={
        "message": "status", "user_id": "attacker", "role": "Mayor",
    })
    assert response.status_code == 200
    assert captured["user_id"] == str(user_id)
    assert captured["role"] == "DemoAdmin"
    assert captured["department"] == "Testing"
    assert captured["citymind_session_id"]