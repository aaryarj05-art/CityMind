"""Read-only deterministic resource allocation planner."""

from app.config.allocation_rules import (CAPACITY_LEVELS, MAX_ETA_FOR_SCORING_MINUTES,
    MEDICAL_INCIDENT_CATEGORIES, REQUIRED_CAPACITY, SUITABILITY_WEIGHTS, required_resources)
from app.models import Area, Dispatch, DispatchAssignment, Resource
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.distance_service import has_valid_coordinates, haversine_km
from app.services.eta_service import estimate_eta
from app.services.hospital_matcher import rank_hospitals
from app.services.risk_engine import clamp, normalize_rainfall, normalize_traffic

ACTIVE = ["Planned", "Dispatched", "En Route", "On Scene", "Transporting"]


def resource_eligibility(db, resource, incident, required_type: str,
                         active_resource_ids: set[int] | None = None) -> tuple[bool, list[str]]:
    reasons = []
    if resource.resource_type != required_type:
        reasons.append(f"Resource type does not match required {required_type}.")
    if resource.status != "Available":
        reasons.append(f"Resource status is {resource.status}, not Available.")
    if resource.assigned_incident_id is not None:
        reasons.append("Resource is already assigned to an incident.")
    if not has_valid_coordinates(resource.latitude, resource.longitude):
        reasons.append("Resource coordinates are invalid.")
    required_capacity = REQUIRED_CAPACITY.get(incident.category, "Standard")
    if CAPACITY_LEVELS.get(resource.capacity or "", 0) < CAPACITY_LEVELS[required_capacity]:
        reasons.append(f"Resource capacity does not meet required {required_capacity} level.")
    active_assignment = (resource.id in active_resource_ids) if active_resource_ids is not None else bool(
        db.query(DispatchAssignment.id).join(Dispatch).filter(
            DispatchAssignment.resource_id == resource.id, Dispatch.status.in_(ACTIVE)).first())
    if active_assignment:
        reasons.append("Resource belongs to another active dispatch.")
    return not reasons, reasons


def score_resource(db, resource, incident, area, required_type: str,
                   active_resource_ids: set[int] | None = None) -> dict:
    eligible, reasons = resource_eligibility(db, resource, incident, required_type, active_resource_ids)
    valid_coords = has_valid_coordinates(resource.latitude, resource.longitude)
    if valid_coords:
        distance = haversine_km(incident.latitude, incident.longitude, resource.latitude, resource.longitude)
        eta = estimate_eta(distance, resource.resource_type, area.traffic_level, area.rainfall, incident.severity)
    else:
        distance = 0.0
        eta = {"base_travel_minutes": 0.0, "delay_modifier": 1.0,
            "estimated_arrival_minutes": MAX_ETA_FOR_SCORING_MINUTES,
            "explanation": "ETA unavailable because coordinates are invalid."}
    required_capacity = REQUIRED_CAPACITY.get(incident.category, "Standard")
    factors = {
        "eta": clamp(100 - eta["estimated_arrival_minutes"] / MAX_ETA_FOR_SCORING_MINUTES * 100),
        "readiness": 100.0 if resource.status == "Available" and resource.assigned_incident_id is None else 0.0,
        "type_match": 100.0 if resource.resource_type == required_type else 0.0,
        "capacity": 100.0 if CAPACITY_LEVELS.get(resource.capacity or "", 0) >= CAPACITY_LEVELS[required_capacity] else 0.0,
        "area_conditions": clamp(100 - (normalize_traffic(area.traffic_level) + normalize_rainfall(area.rainfall)) / 2),
    }
    contributions = {key: round(factors[key] * weight, 2) for key, weight in SUITABILITY_WEIGHTS.items()}
    score = round(clamp(sum(contributions.values())), 2) if eligible else 0.0
    if eligible:
        reasons = [f"{resource.resource_code} is an available {required_type} at {distance:.2f} km with sufficient {resource.capacity or 'unspecified'} capacity and an estimated arrival time of {eta['estimated_arrival_minutes']:.2f} minutes."]
    return {"resource_id": resource.id, "resource_code": resource.resource_code,
        "resource_type": resource.resource_type, "required_type": required_type,
        "eligible": eligible, "rank": None, "distance_km": distance, "eta": eta,
        "suitability_score": score, "factor_scores": {k: round(v, 2) for k, v in factors.items()},
        "weighted_contributions": contributions, "reasons": reasons}


def build_allocation_plan(db, incident) -> dict:
    area = db.get(Area, incident.area_id)
    if area is None:
        raise ValueError("Incident area not found")
    requirements = required_resources(incident.category, incident.severity)
    resources = db.query(Resource).filter(Resource.resource_type.in_(requirements.keys())).all() if requirements else []
    active_resource_ids = {row[0] for row in db.query(DispatchAssignment.resource_id).join(Dispatch).filter(
        Dispatch.status.in_(ACTIVE)).distinct().all()}
    candidates, recommended, shortages = [], [], {}
    for resource_type, count in requirements.items():
        ranked = [score_resource(db, resource, incident, area, resource_type, active_resource_ids)
                  for resource in resources if resource.resource_type == resource_type]
        ranked.sort(key=lambda item: (not item["eligible"], -item["suitability_score"], item["distance_km"], item["resource_id"]))
        eligible = [item for item in ranked if item["eligible"]]
        for rank, item in enumerate(eligible, 1): item["rank"] = rank
        chosen = eligible[:count]
        recommended.extend(chosen); candidates.extend(ranked)
        if len(chosen) < count: shortages[resource_type] = count - len(chosen)
    hospitals = rank_hospitals(db, incident, area) if incident.category in MEDICAL_INCIDENT_CATEGORIES else []
    complete = not shortages and bool(requirements)
    requirement_text = ", ".join(f"{count} {name}" for name, count in requirements.items()) or "no configured resources"
    return {"incident": {"id": incident.id, "title": incident.title, "category": incident.category,
        "severity": incident.severity, "status": incident.status, "area_id": incident.area_id},
        "required_resources": requirements, "candidates": candidates, "recommended_resources": recommended,
        "shortages": shortages, "hospital_recommendations": hospitals, "plan_complete": complete,
        "simulation_disclaimer": SIMULATION_DISCLAIMER,
        "provenance": {"availability": "simulated", "ranking": "deterministic", "route_shortlist_limit": 8},
        "explanation": f"The deterministic plan requires {requirement_text}. " +
            ("All requirements have eligible recommendations." if complete else "The plan is partial because one or more resource types are unavailable or unconfigured.")}
