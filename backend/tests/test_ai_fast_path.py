import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.routes import ai as ai_route
from app.services.adk_service import ADKServiceError
from app.services.ai_fast_path import classify_fast_path_intent
from app.services.ai_security_gateway import reset_security_state


def setup_function():
    reset_security_state()


def test_fast_path_classifier_recognizes_city_risk_prompts():
    assert classify_fast_path_intent("What is the current city-wide risk situation?")["intent"] == "city_risk_summary"
    assert classify_fast_path_intent("City Risk Situation")["intent"] == "city_risk_summary"


def test_fast_path_classifier_recognizes_known_area_prompt():
    result = classify_fast_path_intent("What is happening in Lashkar Mohalla?", ["Lashkar Mohalla"])
    assert result == {"intent": "area_status", "area_name": "Lashkar Mohalla"}


def test_fast_path_classifier_recognizes_dispatch_resource_and_alert_prompts():
    assert classify_fast_path_intent("Dispatch Situation")["intent"] == "dispatch_summary"
    assert classify_fast_path_intent("Are there resource shortages?")["intent"] == "resource_shortages"
    assert classify_fast_path_intent("Generate public alert")["intent"] == "public_alert"


def test_ai_query_common_prompt_uses_fast_path_without_adk(monkeypatch):
    async def should_not_call_adk(**_kwargs):
        raise AssertionError("ADK should not run for deterministic fast-path prompts")

    monkeypatch.setattr(ai_route, "query_citymind_agents", should_not_call_adk)
    with TestClient(app) as client:
        response = client.post("/api/ai/query", json={"message": "What is happening in Lashkar Mohalla?"})

    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "deterministic_backend_fast_path"
    assert data["ai_assisted"] is False
    assert data["grounded"] is True
    assert "Lashkar Mohalla" in data["response"]
    assert "Google ADK remains available" in data["note"]


def test_ai_query_adk_failure_returns_graceful_fallback(monkeypatch):
    async def failing_adk(**_kwargs):
        raise ADKServiceError("simulated slow ADK failure")

    monkeypatch.setattr(ai_route, "query_citymind_agents", failing_adk)
    with TestClient(app) as client:
        response = client.post("/api/ai/query", json={"message": "Analyze cross-agency coordination assumptions for tomorrow."})

    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "deterministic_backend_adk_fallback"
    assert data["grounded"] is True
    assert "deterministic operational fallback" in data["response"]
    assert any("ADK" in item for item in data["limitations"])


def test_ai_query_adk_timeout_returns_graceful_fallback(monkeypatch):
    async def slow_adk(**_kwargs):
        await asyncio.sleep(0.05)
        return {"session_id": "late", "response": "too late", "agents_used": [], "tools_used": [], "grounded": True}

    monkeypatch.setattr(ai_route, "ADK_DEMO_BUDGET_SECONDS", 0.001)
    monkeypatch.setattr(ai_route, "query_citymind_agents", slow_adk)
    with TestClient(app) as client:
        response = client.post("/api/ai/query", json={"message": "Analyze cross-agency coordination assumptions for next week."})

    assert response.status_code == 200
    assert response.json()["source"] == "deterministic_backend_adk_fallback"


def test_ai_status_reports_gateway_available(monkeypatch):
    class FailingClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *_args):
            return False
        async def get(self, *_args, **_kwargs):
            raise RuntimeError("ADK unavailable")

    monkeypatch.setattr(ai_route.httpx, "AsyncClient", lambda *args, **kwargs: FailingClient())
    with TestClient(app) as client:
        response = client.get("/api/ai/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "available"
    assert data["fast_path_status"] == "available"
    assert data["adk_status"] == "unavailable"