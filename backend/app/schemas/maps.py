"""Validated API contracts for Google routing with CityMind fallbacks."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CoordinatePoint(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class FallbackWarning(BaseModel):
    code: str
    message: str


class RouteRequest(BaseModel):
    origin: CoordinatePoint
    destination: CoordinatePoint


class RouteResponse(BaseModel):
    distance_meters: int
    traffic_duration_seconds: int
    static_duration_seconds: int
    traffic_delay_seconds: int
    congestion_ratio: float
    congestion_level: Literal["low", "moderate", "heavy", "severe"]
    encoded_polyline: str | None = None
    source: str
    live_data: bool
    retrieved_at: datetime
    fallback_used: bool
    warning: FallbackWarning | None = None


class RouteMatrixOrigin(CoordinatePoint):
    resource_id: str = Field(min_length=1, max_length=100)


class RouteMatrixRequest(BaseModel):
    origins: list[RouteMatrixOrigin] = Field(min_length=1, max_length=50)
    destination: CoordinatePoint
    incident_id: int | None = Field(default=None, gt=0)
    required_resource_type: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_resource_ids(self):
        ids = [origin.resource_id for origin in self.origins]
        if len(ids) != len(set(ids)):
            raise ValueError("route-matrix resource_id values must be unique")
        return self


class RouteMatrixRanking(BaseModel):
    resource_id: str
    distance_meters: int
    traffic_duration_seconds: int
    static_duration_seconds: int
    traffic_delay_seconds: int
    rank: int
    source: str
    live_data: bool


class RouteMatrixResponse(BaseModel):
    rankings: list[RouteMatrixRanking]
    retrieved_at: datetime
    fallback_used: bool
    warning: FallbackWarning | None = None
