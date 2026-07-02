from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EtaEstimate(BaseModel):
    base_travel_minutes: float
    delay_modifier: float
    estimated_arrival_minutes: float
    explanation: str


class ResourceCandidate(BaseModel):
    resource_id: int
    resource_code: str
    resource_type: str
    required_type: str
    eligible: bool
    rank: int | None
    distance_km: float
    eta: EtaEstimate
    suitability_score: float = Field(ge=0, le=100)
    factor_scores: dict[str, float]
    weighted_contributions: dict[str, float]
    reasons: list[str]


class HospitalCandidate(BaseModel):
    hospital_id: int
    hospital_name: str
    eligible: bool
    rank: int | None
    suitability_score: float = Field(ge=0, le=100)
    distance_km: float
    estimated_transport_minutes: float
    available_beds: int
    emergency_capacity: str
    expected_patient_demand: int
    factor_scores: dict[str, float]
    reasons: list[str]


class AllocationPlan(BaseModel):
    incident: dict[str, Any]
    required_resources: dict[str, int]
    candidates: list[ResourceCandidate]
    recommended_resources: list[ResourceCandidate]
    shortages: dict[str, int]
    hospital_recommendations: list[HospitalCandidate]
    plan_complete: bool
    explanation: str


class DispatchCreate(BaseModel):
    incident_id: int = Field(ge=1)
    selected_resource_ids: list[int] | None = None
    use_recommended_resources: bool = False
    selected_hospital_id: int | None = Field(default=None, ge=1)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def selection_is_explicit(self):
        if not self.use_recommended_resources and not self.selected_resource_ids:
            raise ValueError("Provide selected_resource_ids or approve recommended resources")
        if self.use_recommended_resources and self.selected_resource_ids:
            raise ValueError("Choose either selected resources or recommended resources, not both")
        if self.selected_resource_ids and len(set(self.selected_resource_ids)) != len(self.selected_resource_ids):
            raise ValueError("Resource IDs must be unique")
        return self


class DispatchStatusUpdate(BaseModel):
    status: Literal["Planned", "Dispatched", "En Route", "On Scene", "Transporting", "Completed", "Cancelled"]


class DispatchAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    resource_id: int
    resource_code: str
    role: str
    sequence: int
    distance_km: float
    estimated_arrival_minutes: float
    suitability_score: float
    status: str
    assigned_at: datetime
    released_at: datetime | None


class DispatchResponse(BaseModel):
    id: int
    dispatch_code: str
    incident_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    acknowledged_at: datetime | None
    en_route_at: datetime | None
    on_scene_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    selected_hospital_id: int | None
    plan_complete: bool
    notes: str | None
    estimated_arrival_minutes: float | None
    shortages: dict[str, int]
    assignments: list[DispatchAssignmentResponse]


class DispatchSummary(BaseModel):
    active_dispatch_count: int
    resources_currently_assigned: int
    average_eta: float
    incomplete_response_plan_count: int
    resource_shortages_by_type: dict[str, int]
    dispatches_by_status: dict[str, int]


class DemoResetResponse(BaseModel):
    dispatches_removed: int
    assignments_removed: int
    resources_restored: int
    incidents_restored: int
    hospital_beds_restored: int
    message: str
