from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CitizenReportMedia(BaseModel):
    id: int
    original_filename: str
    content_type: str
    media_url: str
    size_bytes: int
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CitizenReportResponse(BaseModel):
    id: int
    incident_id: int
    description: str
    latitude: float
    longitude: float
    readable_address: str | None = None
    verification_status: str
    match_status: str
    distance_to_incident_meters: float | None = None
    submitted_at: datetime
    media: list[CitizenReportMedia] = []
    model_config = ConfigDict(from_attributes=True)


class EyewitnessEvidence(BaseModel):
    report_id: int
    verification_status: str
    description: str
    latitude: float
    longitude: float
    readable_address: str | None = None
    submitted_at: datetime
    distance_from_incident_meters: float | None = None
    media: list[CitizenReportMedia]