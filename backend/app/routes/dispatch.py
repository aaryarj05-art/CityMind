from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.allocation_rules import ACTIVE_DISPATCH_STATUSES
from app.database import get_db
from app.dependencies.auth import require_permission, require_user_or_internal_service
from app.models import Dispatch, DispatchAssignment, Incident
from app.schemas.dispatch import (AllocationPlan, DispatchCreate, DispatchResponse,
    DispatchStatusUpdate, DispatchSummary)
from app.services.allocation_engine import build_allocation_plan
from app.services.dispatch_service import (DispatchError, create_dispatch, dispatch_summary,
    serialize_dispatch, transition_dispatch)

allocation_router = APIRouter(prefix="/allocation", tags=["Resource Allocation"])
dispatch_router = APIRouter(prefix="/dispatches", tags=["Simulated Dispatches"])


def _raise(error: DispatchError):
    raise HTTPException(status_code=error.status_code, detail=error.message)


@allocation_router.get("/incidents/{incident_id}/plan", response_model=AllocationPlan)
def read_allocation_plan(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return build_allocation_plan(db, incident)


@dispatch_router.post("", response_model=DispatchResponse, status_code=201, dependencies=[Depends(require_permission("dispatch.approve"))])
def post_dispatch(request: DispatchCreate, db: Session = Depends(get_db)):
    try:
        return create_dispatch(db, request)
    except DispatchError as error:
        _raise(error)


@dispatch_router.get("/summary", response_model=DispatchSummary, dependencies=[Depends(require_user_or_internal_service("dispatch.read"))])
def read_dispatch_summary(db: Session = Depends(get_db)):
    return dispatch_summary(db)


@dispatch_router.get("", response_model=list[DispatchResponse], dependencies=[Depends(require_permission("dispatch.read"))])
def read_dispatches(
    status: Literal["Planned", "Dispatched", "En Route", "On Scene", "Transporting", "Completed", "Cancelled"] | None = None,
    incident_id: int | None = Query(default=None, ge=1),
    resource_id: int | None = Query(default=None, ge=1),
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Dispatch)
    if status:
        query = query.filter(Dispatch.status == status)
    if incident_id:
        query = query.filter(Dispatch.incident_id == incident_id)
    if resource_id:
        query = query.join(DispatchAssignment).filter(DispatchAssignment.resource_id == resource_id)
    if active_only:
        query = query.filter(Dispatch.status.in_(ACTIVE_DISPATCH_STATUSES))
    return [serialize_dispatch(db, item) for item in query.order_by(Dispatch.created_at.desc()).distinct().all()]


@dispatch_router.get("/{dispatch_id}", response_model=DispatchResponse, dependencies=[Depends(require_permission("dispatch.read"))])
def read_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return serialize_dispatch(db, dispatch)


@dispatch_router.patch("/{dispatch_id}/status", response_model=DispatchResponse, dependencies=[Depends(require_permission("dispatch.approve"))])
def patch_dispatch_status(dispatch_id: int, request: DispatchStatusUpdate, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    try:
        return transition_dispatch(db, dispatch, request.status)
    except DispatchError as error:
        _raise(error)


@dispatch_router.post("/{dispatch_id}/cancel", response_model=DispatchResponse, dependencies=[Depends(require_permission("dispatch.approve"))])
def cancel_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    try:
        return transition_dispatch(db, dispatch, "Cancelled")
    except DispatchError as error:
        _raise(error)


@dispatch_router.post("/{dispatch_id}/complete", response_model=DispatchResponse, dependencies=[Depends(require_permission("dispatch.approve"))])
def complete_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    try:
        return transition_dispatch(db, dispatch, "Completed")
    except DispatchError as error:
        _raise(error)
