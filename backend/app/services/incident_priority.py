"""Deterministic incident-priority scoring without resource assignment."""

from datetime import datetime, timezone

from app.config.risk_weights import AVAILABLE_RESOURCE_TARGET, INCIDENT_PRIORITY_WEIGHTS
from app.models import Incident, Resource
from app.services.risk_engine import clamp, normalize_incident_severity, utc_now

STATUS_SCORES = {
    "reported": 100.0,
    "assigned": 70.0,
    "in progress": 50.0,
    "resolved": 10.0,
    "closed": 0.0,
}


def normalize_recency(reported_at: datetime, calculated_at: datetime | None = None) -> float:
    calculated_at = calculated_at or utc_now()
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (calculated_at - reported_at).total_seconds() / 3600)
    if age_hours <= 1:
        return 100.0
    return round(clamp((24.0 - age_hours) / 23.0 * 100), 2)


def normalize_incident_status(status: str | None) -> float:
    return STATUS_SCORES.get(str(status or "").strip().lower(), 0.0)


def normalize_resource_scarcity(available_count: int) -> float:
    return round(clamp((AVAILABLE_RESOURCE_TARGET - max(0, available_count)) / AVAILABLE_RESOURCE_TARGET * 100), 2)


def classify_priority(score: float) -> str:
    score = clamp(score)
    if score <= 30:
        return "Routine"
    if score <= 60:
        return "Elevated"
    if score <= 80:
        return "Urgent"
    return "Immediate"


def response_urgency(level: str) -> str:
    return {
        "Routine": "Review in the normal response queue",
        "Elevated": "Review promptly",
        "Urgent": "Expedite operational review",
        "Immediate": "Review immediately",
    }[level]


def build_priority_reasons(components: dict[str, float]) -> list[str]:
    labels = {
        "severity": "incident severity",
        "recency": "recent reporting time",
        "area_risk": "area risk",
        "status": "current incident status",
        "resource_scarcity": "nearby resource scarcity",
    }
    ranked = sorted(
        components,
        key=lambda name: (
            -(components[name] * INCIDENT_PRIORITY_WEIGHTS[name]),
            list(INCIDENT_PRIORITY_WEIGHTS).index(name),
        ),
    )[:3]
    return [f"{labels[name].capitalize()} contributes {components[name]:.2f}/100." for name in ranked]


def calculate_incident_priority(
    incident: Incident,
    area_risk: dict,
    nearby_resources: list[Resource],
    area_name: str,
    calculated_at: datetime | None = None,
) -> dict:
    calculated_at = calculated_at or utc_now()
    available_count = sum(resource.status == "Available" for resource in nearby_resources)
    components = {
        "severity": normalize_incident_severity(incident.severity),
        "recency": normalize_recency(incident.reported_at, calculated_at),
        "area_risk": clamp(area_risk["risk_score"]),
        "status": normalize_incident_status(incident.status),
        "resource_scarcity": normalize_resource_scarcity(available_count),
    }
    score = round(
        clamp(sum(components[name] * weight for name, weight in INCIDENT_PRIORITY_WEIGHTS.items())),
        2,
    )
    level = classify_priority(score)
    return {
        "incident_id": incident.id,
        "title": incident.title,
        "area_id": incident.area_id,
        "area_name": area_name,
        "severity": incident.severity,
        "status": incident.status,
        "priority_score": score,
        "priority_level": level,
        "component_scores": components,
        "reasons": build_priority_reasons(components),
        "recommended_response_urgency": response_urgency(level),
        "last_calculated": calculated_at,
    }
