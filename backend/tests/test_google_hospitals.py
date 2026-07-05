from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Hospital, HospitalExternalMapping, Incident
from app.services.google_places_service import (
    PLACES_URL,
    PlacesUnavailableError,
    clear_places_cache,
    search_nearby_hospitals,
)


@pytest.fixture(autouse=True)
def places_environment(monkeypatch):
    clear_places_cache()
    monkeypatch.setenv("GOOGLE_MAPS_SERVER_API_KEY", "test-key-not-real")
    yield
    clear_places_cache()


def places_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def google_place(place_id="place-1", name="Hospital One"):
    return {
        "id": place_id,
        "displayName": {"text": name, "languageCode": "en"},
        "formattedAddress": "Mysuru, Karnataka",
        "location": {"latitude": 12.3, "longitude": 76.64},
        "primaryType": "hospital", "businessStatus": "OPERATIONAL",
        "nationalPhoneNumber": "0123456789", "websiteUri": "https://hospital.example",
        "googleMapsUri": "https://maps.google.com/example",
    }


@pytest.mark.anyio
async def test_places_success_and_field_parsing():
    def handler(request):
        assert str(request.url) == PLACES_URL
        assert request.headers["x-goog-api-key"] == "test-key-not-real"
        assert "test-key-not-real" not in str(request.url)
        assert "places.nationalPhoneNumber" in request.headers["x-goog-fieldmask"]
        return httpx.Response(200, json={"places": [google_place()]})
    async with places_client(handler) as client:
        result = await search_nearby_hospitals(12.3, 76.64, client=client)
    hospital = result["hospitals"][0]
    assert hospital["google_place_id"] == "place-1"
    assert hospital["name"] == "Hospital One"
    assert hospital["national_phone_number"] == "0123456789"
    assert hospital["identity_source"] == "Google Places"
    assert "beds" in result["notice"]


@pytest.mark.anyio
@pytest.mark.parametrize("limit", [5, 10, 20])
async def test_places_enforces_requested_result_limit(limit):
    def handler(request):
        import json

        assert json.loads(request.content)["maxResultCount"] == limit
        places = [google_place(f"place-{index}", f"Hospital {index}") for index in range(25)]
        return httpx.Response(200, json={"places": places})

    async with places_client(handler) as client:
        result = await search_nearby_hospitals(12.3, 76.64, limit=limit, client=client)

    assert len(result["hospitals"]) == limit


@pytest.mark.anyio
async def test_places_empty_response_is_valid():
    async with places_client(lambda request: httpx.Response(200, json={})) as client:
        result = await search_nearby_hospitals(12.3, 76.64, client=client)
    assert result["hospitals"] == []


@pytest.mark.anyio
async def test_places_timeout_is_structured():
    def handler(request):
        raise httpx.ReadTimeout("timed out", request=request)
    async with places_client(handler) as client:
        with pytest.raises(PlacesUnavailableError) as caught:
            await search_nearby_hospitals(12.3, 76.64, client=client)
    assert caught.value.code == "google_places_timeout"
    assert "test-key-not-real" not in caught.value.message


@pytest.mark.parametrize("params", [
    {"latitude": 91, "longitude": 76.6},
    {"latitude": 12.3, "longitude": 76.6, "radius": 50001},
    {"latitude": 12.3, "longitude": 76.6, "radius": 0},
    {"latitude": 12.3, "longitude": 76.6, "limit": 21},
    {"latitude": 12.3, "longitude": 76.6, "limit": 0},
])
def test_nearby_validation(params):
    with TestClient(app) as client:
        assert client.get("/api/hospitals/nearby", params=params).status_code == 422


def test_nearby_places_unavailable_returns_503(monkeypatch):
    monkeypatch.delenv("GOOGLE_MAPS_SERVER_API_KEY")
    with TestClient(app) as client:
        response = client.get("/api/hospitals/nearby", params={"latitude": 12.3, "longitude": 76.6})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "google_maps_key_missing"


@pytest.mark.parametrize("requested_limit,expected_limit", [
    (None, 10),
    (5, 5),
    (10, 10),
    (20, 20),
])
def test_rank_live_enforces_result_limit_before_routing(monkeypatch, requested_limit, expected_limit):
    db = SessionLocal()
    incident = Incident(title="P5 limit", description="test", category="Medical Emergency",
        severity="High", status="Reported", latitude=12.2958, longitude=76.6394,
        responding_department="Medical")
    db.add(incident); db.commit()
    discovered = {"hospitals": [{
        "google_place_id": f"limit-place-{index}",
        "name": f"Hospital {index}",
        "formatted_address": None,
        "latitude": 12.3 + index / 10000,
        "longitude": 76.64,
    } for index in range(25)]}
    places_mock = AsyncMock(return_value=discovered)
    route_mock = AsyncMock(return_value={
        "traffic_duration_seconds": 600,
        "distance_meters": 5000,
        "source": "Google Routes API",
        "live_data": True,
    })
    monkeypatch.setattr("app.routes.hospitals_google.search_nearby_hospitals", places_mock)
    monkeypatch.setattr("app.routes.hospitals_google.compute_route", route_mock)
    payload = {"incident_id": incident.id}
    if requested_limit is not None:
        payload["limit"] = requested_limit
    try:
        with TestClient(app) as client:
            response = client.post("/api/hospitals/rank-live", json=payload)
        assert response.status_code == 200, response.text
        assert len(response.json()["hospitals"]) <= expected_limit
        assert places_mock.await_args.kwargs["limit"] == expected_limit
        assert route_mock.await_count == expected_limit
    finally:
        db.delete(incident); db.commit(); db.close()


