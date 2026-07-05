"""Cloud Run runtime configuration and discovery regression tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from google.adk.cli.utils.agent_loader import AgentLoader

from app.main import app
from app.runtime_config import adk_base_url, allowed_origins
from citymind_agents.runtime_config import backend_api_base_url


def test_adk_base_url_is_configurable(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ADK_BASE_URL", "https://citymind-adk.example.run.app/")
    assert adk_base_url() == "https://citymind-adk.example.run.app"


def test_backend_base_url_is_configurable(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CITYMIND_BACKEND_BASE_URL", "https://citymind-api.example.run.app/")
    assert backend_api_base_url() == "https://citymind-api.example.run.app/api"


@pytest.mark.parametrize(
    ("setting", "resolver"),
    (("ADK_BASE_URL", adk_base_url), ("CITYMIND_BACKEND_BASE_URL", backend_api_base_url)),
)
def test_production_never_falls_back_to_localhost(monkeypatch, setting, resolver):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv(setting, raising=False)
    with pytest.raises(RuntimeError, match="required in production"):
        resolver()
    monkeypatch.setenv(setting, "http://127.0.0.1:9999")
    with pytest.raises(RuntimeError, match="must not use localhost"):
        resolver()


def test_production_cors_uses_comma_separated_exact_origins(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv(
        "CITYMIND_ALLOWED_ORIGINS",
        "https://citymind.example.com, https://ops.citymind.example.com/",
    )
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    assert allowed_origins() == [
        "https://citymind.example.com",
        "https://ops.citymind.example.com",
    ]


def test_production_cors_rejects_wildcards(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CITYMIND_ALLOWED_ORIGINS", "https://*.example.com")
    with pytest.raises(RuntimeError, match="exact origins"):
        allowed_origins()


def test_health_is_public_and_preserves_popup_header():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["cross-origin-opener-policy"] == "same-origin-allow-popups"


def test_adk_discovery_root_contains_only_citymind_agents():
    agents_dir = Path(__file__).resolve().parents[1] / "agent_apps"
    assert AgentLoader(str(agents_dir)).list_agents() == ["citymind_agents"]
