"""Google hospital discovery and deterministic CityMind operational ranking."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.allocation_rules import MEDICAL_INCIDENT_CATEGORIES
from app.database import get_db
from app.models import Hospital, HospitalExternalMapping, Incident
from app.schemas.hospitals_google import (
    LiveHospitalRankingRequest,
    LiveHospitalRankingResponse,
    NearbyHospitalResponse,
)
from app.services.google_places_service import PlacesUnavailableError, search_nearby_hospitals
from app.services.google_routes_service import compute_route
from app.services.hospital_matcher import expected_patient_demand
from app.services.risk_engine import clamp

router = APIRouter(prefix="/hospitals", tags=["Google Hospitals"])

RANKING_WEIGHTS = {
    "traffic_aware_eta": 0.40,
    "required_capability_compatibility": 0.25,
    "available_beds": 0.20,
    "icu_availability": 0.10,
    "distance": 0.05,
}
CAPACITY_STALE_AFTER = timedelta(minutes=15)


def _places_error(exc: PlacesUnavailableError) -> HTTPException:
    return HTTPException(status_code=503, detail={
        "code": exc.code,
        "message": exc.message,
        "source": "Google Places API",
        "retryable": True,
    })


@router.get("/nearby", response_model=NearbyHospitalResponse)
async def nearby_hospitals(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius: int = Query(default=10000, gt=0, le=50000),
    limit: int = Query(default=10, gt=0, le=20),
):
    try:
        return await search_nearby_hospitals(latitude, longitude, radius, limit)
    except PlacesUnavailableError as exc:
        raise _places_error(exc) from None


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _component(score: float, weight: float) -> dict:
    score = round(clamp(score), 2)
    return {"weight": weight, "score": score, "weighted_score": round(score * weight, 2)}


def _capacity_compatibility(hospital: Hospital, demand: int) -> bool:
    return (
        hospital.status == "Online"
        and hospital.available_beds >= demand
        and hospital.emergency_capacity != "Full"
    )


@router.post("/rank-live", response_model=LiveHospitalRankingResponse)
async def rank_live_hospitals(
    request: LiveHospitalRankingRequest,
    db: Session = Depends(get_db),
):
    incident = db.get(Incident, request.incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.category not in MEDICAL_INCIDENT_CATEGORIES:
        raise HTTPException(status_code=422, detail="Live hospital ranking requires a medical transport incident")
    try:
        discovered = await search_nearby_hospitals(
            incident.latitude, incident.longitude, radius=10000, limit=request.limit
        )
    except PlacesUnavailableError as exc:
        raise _places_error(exc) from None

    places = discovered["hospitals"][:request.limit]
    place_ids = [place["google_place_id"] for place in places]
    mappings = db.query(HospitalExternalMapping).filter(
        HospitalExternalMapping.google_place_id.in_(place_ids),
        HospitalExternalMapping.verified.is_(True),
    ).all() if place_ids else []
    verified = {mapping.google_place_id: mapping for mapping in mappings}
    demand = expected_patient_demand(incident.severity)
    now = datetime.now(timezone.utc)
    required_capability = f"online emergency intake with at least {demand} available bed(s)"
    ranked = []

    for place in places:
        mapping = verified.get(place["google_place_id"])
        citymind = db.get(Hospital, mapping.citymind_hospital_id) if mapping else None
        mapping_verified = mapping is not None and citymind is not None
        # No fuzzy/name match is trusted. Only a verified external mapping unlocks capacity.
        if mapping_verified and not _capacity_compatibility(citymind, demand):
            continue
        route = await compute_route(
            {"latitude": incident.latitude, "longitude": incident.longitude},
            {"latitude": place["latitude"], "longitude": place["longitude"]},
        )
        if mapping_verified:
            compatible = True
            total_beds = citymind.total_beds
            available_beds = citymind.available_beds
            capacity_source = "CityMind simulated operational data"
            capacity_timestamp = _aware(citymind.last_updated)
            capacity_is_simulated = True
            capability_score = 100.0
            beds_score = clamp(available_beds / 25 * 100)
        else:
            compatible = None
            total_beds = available_beds = None
            capacity_source = "unknown"
            capacity_timestamp = None
            capacity_is_simulated = None
            capability_score = beds_score = 0.0

        # CityMind has no verified ICU field; null and zero-score are deliberate.
        icu_available = None
        eta_score = clamp(100 - route["traffic_duration_seconds"] / 3600 * 100)
        distance_score = clamp(100 - route["distance_meters"] / 50000 * 100)
        components = {
            "traffic_aware_eta": _component(eta_score, RANKING_WEIGHTS["traffic_aware_eta"]),
            "required_capability_compatibility": _component(
                capability_score, RANKING_WEIGHTS["required_capability_compatibility"]
            ),
            "available_beds": _component(beds_score, RANKING_WEIGHTS["available_beds"]),
            "icu_availability": _component(0.0, RANKING_WEIGHTS["icu_availability"]),
            "distance": _component(distance_score, RANKING_WEIGHTS["distance"]),
        }
        overall = round(sum(item["weighted_score"] for item in components.values()), 2)
        warnings = []
        if capacity_timestamp and now - capacity_timestamp > CAPACITY_STALE_AFTER:
            warnings.append("CityMind capacity data is older than 15 minutes.")
        if not mapping_verified:
            warnings.append("No verified CityMind mapping; capacity and capability remain unknown.")
        warnings.append("ICU availability is not tracked by the current CityMind hospital model.")
        if not route["live_data"]:
            warnings.append("Traffic-aware routing was unavailable; ETA is a CityMind fixed-speed estimate.")
        reason = (
            f"Verified CityMind capacity with {available_beds} available bed(s); ranked by deterministic ETA, capability, capacity, ICU, and distance weights."
            if mapping_verified else
            "Google identity is unmatched; ranked using route and distance only, with capacity and capability left unknown."
        )
        ranked.append({
            "google_place_id": place["google_place_id"],
            "citymind_hospital_id": citymind.id if mapping_verified else None,
            "name": place["name"], "address": place["formatted_address"],
            "latitude": place["latitude"], "longitude": place["longitude"],
            "traffic_duration_seconds": route["traffic_duration_seconds"],
            "distance_meters": route["distance_meters"],
            "required_capability_compatible": compatible,
            "total_beds": total_beds, "available_beds": available_beds,
            "icu_available": icu_available, "capacity_source": capacity_source,
            "capacity_timestamp": capacity_timestamp,
            "capacity_is_simulated": capacity_is_simulated,
            "overall_score": overall, "score_breakdown": components,
            "recommendation_reason": reason,
            "data_provenance": {
                "identity_source": "Google Places",
                "routing_source": route["source"],
                "capacity_source": capacity_source,
                "mapping_verified": mapping_verified,
            },
            "stale_data_warnings": warnings,
        })
    ranked.sort(key=lambda item: (-item["overall_score"], item["traffic_duration_seconds"], item["google_place_id"]))
    for rank, item in enumerate(ranked, 1):
        item["rank"] = rank
    return {
        "incident_id": incident.id,
        "required_capability": required_capability,
        "weights": RANKING_WEIGHTS,
        "hospitals": ranked,
        "retrieved_at": now,
    }
