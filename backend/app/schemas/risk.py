from datetime import datetime
from typing import Dict, List

from pydantic import BaseModel, ConfigDict, Field


class ContributingFactor(BaseModel):
    factor: str
    score: float = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=1)
    contribution: float = Field(ge=0, le=100)


class AreaRisk(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    area_id: int
    area_name: str
    ward_number: str
    risk_score: float = Field(ge=0, le=100)
    risk_level: str
    factor_scores: Dict[str, float]
    factor_weights: Dict[str, float]
    weighted_contributions: Dict[str, float]
    top_contributing_factors: List[ContributingFactor]
    explanation: str
    recommended_priority_level: str
    last_calculated: datetime


class IncidentPriority(BaseModel):
    incident_id: int
    title: str
    area_id: int
    area_name: str
    severity: str
    status: str
    priority_score: float = Field(ge=0, le=100)
    priority_level: str
    component_scores: Dict[str, float]
    reasons: List[str]
    recommended_response_urgency: str
    last_calculated: datetime


class RiskSummary(BaseModel):
    critical_area_count: int
    high_risk_area_count: int
    average_city_risk_score: float = Field(ge=0, le=100)
    highest_risk_area: AreaRisk | None
    top_contributing_factor_city_wide: str | None
    immediate_priority_incident_count: int
    last_calculated: datetime
