"""Read-only security telemetry APIs."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_user_or_internal_service
from app.models import SecurityEvent
from app.services.security_audit import agent_health, grounding_metrics, security_summary, serialize_event, verify_audit_chain

router = APIRouter(
    prefix="/security",
    tags=["Security Operations"],
    dependencies=[Depends(require_user_or_internal_service("audit.read"))],
)


@router.get("/summary")
def read_security_summary(db: Session = Depends(get_db)):
    return security_summary(db)


@router.get("/events")
def read_security_events(
    event_type: str | None = None,
    threat_level: str | None = Query(default=None, pattern="^(safe|warning|critical)$"),
    blocked: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(SecurityEvent)
    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type)
    if threat_level:
        query = query.filter(SecurityEvent.threat_level == threat_level)
    if blocked is not None:
        query = query.filter(SecurityEvent.blocked.is_(blocked))
    if date_from:
        query = query.filter(SecurityEvent.created_at >= date_from)
    if date_to:
        query = query.filter(SecurityEvent.created_at <= date_to)
    total = query.count()
    records = query.order_by(SecurityEvent.id.desc()).offset(offset).limit(limit).all()
    return {"events": [serialize_event(item) for item in records], "total": total, "offset": offset, "limit": limit}


@router.get("/events/{event_id}")
def read_security_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Security event not found")
    return serialize_event(event)


@router.get("/audit-integrity")
def read_audit_integrity(db: Session = Depends(get_db)):
    return verify_audit_chain(db)


@router.get("/agent-health")
def read_agent_health(db: Session = Depends(get_db)):
    return agent_health(db)


@router.get("/grounding-metrics")
def read_grounding_metrics(db: Session = Depends(get_db)):
    return grounding_metrics(db)