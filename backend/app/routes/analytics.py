from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Area, Incident
from app.services.bigquery_analytics import bigquery_status, export_risk_snapshot
from app.services.risk_engine import ACTIVE_INCIDENT_STATUSES, calculate_all_area_risks, utc_now

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _current_risk_snapshot(db: Session) -> tuple[list[dict], object]:
    calculated_at = utc_now()
    area_risks = calculate_all_area_risks(db, calculated_at)
    active_counts = Counter(
        incident.area_id
        for incident in db.query(Incident).filter(Incident.status.in_(ACTIVE_INCIDENT_STATUSES)).all()
    )
    area_ids = {area.id for area in db.query(Area.id).all()}
    for risk in area_risks:
        if risk["area_id"] in area_ids:
            risk["active_incidents"] = active_counts.get(risk["area_id"], 0)
    return area_risks, calculated_at


@router.get("/bigquery/status")
def read_bigquery_status():
    return bigquery_status()


@router.post("/bigquery/export-snapshot")
def export_bigquery_snapshot(db: Session = Depends(get_db)):
    area_risks, calculated_at = _current_risk_snapshot(db)
    exported = export_risk_snapshot(area_risks, calculated_at=calculated_at)
    status = bigquery_status()
    return {
        **status,
        "export_available": status["status"] == "configured",
        "exported": exported,
        "row_count": len(area_risks) if exported else 0,
    }
