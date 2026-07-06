from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies.auth import require_permission
from app.services.auth_service import AuthenticatedUser
from app.services.distance_service import has_valid_coordinates
from app.services.security_audit import append_security_event

router = APIRouter(prefix="/incidents", tags=["Incidents"])
VALID_STATUSES = {"Reported", "Assigned", "In Progress", "Resolved", "Closed"}
VALID_SEVERITIES = {"Low", "Medium", "High", "Critical"}


def _audit(db, request, current, action, incident_id):
    append_security_event(db, event_type="operational_approval", action=action, blocked=False,
        categories=["human_approval"], reason_codes=["INCIDENT_CHANGED_BY_AUTHENTICATED_USER"],
        user=current.user, session_id=str(current.claims.get("session_id", "")), endpoint=f"/api/incidents/{incident_id}",
        source_ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
        limitations=["This is an authenticated hackathon simulation action."])


@router.get("", response_model=List[schemas.Incident])
def read_incidents(category: Optional[str] = None, severity: Optional[str] = None,
    status: Optional[str] = None, area_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Incident)
    if category: query = query.filter(models.Incident.category == category)
    if severity: query = query.filter(models.Incident.severity == severity)
    if status: query = query.filter(models.Incident.status == status)
    if area_id: query = query.filter(models.Incident.area_id == area_id)
    return query.order_by(models.Incident.reported_at.desc()).all()


@router.post("", response_model=schemas.Incident, status_code=201)
def create_incident(payload: schemas.IncidentCreate, request: Request,
    current: AuthenticatedUser = Depends(require_permission("incidents.write")), db: Session = Depends(get_db)):
    if payload.status not in VALID_STATUSES or payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=422, detail="Invalid incident status or severity")
    if not has_valid_coordinates(payload.latitude, payload.longitude):
        raise HTTPException(status_code=422, detail="Invalid incident coordinates")
    area = db.get(models.Area, payload.area_id) if payload.area_id else None
    if payload.area_id and not area:
        raise HTTPException(status_code=404, detail="Area not found")
    incident = models.Incident(**payload.model_dump())
    db.add(incident)
    if area and payload.status not in {"Resolved", "Closed"}: area.active_incident_count += 1
    db.commit(); db.refresh(incident)
    _audit(db, request, current, "incident_created", incident.id)
    return incident


@router.patch("/{incident_id}", response_model=schemas.Incident)
def update_incident(incident_id: int, payload: schemas.IncidentUpdate, request: Request,
    current: AuthenticatedUser = Depends(require_permission("incidents.write")), db: Session = Depends(get_db)):
    incident = db.get(models.Incident, incident_id)
    if not incident: raise HTTPException(status_code=404, detail="Incident not found")
    changes = payload.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] not in VALID_STATUSES: raise HTTPException(status_code=422, detail="Invalid incident status")
    if "severity" in changes and changes["severity"] not in VALID_SEVERITIES: raise HTTPException(status_code=422, detail="Invalid incident severity")
    if "latitude" in changes or "longitude" in changes:
        if not has_valid_coordinates(changes.get("latitude", incident.latitude), changes.get("longitude", incident.longitude)):
            raise HTTPException(status_code=422, detail="Invalid incident coordinates")
    old_active = incident.status not in {"Resolved", "Closed"}
    old_area_id = incident.area_id
    for key, value in changes.items(): setattr(incident, key, value)
    incident.updated_at = datetime.now(timezone.utc)
    new_active = incident.status not in {"Resolved", "Closed"}
    if old_area_id:
        old_area = db.get(models.Area, old_area_id)
        if old_area and old_active: old_area.active_incident_count = max(0, old_area.active_incident_count - 1)
    if incident.area_id and new_active:
        new_area = db.get(models.Area, incident.area_id)
        if not new_area: raise HTTPException(status_code=404, detail="Area not found")
        new_area.active_incident_count += 1
    db.commit(); db.refresh(incident)
    _audit(db, request, current, "incident_updated", incident.id)
    return incident


@router.get("/{incident_id}", response_model=schemas.Incident)
def read_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(models.Incident, incident_id)
    if not incident: raise HTTPException(status_code=404, detail="Incident not found")
    return incident
