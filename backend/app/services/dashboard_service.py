"""Dynamic Overview aggregation derived from current database state."""

from __future__ import annotations

import os
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Area, Dispatch, Hospital, Incident, Resource
from app.runtime_config import judge_open_access
from app.schemas.dashboard import DashboardData, DashboardSummary, MapMarker
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.risk_engine import calculate_all_area_risks

ACTIVE_INCIDENTS = {"Reported", "Assigned", "In Progress"}
ACTIVE_DISPATCHES = {"Planned", "Dispatched", "En Route", "On Scene", "Transporting"}


def _counts(db: Session, model, column) -> dict[str, int]:
    return {str(value): int(count) for value, count in db.query(column, func.count(model.id)).group_by(column).all()}


def _aware(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def get_dashboard_summary(db: Session) -> DashboardSummary:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    incident_status = _counts(db, Incident, Incident.status)
    incident_severity = _counts(db, Incident, Incident.severity)
    active_incidents = sum(incident_status.get(status, 0) for status in ACTIVE_INCIDENTS)
    total_incidents = sum(incident_status.values())

    resource_status = _counts(db, Resource, Resource.status)
    resource_category_rows = db.query(Resource.category, Resource.status, func.count(Resource.id)).group_by(Resource.category, Resource.status).all()
    category_counts: dict[str, Counter] = defaultdict(Counter)
    for category, status, count in resource_category_rows:
        category_counts[category][status] = int(count)
    available_by_category = {category: counts.get("Available", 0) for category, counts in category_counts.items()}
    readiness_by_category = {category: {
        "total": sum(counts.values()), "available": counts.get("Available", 0),
        "readiness_percent": round(counts.get("Available", 0) / sum(counts.values()) * 100, 2) if sum(counts.values()) else 0.0,
    } for category, counts in category_counts.items()}
    total_resources = sum(resource_status.values())
    available_resources = resource_status.get("Available", 0)
    shortages = {category: max(0, max(1, round(values["total"] * 0.25)) - values["available"])
                 for category, values in readiness_by_category.items()}

    dispatch_status = _counts(db, Dispatch, Dispatch.status)
    total_dispatches = sum(dispatch_status.values())
    average_eta = db.query(func.avg(Dispatch.estimated_arrival_minutes)).scalar() or 0.0

    hospital = db.query(
        func.count(Hospital.id),
        func.sum(Hospital.emergency_bed_capacity), func.sum(Hospital.occupied_emergency_beds),
        func.sum(Hospital.available_beds), func.sum(Hospital.available_icu_beds),
    ).one()
    total_hospitals = int(hospital[0] or 0)
    emergency_capacity = int(hospital[1] or 0)
    occupied_emergency = int(hospital[2] or 0)
    accepting = db.query(func.count(Hospital.id)).filter(Hospital.status == "Online", Hospital.diversion_status == "Accepting").scalar() or 0
    diversion = db.query(func.count(Hospital.id)).filter(Hospital.diversion_status != "Accepting").scalar() or 0
    trauma_ready = db.query(func.count(Hospital.id)).filter(Hospital.trauma_capability.is_(True)).scalar() or 0
    cardiac_ready = db.query(func.count(Hospital.id)).filter(Hospital.cardiac_capability.is_(True)).scalar() or 0

    area_risks = calculate_all_area_risks(db, now)
    ranked = sorted(area_risks, key=lambda item: (-item["risk_score"], item["area_id"]))
    average_risk = round(sum(item["risk_score"] for item in area_risks) / len(area_risks), 2) if area_risks else 0.0
    critical_area_count = sum(item["risk_level"] == "Critical" for item in area_risks)
    high_area_count = sum(item["risk_level"] == "High" for item in area_risks)

    last_values = [value for value in (
        db.query(func.max(Incident.updated_at)).scalar(), db.query(func.max(Resource.last_updated)).scalar(),
        db.query(func.max(Hospital.last_updated)).scalar(), db.query(func.max(Dispatch.updated_at)).scalar(),
    ) if value is not None]
    last_updated = max((_aware(value) for value in last_values), default=now)
    freshness = max(0, int((now - last_updated).total_seconds()))
    degraded = freshness > 120

    return DashboardSummary(
        active_incidents=active_incidents,
        critical_zones=critical_area_count,
        available_ambulances=available_by_category.get("Ambulance", 0),
        available_police=available_by_category.get("Police", 0),
        available_fire=available_by_category.get("Fire/Rescue", 0),
        average_response_time=f"{round(float(average_eta), 1)} min" if average_eta else "No completed estimate",
        feed_statuses={"Traffic Data Feed": "Configured" if os.getenv("GOOGLE_MAPS_SERVER_API_KEY") else "Fallback",
            "Incident Reporting": "Online", "Hospital Capacity Feed": "Simulated", "Emergency Resource Feed": "Simulated"},
        total_incidents=total_incidents, open_incidents=active_incidents,
        immediate_incidents=db.query(func.count(Incident.id)).filter(Incident.status.in_(ACTIVE_INCIDENTS), Incident.severity == "Critical").scalar() or 0,
        critical_incidents=incident_severity.get("Critical", 0),
        high_priority_incidents=incident_severity.get("High", 0), medium_priority_incidents=incident_severity.get("Medium", 0),
        resolved_incidents=incident_status.get("Resolved", 0) + incident_status.get("Closed", 0),
        incidents_created_today=db.query(func.count(Incident.id)).filter(Incident.reported_at >= today).scalar() or 0,
        incidents_resolved_today=db.query(func.count(Incident.id)).filter(Incident.status.in_(["Resolved", "Closed"]), Incident.updated_at >= today).scalar() or 0,
        total_resources=total_resources, available_resources=available_resources,
        assigned_resources=resource_status.get("Assigned", 0), dispatched_resources=resource_status.get("Dispatched", 0),
        en_route_resources=resource_status.get("En Route", 0), on_scene_resources=resource_status.get("On Scene", 0),
        transporting_resources=resource_status.get("Transporting", 0), maintenance_resources=resource_status.get("Maintenance", 0),
        reserve_resources=resource_status.get("Reserve", 0), unavailable_resources=resource_status.get("Unavailable", 0) + resource_status.get("Offline", 0),
        readiness_percent=round(available_resources / total_resources * 100, 2) if total_resources else 0.0,
        readiness_by_category=readiness_by_category, shortages_by_type=shortages, available_by_category=available_by_category,
        total_dispatches=total_dispatches, active_dispatches=sum(dispatch_status.get(status, 0) for status in ACTIVE_DISPATCHES),
        pending_dispatches=dispatch_status.get("Planned", 0), accepted_dispatches=dispatch_status.get("Dispatched", 0),
        en_route_dispatches=dispatch_status.get("En Route", 0), on_scene_dispatches=dispatch_status.get("On Scene", 0),
        completed_dispatches=dispatch_status.get("Completed", 0), cancelled_dispatches=dispatch_status.get("Cancelled", 0),
        average_city_risk=average_risk, highest_risk_area=ranked[0]["area_name"] if ranked else None,
        highest_risk_score=ranked[0]["risk_score"] if ranked else 0, high_risk_area_count=high_area_count,
        critical_risk_area_count=critical_area_count, city_risk_trend="stable", risk_last_calculated_at=now,
        total_hospitals=total_hospitals, hospitals_accepting_patients=int(accepting), hospitals_on_diversion=int(diversion),
        average_hospital_occupancy=round(occupied_emergency / emergency_capacity * 100, 2) if emergency_capacity else 0.0,
        available_emergency_beds=int(hospital[3] or 0), available_icu_beds=int(hospital[4] or 0),
        trauma_ready_hospitals=int(trauma_ready), cardiac_ready_hospitals=int(cardiac_ready),
        system_status="degraded" if degraded else "operational", api_status="online",
        adk_status="configured" if os.getenv("ADK_BASE_URL") else "local-default",
        maps_status="configured" if os.getenv("GOOGLE_MAPS_SERVER_API_KEY") else "fallback",
        last_updated=last_updated, data_freshness_seconds=freshness,
        data_source_note=SIMULATION_DISCLAIMER, simulation_mode=True, judge_mode=judge_open_access(),
    )


def get_dashboard_data(db: Session) -> DashboardData:
    summary = get_dashboard_summary(db)
    priority_zones = db.query(Area).order_by(Area.operational_score.desc()).limit(5).all()
    recent_incidents = db.query(Incident).order_by(Incident.reported_at.desc()).limit(10).all()
    hospitals = db.query(Hospital).order_by(Hospital.name).limit(8).all()
    resource_summary = {key: {"total": values["total"], "available": values["available"],
        "readiness_percent": values["readiness_percent"]}
        for key, values in summary.readiness_by_category.items()}
    legacy = {"Ambulance": "ambulances", "Police": "police", "Fire/Rescue": "fire", "Municipal/Utility": "municipal"}
    resource_summary = {legacy.get(key, key): value for key, value in resource_summary.items()}

    markers = [MapMarker(id=f"inc-{item.id}", type="incident", title=item.title,
        latitude=item.latitude, longitude=item.longitude, status=item.status,
        details={"category": item.category, "severity": item.severity}) for item in recent_incidents]
    markers += [MapMarker(id=f"hosp-{item.id}", type="hospital", title=item.name,
        latitude=item.latitude, longitude=item.longitude, status=item.diversion_status,
        details={"available_beds": item.available_beds, "available_icu_beds": item.available_icu_beds,
                 "capacity_simulated": True}) for item in hospitals]
    incident_categories = dict(db.query(Incident.category, func.count(Incident.id)).group_by(Incident.category).all())
    incident_severity = dict(db.query(Incident.severity, func.count(Incident.id)).group_by(Incident.severity).all())
    analytics = {"incident_categories": incident_categories, "incident_severity": incident_severity,
        "risk_distribution": dict(db.query(Area.status, func.count(Area.id)).group_by(Area.status).all()),
        "resource_readiness": summary.readiness_by_category,
        "dispatch_lifecycle": {key: value for key, value in _counts(db, Dispatch, Dispatch.status).items()},
        "hospital_load_percent": summary.average_hospital_occupancy,
        "provenance": {"resources": "simulated", "hospital_capacity": "simulated", "routes": "live when available, deterministic fallback otherwise"}}
    return DashboardData(summary=summary, priority_zones=priority_zones, recent_incidents=recent_incidents,
        resource_summary=resource_summary, hospitals=hospitals, map_markers=markers,
        analytics_preview=analytics, simulation_disclaimer=SIMULATION_DISCLAIMER)
