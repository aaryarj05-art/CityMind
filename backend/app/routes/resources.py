from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import schemas, models

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.get("", response_model=List[schemas.Resource])
def read_resources(
    type: Optional[str] = None,
    status: Optional[str] = None,
    area_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Resource)
    if type:
        query = query.filter(models.Resource.resource_type == type)
    if status:
        query = query.filter(models.Resource.status == status)
    if area_id:
        query = query.filter(models.Resource.area_id == area_id)
    return query.all()

@router.get("/{resource_id}", response_model=schemas.Resource)
def read_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource
