"""Traffic-aware route endpoints with deterministic fallback behavior."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.allocation_rules import required_resources
from app.database import get_db
from app.models import Dispatch, DispatchAssignment, Incident, Resource
from app.schemas.maps import RouteMatrixRequest, RouteMatrixResponse, RouteRequest, RouteResponse
from app.services.allocation_engine import ACTIVE, resource_eligibility
from app.services.google_routes_service import compute_route, compute_route_matrix

router = APIRouter(prefix="/maps", tags=["Google Maps"])


@router.post("/route", response_model=RouteResponse)
async def route(request: RouteRequest):
    return await compute_route(request.origin.model_dump(), request.destination.model_dump())


def _matrix_origins(db: Session, request: RouteMatrixRequest) -> list[dict]:
    incident = None
    required_types = None
    if request.incident_id is not None:
        incident = db.get(Incident, request.incident_id)
        if incident is None:
            raise HTTPException(status_code=404, detail="Incident not found")
        required_types = set(required_resources(incident.category, incident.severity))
    if request.required_resource_type:
        required_types = {request.required_resource_type}

    requested = {origin.resource_id: origin for origin in request.origins}
    resources = db.query(Resource).filter(Resource.resource_code.in_(requested)).all()
    eligible = []
    for resource in resources:
        if required_types is not None and resource.resource_type not in required_types:
            continue
        if incident is not None:
            is_eligible, _ = resource_eligibility(db, resource, incident, resource.resource_type)
            if not is_eligible:
                continue
        else:
            active = (
                db.query(DispatchAssignment)
                .join(Dispatch)
                .filter(
                    DispatchAssignment.resource_id == resource.id,
                    Dispatch.status.in_(ACTIVE),
                )
                .first()
            )
            if resource.status != "Available" or resource.assigned_incident_id is not None or active:
                continue
        origin = requested[resource.resource_code]
        eligible.append({
            "resource_id": resource.resource_code,
            "latitude": origin.latitude,
            "longitude": origin.longitude,
        })
    return eligible


@router.post("/route-matrix", response_model=RouteMatrixResponse)
async def route_matrix(request: RouteMatrixRequest, db: Session = Depends(get_db)):
    origins = _matrix_origins(db, request)
    if not origins:
        return {
            "rankings": [],
            "retrieved_at": datetime.now(timezone.utc),
            "fallback_used": False,
            "warning": {
                "code": "no_eligible_resources",
                "message": "No requested resources satisfy CityMind eligibility constraints.",
            },
        }
    return await compute_route_matrix(origins, request.destination.model_dump())
