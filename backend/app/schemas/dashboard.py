from pydantic import BaseModel
from typing import List, Dict, Any
from .area import Area
from .incident import Incident
from .resource import Resource
from .hospital import Hospital

class DashboardSummary(BaseModel):
    active_incidents: int
    critical_zones: int
    available_ambulances: int
    available_police: int
    available_fire: int
    average_response_time: str
    feed_statuses: Dict[str, str]

class MapMarker(BaseModel):
    id: str
    type: str  # 'incident', 'hospital', 'resource', 'area'
    title: str
    latitude: float
    longitude: float
    status: str
    details: Dict[str, Any]

class DashboardData(BaseModel):
    summary: DashboardSummary
    priority_zones: List[Area]
    recent_incidents: List[Incident]
    resource_summary: Dict[str, Any]
    hospitals: List[Hospital]
    map_markers: List[MapMarker]
    analytics_preview: Dict[str, Any]