@pytest.mark.parametrize("limit", [0, 21])
def test_rank_live_limit_validation(limit):
    with TestClient(app) as client:
        response = client.post("/api/hospitals/rank-live", json={"incident_id": 1, "limit": limit})
    assert response.status_code == 422

def test_live_ranking_provenance_matching_and_incompatible_rejection(monkeypatch):
    db = SessionLocal()
    incident = Incident(title="P5 medical", description="test", category="Medical Emergency",
        severity="High", status="Reported", latitude=12.2958, longitude=76.6394,
        responding_department="Medical")
    matched = Hospital(name="CityMind Matched", latitude=12.3, longitude=76.64,
        total_beds=100, available_beds=12, emergency_capacity="Adequate", status="Online",
        last_updated=datetime.now(timezone.utc) - timedelta(hours=1))
    incompatible = Hospital(name="CityMind Full", latitude=12.31, longitude=76.65,
        total_beds=100, available_beds=0, emergency_capacity="Full", status="Online")
    db.add_all([incident, matched, incompatible]); db.commit()
    mappings = [
        HospitalExternalMapping(citymind_hospital_id=matched.id, google_place_id="matched", verified=True),
        HospitalExternalMapping(citymind_hospital_id=incompatible.id, google_place_id="full", verified=True),
    ]
    db.add_all(mappings); db.commit()
    discovered = {
        "hospitals": [
            {"google_place_id": "unmatched", "name": "Unmatched", "formatted_address": None,
             "latitude": 12.29, "longitude": 76.63},
            {"google_place_id": "matched", "name": "Matched Google", "formatted_address": "Address",
             "latitude": 12.3, "longitude": 76.64},
            {"google_place_id": "full", "name": "Full Google", "formatted_address": "Address",
             "latitude": 12.31, "longitude": 76.65},
        ]
    }
    route = {"traffic_duration_seconds": 600, "distance_meters": 5000,
             "source": "Google Routes API", "live_data": True}
    monkeypatch.setattr("app.routes.hospitals_google.search_nearby_hospitals", AsyncMock(return_value=discovered))
    monkeypatch.setattr("app.routes.hospitals_google.compute_route", AsyncMock(return_value=route))
    try:
        with TestClient(app) as client:
            response = client.post("/api/hospitals/rank-live", json={"incident_id": incident.id})
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["weights"]["traffic_aware_eta"] == 0.4
        by_id = {item["google_place_id"]: item for item in data["hospitals"]}
        assert "full" not in by_id
        assert by_id["unmatched"]["available_beds"] is None
        assert by_id["unmatched"]["capacity_source"] == "unknown"
        assert by_id["unmatched"]["capacity_is_simulated"] is None
        verified = by_id["matched"]
        assert verified["available_beds"] == 12
        assert verified["capacity_source"] == "CityMind simulated operational data"
        assert verified["capacity_is_simulated"] is True
        assert verified["data_provenance"]["mapping_verified"] is True
        assert verified["icu_available"] is None
        assert any("older than 15 minutes" in warning for warning in verified["stale_data_warnings"])
        assert verified["overall_score"] > by_id["unmatched"]["overall_score"]
        assert set(verified["score_breakdown"]) == {
            "traffic_aware_eta", "required_capability_compatibility", "available_beds",
            "icu_availability", "distance",
        }
    finally:
        for mapping in mappings:
            db.delete(mapping)
        db.delete(matched); db.delete(incompatible); db.delete(incident); db.commit(); db.close()


def test_rank_live_rejects_non_medical_incident():
    db = SessionLocal()
    incident = Incident(title="P5 traffic", description="test", category="Traffic Congestion",
        severity="High", status="Reported", latitude=12.3, longitude=76.64,
        responding_department="Traffic")
    db.add(incident); db.commit()
    try:
        with TestClient(app) as client:
            response = client.post("/api/hospitals/rank-live", json={"incident_id": incident.id})
        assert response.status_code == 422
    finally:
        db.delete(incident); db.commit(); db.close()
