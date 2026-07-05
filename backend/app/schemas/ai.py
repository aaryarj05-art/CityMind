from pydantic import BaseModel, Field


class AIQueryRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    session_id: str | None = None
    user_id: str | None = None  # Deprecated and deliberately ignored; identity comes from the JWT.


class AISecurityStatus(BaseModel):
    threat_level: str
    authorized: bool
    policy_checked: bool


class AIAuditMetadata(BaseModel):
    integrity_hash: str
    timestamp: str
    previous_hash: str
    model_version: str


class AIQueryResponse(BaseModel):
    session_id: str
    response: str
    agents_used: list[str]
    tools_used: list[str] = []
    grounded: bool
    decision_id: str
    security: AISecurityStatus
    audit: AIAuditMetadata
    assurance_level: str
    assurance_reasons: list[str]
    limitations: list[str]