"""Transactional simulated-dispatch creation and lifecycle management."""

import json
from collections import Counter

from sqlalchemy.orm import Session

from app.config.allocation_rules import ACTIVE_DISPATCH_STATUSES, DISPATCH_TRANSITIONS, MEDICAL_INCIDENT_CATEGORIES, required_resources
from app.models import Dispatch, DispatchAssignment, Hospital, Incident, Resource
from app.models.dispatch import utc_now
from app.services.allocation_engine import build_allocation_plan, resource_eligibility
from app.services.hospital_matcher import expected_patient_demand


class DispatchError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        self.message, self.status_code = message, status_code
        super().__init__(message)


def serialize_dispatch(db: Session, dispatch: Dispatch) -> dict:
    assignments = []
    for assignment in sorted(dispatch.assignments, key=lambda item: item.sequence):
        resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
        assignments.append({"id": assignment.id, "resource_id": assignment.resource_id,
            "resource_code": resource.resource_code if resource else "Unknown", "role": assignment.role,
            "sequence": assignment.sequence, "distance_km": assignment.distance_km,
            "estimated_arrival_minutes": assignment.estimated_arrival_minutes,
            "suitability_score": assignment.suitability_score, "status": assignment.status,
            "assigned_at": assignment.assigned_at, "released_at": assignment.released_at})
    return {"id": dispatch.id, "dispatch_code": dispatch.dispatch_code, "incident_id": dispatch.incident_id,
        "status": dispatch.status, "created_at": dispatch.created_at, "updated_at": dispatch.updated_at,
        "acknowledged_at": dispatch.acknowledged_at, "en_route_at": dispatch.en_route_at,
        "on_scene_at": dispatch.on_scene_at, "completed_at": dispatch.completed_at,
        "cancelled_at": dispatch.cancelled_at, "selected_hospital_id": dispatch.selected_hospital_id,
        "plan_complete": dispatch.plan_complete, "notes": dispatch.notes,
        "estimated_arrival_minutes": dispatch.estimated_arrival_minutes,
        "shortages": json.loads(dispatch.shortages_json or "{}"), "assignments": assignments}


def create_dispatch(db: Session, request) -> dict:
    try:
        incident = db.query(Incident).filter(Incident.id == request.incident_id).first()
        if not incident:
            raise DispatchError("Incident not found", 404)
        if incident.status in {"Resolved", "Closed"}:
            raise DispatchError("Resolved or closed incidents cannot be dispatched")
        duplicate = db.query(Dispatch).filter(Dispatch.incident_id == incident.id, Dispatch.status.in_(ACTIVE_DISPATCH_STATUSES)).first()
        if duplicate:
            raise DispatchError(f"Incident already has active dispatch {duplicate.dispatch_code}")

        plan = build_allocation_plan(db, incident)
        selected_ids = ([item["resource_id"] for item in plan["recommended_resources"]]
            if request.use_recommended_resources else request.selected_resource_ids)
        if not selected_ids:
            raise DispatchError("No eligible resources are available for dispatch")
        candidates = {item["resource_id"]: item for item in plan["candidates"]}
        selected = []
        for resource_id in selected_ids:
            candidate = candidates.get(resource_id)
            resource = db.query(Resource).filter(Resource.id == resource_id).first()
            if not resource:
                raise DispatchError(f"Resource {resource_id} not found", 404)
            if not candidate or not candidate["eligible"]:
                raise DispatchError(f"Resource {resource.resource_code} is not eligible for this incident")
            eligible, reasons = resource_eligibility(db, resource, incident, candidate["required_type"])
            if not eligible:
                raise DispatchError(f"Resource {resource.resource_code} became unavailable: {' '.join(reasons)}")
            selected.append((resource, candidate))

        requirements = required_resources(incident.category, incident.severity)
        selected_counts = Counter(candidate["required_type"] for _, candidate in selected)
        for resource_type, count in selected_counts.items():
            if count > requirements.get(resource_type, 0):
                raise DispatchError(f"Too many {resource_type} resources selected")
        shortages = {resource_type: count - selected_counts.get(resource_type, 0)
            for resource_type, count in requirements.items() if selected_counts.get(resource_type, 0) < count}

        hospital, reserved_beds = None, 0
        hospital_id = request.selected_hospital_id
        eligible_hospitals = [item for item in plan["hospital_recommendations"] if item["eligible"]]
        if incident.category in MEDICAL_INCIDENT_CATEGORIES and hospital_id is None and eligible_hospitals:
            hospital_id = eligible_hospitals[0]["hospital_id"]
        if hospital_id is not None:
            match = next((item for item in eligible_hospitals if item["hospital_id"] == hospital_id), None)
            if incident.category not in MEDICAL_INCIDENT_CATEGORIES or not match:
                raise DispatchError("Selected hospital is not eligible for this incident")
            hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
            reserved_beds = expected_patient_demand(incident.severity)
            if hospital.available_beds < reserved_beds:
                raise DispatchError("Hospital capacity changed before dispatch creation")

        now = utc_now()
        dispatch = Dispatch(incident_id=incident.id, status="Dispatched", acknowledged_at=now,
            selected_hospital_id=hospital_id, plan_complete=not shortages, notes=request.notes,
            estimated_arrival_minutes=max(item[1]["eta"]["estimated_arrival_minutes"] for item in selected),
            shortages_json=json.dumps(shortages), previous_incident_status=incident.status,
            reserved_beds=reserved_beds)
        db.add(dispatch)
        db.flush()
        dispatch.dispatch_code = f"DSP-{dispatch.id:06d}"
        for sequence, (resource, candidate) in enumerate(selected, 1):
            db.add(DispatchAssignment(dispatch_id=dispatch.id, resource_id=resource.id,
                role=candidate["required_type"], sequence=sequence, distance_km=candidate["distance_km"],
                estimated_arrival_minutes=candidate["eta"]["estimated_arrival_minutes"],
                suitability_score=candidate["suitability_score"], previous_resource_status=resource.status))
            resource.status = "Dispatched"
            resource.assigned_incident_id = incident.id
        if hospital:
            hospital.available_beds -= reserved_beds
        incident.status = "Assigned"
        db.commit()
        db.refresh(dispatch)
        return serialize_dispatch(db, dispatch)
    except DispatchError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


