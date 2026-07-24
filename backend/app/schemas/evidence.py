from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.citizen_report import EyewitnessEvidence


class EvidenceSource(BaseModel):
    publisher_name: str
    title: str
    url: str
    publication_time: datetime | None = None
    provider: str
    source_type: Literal["news", "government", "rss"] = "news"
    credibility_score: float = Field(ge=0, le=1)
    relevance_score: float = Field(ge=0, le=1)
    is_official: bool = False


class EvidenceTimelineItem(BaseModel):
    timestamp: datetime
    label: str
    publisher_name: str | None = None
    url: str | None = None


class IncidentEvidence(BaseModel):
    incident_id: int
    incident_title: str
    location: str
    incident_time: datetime
    verification_status: str
    confidence_score: int = Field(ge=0, le=100)
    primary_source: EvidenceSource | None = None
    verified_by: list[EvidenceSource]
    trust_reasons: list[str]
    evidence_timeline: list[EvidenceTimelineItem]
    last_updated: datetime
    banner: str
    single_source: bool = False
    provider_errors: list[str] = []
    eyewitness_evidence: list[EyewitnessEvidence] = []


class IncidentConfidence(BaseModel):
    incident_id: int
    confidence_score: int = Field(ge=0, le=100)
    verification_status: str
    trust_reasons: list[str]
    factors: dict[str, float]