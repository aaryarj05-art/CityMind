from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import schemas, models
from app.services.dashboard_service import get_dashboard_summary, get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=schemas.DashboardSummary)
def read_dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)

@router.get("", response_model=schemas.DashboardData)
def read_dashboard_data(db: Session = Depends(get_db)):
    return get_dashboard_data(db)
