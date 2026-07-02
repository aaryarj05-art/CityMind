from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import schemas, models

router = APIRouter(prefix="/areas", tags=["Areas"])

@router.get("", response_model=List[schemas.Area])
def read_areas(
    status: Optional[str] = None, 
    min_score: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    query = db.query(models.Area)
    if status:
        query = query.filter(models.Area.status == status)
    if min_score is not None:
        query = query.filter(models.Area.operational_score >= min_score)
    return query.all()

@router.get("/{area_id}", response_model=schemas.Area)
def read_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    return area
