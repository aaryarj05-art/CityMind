from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import schemas, models

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])

@router.get("", response_model=List[schemas.Hospital])
def read_hospitals(db: Session = Depends(get_db)):
    return db.query(models.Hospital).all()

@router.get("/{hospital_id}", response_model=schemas.Hospital)
def read_hospital(hospital_id: int, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return hospital
