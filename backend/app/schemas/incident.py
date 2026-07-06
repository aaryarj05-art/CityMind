from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


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


class IncidentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    severity: str | None = None
    status: str | None = None
    area_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    responding_department: str | None = None


class Incident(IncidentBase):
    id: int
    reported_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
