from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)
