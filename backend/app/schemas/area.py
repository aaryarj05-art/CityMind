from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class AreaBase(BaseModel):
    name: str
    ward_number: str
    latitude: float
    longitude: float
    operational_score: int
    status: str
    traffic_level: str
    rainfall: float
    complaint_count: int
    active_incident_count: int
    main_issue: str

class AreaCreate(AreaBase):
    pass

class Area(AreaBase):
    id: int
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)
