"""Contracts for Google hospital identity and deterministic live ranking."""

from datetime import datetime

from pydantic import BaseModel, Field


class NearbyHospital(BaseModel):
    google_place_id: str
    name: str | None = None
    formatted_address: str | None = None
    latitude: float
    longitude: float
    primary_type: str | None = None
    business_status: str | None = None
    national_phone_number: str | None = None
    website_uri: str | None = None
    google_maps_uri: str | None = None
    identity_source: str = "Google Places"
    retrieved_at: datetime


class NearbyHospitalResponse(BaseModel):
    hospitals: list[NearbyHospital]
    retrieved_at: datetime
    source: str = "Google Places API"
    live_data: bool = True
    notice: str = (
        "Google Places supplies identity and location data only; it does not confirm "
        "beds, ICU capability, or emergency admission."
    )


class LiveHospitalRankingRequest(BaseModel):
    incident_id: int = Field(gt=0)
    limit: int = Field(default=10, ge=1, le=20)


class DataProvenance(BaseModel):
    identity_source: str
    routing_source: str
    capacity_source: str
    mapping_verified: bool


class ScoreComponent(BaseModel):
    weight: float
    score: float
    weighted_score: float


class RankedHospital(BaseModel):
    rank: int
    google_place_id: str
    citymind_hospital_id: int | None = None
    name: str | None = None
    address: str | None = None
    latitude: float
    longitude: float
    traffic_duration_seconds: int
    distance_meters: int
    required_capability_compatible: bool | None
    total_beds: int | None = None
    available_beds: int | None = None
    icu_available: bool | None = None
    capacity_source: str
    capacity_timestamp: datetime | None = None
    capacity_is_simulated: bool | None = None
    overall_score: float
    score_breakdown: dict[str, ScoreComponent]
    recommendation_reason: str
    data_provenance: DataProvenance
    stale_data_warnings: list[str]


class LiveHospitalRankingResponse(BaseModel):
    incident_id: int
    required_capability: str
    weights: dict[str, float]
    hospitals: list[RankedHospital]
    retrieved_at: datetime