def transition_dispatch(db: Session, dispatch: Dispatch, target_status: str) -> dict:
    if target_status not in DISPATCH_TRANSITIONS.get(dispatch.status, set()):
        raise DispatchError(f"Invalid dispatch transition from {dispatch.status} to {target_status}")
    now = utc_now()
    incident = db.query(Incident).filter(Incident.id == dispatch.incident_id).first()
    try:
        dispatch.status = target_status
        if target_status == "Dispatched":
            dispatch.acknowledged_at = now
        elif target_status == "En Route":
            dispatch.en_route_at = now
            incident.status = "In Progress"
        elif target_status == "On Scene":
            dispatch.on_scene_at = now
            incident.status = "In Progress"
            _set_resource_status(db, dispatch, "On Scene")
        elif target_status == "Transporting":
            incident.status = "In Progress"
        elif target_status == "Completed":
            dispatch.completed_at = now
            incident.status = "Resolved"
            _release_resources(db, dispatch, now)
        elif target_status == "Cancelled":
            dispatch.cancelled_at = now
            incident.status = dispatch.previous_incident_status
            _release_resources(db, dispatch, now)
            _release_hospital_beds(db, dispatch)
        db.commit()
        db.refresh(dispatch)
        return serialize_dispatch(db, dispatch)
    except Exception:
        db.rollback()
        raise


def _set_resource_status(db, dispatch, status):
    for assignment in dispatch.assignments:
        resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
        if resource:
            resource.status = status
            assignment.status = status


def _release_resources(db, dispatch, released_at):
    for assignment in dispatch.assignments:
        resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
        if resource and resource.assigned_incident_id == dispatch.incident_id:
            resource.status = assignment.previous_resource_status or "Available"
            resource.assigned_incident_id = None
        assignment.status = "Released"
        assignment.released_at = released_at


def _release_hospital_beds(db, dispatch):
    if dispatch.selected_hospital_id and dispatch.reserved_beds and not dispatch.hospital_beds_released:
        hospital = db.query(Hospital).filter(Hospital.id == dispatch.selected_hospital_id).first()
        if hospital:
            hospital.available_beds = min(hospital.total_beds, hospital.available_beds + dispatch.reserved_beds)
        dispatch.hospital_beds_released = True


def dispatch_summary(db: Session) -> dict:
    dispatches = db.query(Dispatch).all()
    active = [item for item in dispatches if item.status in ACTIVE_DISPATCH_STATUSES]
    shortages = Counter()
    for item in active:
        shortages.update(json.loads(item.shortages_json or "{}"))
    status_counts = Counter(item.status for item in dispatches)
    etas = [item.estimated_arrival_minutes for item in dispatches if item.estimated_arrival_minutes is not None]
    return {"active_dispatch_count": len(active),
        "resources_currently_assigned": db.query(Resource).filter(Resource.assigned_incident_id.isnot(None)).count(),
        "average_eta": round(sum(etas) / len(etas), 2) if etas else 0.0,
        "incomplete_response_plan_count": sum(not item.plan_complete for item in active),
        "resource_shortages_by_type": dict(shortages), "dispatches_by_status": dict(status_counts)}


def reset_demo(db: Session) -> dict:
    dispatches = db.query(Dispatch).order_by(Dispatch.id).all()
    assignments = db.query(DispatchAssignment).all()
    resources_restored = set()
    incidents_restored = set()
    beds_restored = 0
    try:
        for assignment in assignments:
            resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
            if resource:
                resource.status = assignment.previous_resource_status or "Available"
                resource.assigned_incident_id = None
                resources_restored.add(resource.id)
        for dispatch in dispatches:
            incident = db.query(Incident).filter(Incident.id == dispatch.incident_id).first()
            if incident and incident.id not in incidents_restored:
                incident.status = dispatch.previous_incident_status
                incidents_restored.add(incident.id)
            if dispatch.selected_hospital_id and dispatch.reserved_beds and not dispatch.hospital_beds_released:
                hospital = db.query(Hospital).filter(Hospital.id == dispatch.selected_hospital_id).first()
                if hospital:
                    hospital.available_beds = min(hospital.total_beds, hospital.available_beds + dispatch.reserved_beds)
                    beds_restored += dispatch.reserved_beds
        assignment_count, dispatch_count = len(assignments), len(dispatches)
        db.query(DispatchAssignment).delete(synchronize_session=False)
        db.query(Dispatch).delete(synchronize_session=False)
        db.commit()
        return {"dispatches_removed": dispatch_count, "assignments_removed": assignment_count,
            "resources_restored": len(resources_restored), "incidents_restored": len(incidents_restored),
            "hospital_beds_restored": beds_restored,
            "message": "Phase 3 simulated dispatch state was reset to its pre-dispatch baseline."}
    except Exception:
        db.rollback()
        raise
