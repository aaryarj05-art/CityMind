import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Resource
from app.services.google_routes_service import (
    MATRIX_URL,
    ROUTES_URL,
    clear_route_cache,
    compute_route,
    compute_route_matrix,
    congestion_level,
    parse_google_duration,
)

ORIGIN = {"latitude": 12.2958, "longitude": 76.6394}
DESTINATION = {"latitude": 12.3052, "longitude": 76.6551}


@pytest.fixture(autouse=True)
def route_environment(monkeypatch):
    clear_route_cache()
    monkeypatch.setenv("GOOGLE_MAPS_SERVER_API_KEY", "test-key-not-real")
    yield
    clear_route_cache()


def async_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.anyio
async def test_successful_route_response_and_header_security():
    def handler(request):
        assert str(request.url) == ROUTES_URL
        assert request.headers["x-goog-api-key"] == "test-key-not-real"
        assert "test-key-not-real" not in str(request.url)
        assert request.headers["x-goog-fieldmask"] == "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline"
        return httpx.Response(200, json={"routes": [{
            "distanceMeters": 5300, "duration": "840s", "staticDuration": "510s",
            "polyline": {"encodedPolyline": "abc"},
        }]})
    async with async_client(handler) as client:
        result = await compute_route(ORIGIN, DESTINATION, client)
    assert result["traffic_delay_seconds"] == 330
    assert result["congestion_ratio"] == 1.647
    assert result["congestion_level"] == "severe"
    assert result["live_data"] is True and result["fallback_used"] is False


def test_duration_parsing_and_citymind_congestion_boundaries():
    assert parse_google_duration("840s") == 840
    assert parse_google_duration("1.2s") == 2
    with pytest.raises(ValueError):
        parse_google_duration("14 minutes")
    assert [congestion_level(value) for value in (1.0, 1.1, 1.3, 1.6)] == [
        "low", "moderate", "heavy", "severe"
    ]


@pytest.mark.anyio
@pytest.mark.parametrize("failure,code", [
    ("missing", "google_maps_key_missing"),
    ("timeout", "google_routes_timeout"),
    ("rate_limit", "google_routes_rate_limited"),
    ("malformed", "google_routes_invalid_response"),
])
async def test_route_fallbacks(monkeypatch, failure, code):
    if failure == "missing":
        monkeypatch.delenv("GOOGLE_MAPS_SERVER_API_KEY")
        result = await compute_route(ORIGIN, DESTINATION)
    else:
        def handler(request):
            if failure == "timeout":
                raise httpx.ReadTimeout("timed out", request=request)
            if failure == "rate_limit":
                return httpx.Response(429, request=request)
            return httpx.Response(200, json={"routes": [{}]})
        async with async_client(handler) as client:
            result = await compute_route(ORIGIN, DESTINATION, client)
    assert result["source"] == "CityMind estimated fallback"
    assert result["live_data"] is False and result["fallback_used"] is True
    assert result["warning"]["code"] == code


@pytest.mark.anyio
async def test_successful_matrix_ranking_partial_results_and_cache():
    calls = 0
    def handler(request):
        nonlocal calls
        calls += 1
        assert str(request.url) == MATRIX_URL
        assert request.headers["x-goog-fieldmask"].startswith("originIndex,destinationIndex")
        return httpx.Response(200, json=[
            {"originIndex": 0, "destinationIndex": 0, "condition": "ROUTE_EXISTS",
             "status": {}, "distanceMeters": 4600, "duration": "420s", "staticDuration": "350s"},
            {"originIndex": 1, "destinationIndex": 0, "condition": "ROUTE_NOT_FOUND"},
            {"originIndex": 99, "destinationIndex": 0, "condition": "ROUTE_EXISTS"},
        ])
    origins = [
        {"resource_id": "AMB-001", "latitude": 12.301, "longitude": 76.645},
        {"resource_id": "AMB-002", "latitude": 12.287, "longitude": 76.628},
    ]
    async with async_client(handler) as client:
        first = await compute_route_matrix(origins, ORIGIN, client)
        second = await compute_route_matrix(origins, ORIGIN, client)
    assert calls == 1
    assert len(first["rankings"]) == 2
    assert {item["rank"] for item in first["rankings"]} == {1, 2}
    google = next(item for item in first["rankings"] if item["resource_id"] == "AMB-001")
    assert google["traffic_delay_seconds"] == 70 and google["live_data"] is True
    assert first["fallback_used"] is True
    assert second == first


def test_route_matrix_preserves_resource_eligibility(monkeypatch):
    monkeypatch.delenv("GOOGLE_MAPS_SERVER_API_KEY")
    db = SessionLocal()
    available = Resource(resource_code="P5-AVAILABLE", resource_type="Ambulance", status="Available",
        latitude=12.3, longitude=76.64, assigned_incident_id=None, capacity="Standard")
    unavailable = Resource(resource_code="P5-UNAVAILABLE", resource_type="Ambulance", status="Maintenance",
        latitude=12.31, longitude=76.65, assigned_incident_id=None, capacity="Standard")
    db.add_all([available, unavailable]); db.commit()
    try:
        with TestClient(app) as client:
            response = client.post("/api/maps/route-matrix", json={
                "origins": [
                    {"resource_id": available.resource_code, "latitude": 12.3, "longitude": 76.64},
                    {"resource_id": unavailable.resource_code, "latitude": 12.31, "longitude": 76.65},
                ],
                "destination": ORIGIN,
                "required_resource_type": "Ambulance",
            })
        assert response.status_code == 200
        assert [item["resource_id"] for item in response.json()["rankings"]] == ["P5-AVAILABLE"]
    finally:
        db.delete(available); db.delete(unavailable); db.commit(); db.close()


@pytest.mark.parametrize("payload", [
    {"origin": {"latitude": 91, "longitude": 0}, "destination": DESTINATION},
    {"origin": ORIGIN, "destination": {"latitude": 0, "longitude": 181}},
])
def test_invalid_route_coordinates(payload):
    with TestClient(app) as client:
        assert client.post("/api/maps/route", json=payload).status_code == 422
