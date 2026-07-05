"""Deterministic and explainable area risk scoring."""

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from sqlalchemy.orm import Session

from app.config.risk_weights import (
    NEARBY_RADIUS_KM,
    NEUTRAL_HOSPITAL_LOAD,
    RISK_WEIGHTS,
)
from app.models import Area, Complaint, Hospital, Incident, Resource

ACTIVE_INCIDENT_STATUSES = {"Reported", "Assigned", "In Progress"}
AVAILABLE_RESOURCE_STATUS = "Available"
RESOURCE_TYPES = ("Ambulance", "Police Vehicle", "Fire Engine", "Municipal Unit")

TRAFFIC_LEVEL_SCORES = {
    "low": 20.0,
    "moderate": 45.0,
    "heavy": 75.0,
    "gridlock": 100.0,
}
SEVERITY_SCORES = {
    "low": 20.0,
    "moderate": 45.0,
    "medium": 45.0,
    "high": 75.0,
    "critical": 100.0,
}
FACTOR_LABELS = {
    "traffic": "traffic congestion",
    "rainfall": "rainfall",
    "incidents": "active incident severity",
    "complaints": "complaint volume",
    "hospital_load": "hospital load",
    "resource_shortage": "emergency resource shortage",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, float(value)))


def normalize_traffic(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    try:
        return round(clamp(float(value)), 2)
    except (TypeError, ValueError):
        return TRAFFIC_LEVEL_SCORES.get(str(value).strip().lower(), 0.0)


def normalize_rainfall(rainfall_mm: float | None) -> float:
    return round(clamp(rainfall_mm or 0.0), 2)


def normalize_complaints(count: int | None) -> float:
    return round(clamp((count or 0) / 25 * 100), 2)


def normalize_incident_severity(severity: str | None) -> float:
    return SEVERITY_SCORES.get(str(severity or "").strip().lower(), 0.0)


def combine_incident_scores(scores: list[float]) -> float:
    """Combine incidents as independent pressure: 100 * (1 - product(1-s/100))."""
    remaining_capacity = 1.0
    for score in scores:
        remaining_capacity *= 1.0 - clamp(score) / 100.0
    return round(clamp(100.0 * (1.0 - remaining_capacity)), 2)


def normalize_hospital_load(total_beds: int, available_beds: int) -> float:
    if total_beds <= 0:
        return NEUTRAL_HOSPITAL_LOAD
    occupancy = (total_beds - clamp(available_beds, 0, total_beds)) / total_beds * 100
    return round(clamp(occupancy), 2)


def calculate_resource_shortage(resources: list[Resource]) -> float:
    """Average per-type shortage; a missing local type is fully short (100)."""
    shortages = []
    for resource_type in RESOURCE_TYPES:
        matching = [resource for resource in resources if resource.resource_type == resource_type]
        if not matching:
            shortages.append(100.0)
            continue
        available = sum(resource.status == AVAILABLE_RESOURCE_STATUS for resource in matching)
        shortages.append(100.0 * (1.0 - available / len(matching)))
    return round(clamp(sum(shortages) / len(shortages)), 2)


def classify_risk(score: float) -> str:
    score = clamp(score)
    if score <= 30:
        return "Low"
    if score <= 60:
        return "Moderate"
    if score <= 80:
        return "High"
    return "Critical"


def calculate_risk_score(factor_scores: dict[str, float]) -> tuple[float, dict[str, float]]:
    contributions = {
        factor: round(clamp(factor_scores.get(factor, 0.0)) * weight, 2)
        for factor, weight in RISK_WEIGHTS.items()
    }
    return round(clamp(sum(contributions.values())), 2), contributions


def rank_top_factors(
    factor_scores: dict[str, float], contributions: dict[str, float], limit: int = 3
) -> list[dict]:
    ranked = sorted(
        RISK_WEIGHTS,
        key=lambda factor: (-contributions[factor], list(RISK_WEIGHTS).index(factor)),
    )[:limit]
    return [
        {
            "factor": factor,
            "score": factor_scores[factor],
            "weight": RISK_WEIGHTS[factor],
            "contribution": contributions[factor],
        }
        for factor in ranked
    ]


def build_explanation(area_name: str, risk_level: str, top_factors: list[dict]) -> str:
    labels = [FACTOR_LABELS[item["factor"]] for item in top_factors]
    if len(labels) == 3:
        factors = f"{labels[0]}, {labels[1]}, and {labels[2]}"
    else:
        factors = " and ".join(labels)
    return (
        f"{area_name} is classified as {risk_level} because {factors} "
        "are the largest contributors to the current risk score."
    )


def recommended_area_priority(risk_level: str) -> str:
    return {
        "Low": "Routine monitoring",
        "Moderate": "Enhanced monitoring",
        "High": "Priority review",
        "Critical": "Immediate review",
    }[risk_level]


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return earth_radius_km * 2 * asin(sqrt(a))


def _nearby(area: Area, objects: list, radius_km: float = NEARBY_RADIUS_KM) -> list:
    return [
        item
        for item in objects
        if item.area_id == area.id
        or distance_km(area.latitude, area.longitude, item.latitude, item.longitude) <= radius_km
    ]


def calculate_area_risk(
    area: Area,
    incidents: list[Incident],
    complaints: list[Complaint],
    hospitals: list[Hospital],
    resources: list[Resource],
    calculated_at: datetime | None = None,
) -> dict:
    active_incidents = [
        incident
        for incident in incidents
        if incident.area_id == area.id and incident.status in ACTIVE_INCIDENT_STATUSES
    ]
    area_complaints = [complaint for complaint in complaints if complaint.area_id == area.id]
    nearby_hospitals = _nearby(area, hospitals)
    nearby_resources = _nearby(area, resources)

    if nearby_hospitals:
        total_beds = sum(hospital.total_beds for hospital in nearby_hospitals)
        available_beds = sum(hospital.available_beds for hospital in nearby_hospitals)
        hospital_load = normalize_hospital_load(total_beds, available_beds)
    else:
        hospital_load = NEUTRAL_HOSPITAL_LOAD

    factor_scores = {
        "traffic": normalize_traffic(area.traffic_level),
        "rainfall": normalize_rainfall(area.rainfall),
        "incidents": combine_incident_scores(
            [normalize_incident_severity(incident.severity) for incident in active_incidents]
        ),
        "complaints": normalize_complaints(len(area_complaints)),
        "hospital_load": hospital_load,
        "resource_shortage": calculate_resource_shortage(nearby_resources),
    }
    score, contributions = calculate_risk_score(factor_scores)
    risk_level = classify_risk(score)
    top_factors = rank_top_factors(factor_scores, contributions)
    return {
        "area_id": area.id,
        "area_name": area.name,
        "ward_number": area.ward_number,
        "risk_score": score,
        "risk_level": risk_level,
        "factor_scores": factor_scores,
        "factor_weights": dict(RISK_WEIGHTS),
        "weighted_contributions": contributions,
        "top_contributing_factors": top_factors,
        "explanation": build_explanation(area.name, risk_level, top_factors),
        "recommended_priority_level": recommended_area_priority(risk_level),
        "last_calculated": calculated_at or utc_now(),
    }


def calculate_all_area_risks(db: Session, calculated_at: datetime | None = None) -> list[dict]:
    calculated_at = calculated_at or utc_now()
    incidents = db.query(Incident).all()
    complaints = db.query(Complaint).all()
    hospitals = db.query(Hospital).all()
    resources = db.query(Resource).all()
    return [
        calculate_area_risk(area, incidents, complaints, hospitals, resources, calculated_at)
        for area in db.query(Area).all()
    ]
