from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import schemas, models

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[schemas.Incident])
def read_incidents(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    area_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Incident)
    if category:
        query = query.filter(models.Incident.category == category)
    if severity:
        query = query.filter(models.Incident.severity == severity)
    if status:
        query = query.filter(models.Incident.status == status)
    if area_id:
        query = query.filter(models.Incident.area_id == area_id)
    return query.all()

@router.get("/{incident_id}", response_model=schemas.Incident)
def read_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident
