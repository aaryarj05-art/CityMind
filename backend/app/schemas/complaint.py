from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ComplaintBase(BaseModel):
    title: str
    description: str
    category: str
    priority: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    status: str

class ComplaintCreate(ComplaintBase):
    pass

class Complaint(ComplaintBase):
    id: int
    submitted_at: datetime

    class Config:
        from_attributes = True
