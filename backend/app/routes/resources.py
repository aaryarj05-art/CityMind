import json
import math
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies.auth import require_permission
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.auth_service import AuthenticatedUser
from app.services.distance_service import haversine_km
from app.services.security_audit import append_security_event

router = APIRouter(prefix="/resources", tags=["Resources"])
VALID_STATUSES = {"Available", "Assigned", "Dispatched", "En Route", "On Scene", "Transporting", "Returning", "Maintenance", "Reserve", "Unavailable", "Offline"}
SORT_COLUMNS = {"code": models.Resource.resource_code, "type": models.Resource.unit_type,
                "status": models.Resource.status, "category": models.Resource.category,
                "last_updated": models.Resource.last_updated}


def _serialize(resource, base_name=None):
    def parsed(value):
        try:
            result = json.loads(value or "[]")
            return result if isinstance(result, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    return {
        "id": resource.id, "resource_code": resource.resource_code,
        "resource_type": resource.resource_type, "category": resource.category,
        "unit_type": resource.unit_type, "status": resource.status,
        "area_id": resource.area_id, "base_id": resource.base_id, "base_name": base_name,
        "latitude": resource.latitude, "longitude": resource.longitude,
        "assigned_incident_id": resource.assigned_incident_id, "capacity": resource.capacity,
        "capabilities": parsed(resource.capabilities_json), "crew_capacity": resource.crew_capacity,
        "response_radius_km": resource.response_radius_km,
        "priority_capabilities": parsed(resource.priority_capabilities_json),
        "crew_available": resource.crew_available, "simulated": resource.simulated,
        "last_updated": resource.last_updated,
    }


@router.get("/bases")
def read_resource_bases(category: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.OperationalBase)
    if category:
        query = query.filter(models.OperationalBase.category == category)
    return [{"id": item.id, "name": item.name, "category": item.category,
             "locality": item.locality, "latitude": item.latitude,
             "longitude": item.longitude, "simulated": item.simulated}
            for item in query.order_by(models.OperationalBase.category, models.OperationalBase.name).all()]


@router.get("", response_model=list[schemas.Resource] | schemas.ResourcePage)
def read_resources(
    page: int | None = Query(default=None, ge=1),
    page_size: int | None = Query(default=None, ge=1, le=100),
    category: str | None = None, type: str | None = None, status: str | None = None,
    base_id: int | None = Query(default=None, ge=1), capability: str | None = None,
    search: str | None = None, sort_by: str = "code",
    sort_order: Literal["asc", "desc"] = "asc",
    nearby_latitude: float | None = Query(default=None, ge=-90, le=90),
    nearby_longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=100),
    area_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    query = db.query(models.Resource, models.OperationalBase.name).outerjoin(
        models.OperationalBase, models.Resource.base_id == models.OperationalBase.id)
    if category: query = query.filter(models.Resource.category == category)
    if type: query = query.filter(or_(models.Resource.resource_type == type, models.Resource.unit_type == type))
    if status: query = query.filter(models.Resource.status == status)
    if base_id: query = query.filter(models.Resource.base_id == base_id)
    if area_id: query = query.filter(models.Resource.area_id == area_id)
    if capability: query = query.filter(models.Resource.capabilities_json.ilike(f"%{capability.strip()}%"))
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(or_(models.Resource.resource_code.ilike(needle), models.Resource.unit_type.ilike(needle), models.OperationalBase.name.ilike(needle)))

    nearby = nearby_latitude is not None or nearby_longitude is not None or radius_km is not None
    if nearby and (nearby_latitude is None or nearby_longitude is None or radius_km is None):
        raise HTTPException(status_code=422, detail="nearby_latitude, nearby_longitude and radius_km must be provided together")

    if sort_by not in {*SORT_COLUMNS, "distance"}:
        raise HTTPException(status_code=422, detail="Unsupported sort_by value")
    if sort_by != "distance":
        column = SORT_COLUMNS[sort_by]
        query = query.order_by(desc(column) if sort_order == "desc" else asc(column), models.Resource.id)
    rows = query.all()
    serialized = [_serialize(resource, base_name) for resource, base_name in rows]
    if nearby:
        for item in serialized:
            item["distance_km"] = round(haversine_km(nearby_latitude, nearby_longitude, item["latitude"], item["longitude"]), 3)
        serialized = [item for item in serialized if item["distance_km"] <= radius_km]
        if sort_by == "distance":
            serialized.sort(key=lambda item: item["distance_km"], reverse=sort_order == "desc")

    if page is None and page_size is None:
        return serialized
    page, page_size = page or 1, page_size or 25
    total = len(serialized)
    start = (page - 1) * page_size
    last_updated = max((item["last_updated"] for item in serialized), default=None)
    return {"items": serialized[start:start + page_size], "total": total, "page": page,
            "page_size": page_size, "total_pages": math.ceil(total / page_size) if total else 0,
            "filters": {"category": category, "type": type, "status": status, "base_id": base_id,
                        "capability": capability, "search": search, "sort_by": sort_by, "sort_order": sort_order},
            "last_updated": last_updated, "simulation_disclaimer": SIMULATION_DISCLAIMER}


@router.get("/{resource_id}", response_model=schemas.Resource)
def read_resource(resource_id: int, db: Session = Depends(get_db)):
    row = db.query(models.Resource, models.OperationalBase.name).outerjoin(models.OperationalBase).filter(models.Resource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")
    return _serialize(*row)


@router.patch("/{resource_id}/status", response_model=schemas.Resource)
def update_resource_status(resource_id: int, payload: schemas.ResourceStatusUpdate, request: Request,
    current: AuthenticatedUser = Depends(require_permission("resources.write")), db: Session = Depends(get_db)):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid resource status")
    resource = db.get(models.Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.assigned_incident_id and payload.status in {"Available", "Reserve", "Maintenance", "Unavailable", "Offline"}:
        raise HTTPException(status_code=409, detail="An assigned resource must be released through its dispatch lifecycle")
    resource.status = payload.status
    resource.last_updated = datetime.now(timezone.utc)
    db.commit(); db.refresh(resource)
    append_security_event(db, event_type="operational_approval", action="resource_status_changed", blocked=False,
        categories=["human_approval"], reason_codes=["RESOURCE_STATUS_CHANGED_BY_AUTHENTICATED_USER"],
        user=current.user, session_id=str(current.claims.get("session_id", "")), endpoint=f"/api/resources/{resource_id}/status",
        source_ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
        limitations=[SIMULATION_DISCLAIMER])
    base = db.get(models.OperationalBase, resource.base_id) if resource.base_id else None
    return _serialize(resource, base.name if base else None)
