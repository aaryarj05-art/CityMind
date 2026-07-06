from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ResourceBase(BaseModel):
    resource_code: str
    resource_type: str
    status: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    assigned_incident_id: Optional[int] = None
    capacity: Optional[str] = None
    category: str = "Municipal/Utility"
    unit_type: str = "Response Unit"
    base_id: Optional[int] = None
    base_name: Optional[str] = None
    capabilities: list[str] = Field(default_factory=list)
    crew_capacity: int = 2
    response_radius_km: float = 12.0
    priority_capabilities: list[str] = Field(default_factory=list)
    crew_available: bool = True
    simulated: bool = True


class ResourceCreate(ResourceBase):
    pass


class Resource(ResourceBase):
    id: int
    last_updated: datetime
    active_dispatch: dict | None = None

    model_config = ConfigDict(from_attributes=True)


class ResourceStatusUpdate(BaseModel):
    status: str


class ResourcePage(BaseModel):
    items: list[Resource]
    total: int
    page: int
    page_size: int
    total_pages: int
    filters: dict
    last_updated: datetime | None
    simulation_disclaimer: str
