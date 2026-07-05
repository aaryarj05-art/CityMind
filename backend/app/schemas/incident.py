from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class IncidentBase(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    status: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    responding_department: str

class IncidentCreate(IncidentBase):
    pass

class Incident(IncidentBase):
    id: int
    reported_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
