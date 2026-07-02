from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import schemas, models

router = APIRouter(prefix="/complaints", tags=["Complaints"])

@router.get("", response_model=List[schemas.Complaint])
def read_complaints(db: Session = Depends(get_db)):
    return db.query(models.Complaint).all()

@router.get("/{complaint_id}", response_model=schemas.Complaint)
def read_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint
