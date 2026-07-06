from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from .area import Area
from .hospital import Hospital
from .incident import Incident


class DashboardSummary(BaseModel):
    # Backward-compatible Phase 1 fields.
    active_incidents: int
    critical_zones: int
    available_ambulances: int
    available_police: int
    available_fire: int
    average_response_time: str
    feed_statuses: Dict[str, str]

    total_incidents: int = 0
    open_incidents: int = 0
    immediate_incidents: int = 0
    critical_incidents: int = 0
    high_priority_incidents: int = 0
    medium_priority_incidents: int = 0
    resolved_incidents: int = 0
    incidents_created_today: int = 0
    incidents_resolved_today: int = 0

    total_resources: int = 0
    available_resources: int = 0
    assigned_resources: int = 0
    dispatched_resources: int = 0
    en_route_resources: int = 0
    on_scene_resources: int = 0
    transporting_resources: int = 0
    maintenance_resources: int = 0
    reserve_resources: int = 0
    unavailable_resources: int = 0
    readiness_percent: float = Field(default=0, ge=0, le=100)
    readiness_by_category: Dict[str, Any] = {}
    shortages_by_type: Dict[str, int] = {}
    available_by_category: Dict[str, int] = {}

    total_dispatches: int = 0
    active_dispatches: int = 0
    pending_dispatches: int = 0
    accepted_dispatches: int = 0
    en_route_dispatches: int = 0
    on_scene_dispatches: int = 0
    completed_dispatches: int = 0
    cancelled_dispatches: int = 0

    average_city_risk: float = 0
    highest_risk_area: str | None = None
    highest_risk_score: float = 0
    high_risk_area_count: int = 0
    critical_risk_area_count: int = 0
    city_risk_trend: str = "stable"
    risk_last_calculated_at: datetime | None = None

    total_hospitals: int = 0
    hospitals_accepting_patients: int = 0
    hospitals_on_diversion: int = 0
    average_hospital_occupancy: float = 0
    available_emergency_beds: int = 0
    available_icu_beds: int = 0
    trauma_ready_hospitals: int = 0
    cardiac_ready_hospitals: int = 0

    system_status: str = "operational"
    api_status: str = "online"
    adk_status: str = "configured"
    maps_status: str = "configured"
    last_updated: datetime
    data_freshness_seconds: int = 0
    data_source_note: str
    simulation_mode: bool = True
    judge_mode: bool = False


class MapMarker(BaseModel):
    id: str
    type: str
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
    simulation_disclaimer: str
