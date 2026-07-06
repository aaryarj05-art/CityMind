"""Cloud Run runtime configuration and discovery regression tests."""

import os
import shutil
import subprocess
import sys
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
    agents_dir = Path(__file__).resolve().parents[1] / "citymind_agents"
    assert AgentLoader(str(agents_dir)).list_agents() == ["citymind_agents"]


def test_adk_container_layout_imports_all_agent_and_policy_modules(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    app_root = tmp_path / "app"
    agent_apps = tmp_path / "agent_apps"
    shutil.copytree(backend / "app", app_root,
                    ignore=shutil.ignore_patterns(".env", ".env.*", "__pycache__", "*.pyc", "*.db"))
    shutil.copytree(backend / "citymind_agents", agent_apps / "citymind_agents",
                    ignore=shutil.ignore_patterns(".env", ".env.*", "__pycache__", "*.pyc", "*.db"))
    script = """
import importlib
import pkgutil
import sys
from pathlib import Path
from app.services.ai_security_gateway import explain_role_policy
from citymind_agents.agent import root_agent
import citymind_agents

for module in pkgutil.walk_packages(citymind_agents.__path__, citymind_agents.__name__ + '.'):
    importlib.import_module(module.name)
assert root_agent.name == 'city_operations_coordinator'
assert explain_role_policy('DemoAdmin')['role'] == 'DemoAdmin'
assert 'app.main' not in sys.modules
assert not Path('citymind.db').exists()
print('container-layout-imports-ok')
"""
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join((str(tmp_path), str(agent_apps)))
    env.pop("DATABASE_URL", None)
    completed = subprocess.run(
        [sys.executable, "-c", script], cwd=tmp_path, env=env,
        capture_output=True, text=True, timeout=60, check=False,
    )
    assert completed.returncode == 0, completed.stderr
    assert completed.stdout.strip() == "container-layout-imports-ok"
    assert AgentLoader(str(agent_apps)).list_agents() == ["citymind_agents"]
    assert not list(tmp_path.rglob(".env"))
    assert not list(tmp_path.rglob("*.db"))


def test_adk_dockerfile_copies_only_required_runtime_trees():
    backend = Path(__file__).resolve().parents[1]
    dockerfile = (backend / "Dockerfile.adk").read_text(encoding="utf-8")
    dockerignore = (backend / ".dockerignore").read_text(encoding="utf-8")
    assert "PYTHONPATH=/app:/app/agent_apps" in dockerfile
    assert "COPY --chown=citymind:citymind app /app/app" in dockerfile
    assert "COPY --chown=citymind:citymind citymind_agents /app/agent_apps/citymind_agents" in dockerfile
    assert "COPY ." not in dockerfile
    for excluded in (".env", ".env.*", "tests/", "*.db", "frontend/"):
        assert excluded in dockerignore
