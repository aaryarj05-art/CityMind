from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ResourceBase(BaseModel):
    resource_code: str
    resource_type: str
    status: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    assigned_incident_id: Optional[int] = None
    capacity: Optional[str] = None

class ResourceCreate(ResourceBase):
    pass

class Resource(ResourceBase):
    id: int
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)
