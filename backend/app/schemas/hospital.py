from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class HospitalBase(BaseModel):
    name: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    total_beds: int
    available_beds: int
    emergency_capacity: str
    status: str

class HospitalCreate(HospitalBase):
    pass

class Hospital(HospitalBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True
