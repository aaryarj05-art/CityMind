"""Tamper-evident prototype security telemetry."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    email = Column(String, nullable=True)
    role = Column(String, nullable=True, index=True)
    department = Column(String, nullable=True)
    session_id = Column(String, nullable=True, index=True)
    endpoint = Column(String, nullable=False, default="/api/ai/query")
    prompt_excerpt = Column(String, nullable=True)
    prompt_hash = Column(String, nullable=True, index=True)
    threat_level = Column(String, nullable=False, default="safe", index=True)
    risk_score = Column(Integer, nullable=False, default=0)
    categories_json = Column(Text, nullable=False, default="[]")
    reason_codes_json = Column(Text, nullable=False, default="[]")
    action = Column(String, nullable=False)
    blocked = Column(Boolean, nullable=False, default=False, index=True)
    agent_chain_json = Column(Text, nullable=False, default="[]")
    tools_used_json = Column(Text, nullable=False, default="[]")
    grounded = Column(Boolean, nullable=True)
    decision_id = Column(String, nullable=True, index=True)
    assurance_level = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    source_metadata_json = Column(Text, nullable=False, default="{}")
    limitations_json = Column(Text, nullable=False, default="[]")
    source_ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now, index=True)
    previous_hash = Column(String, nullable=False)
    integrity_hash = Column(String, nullable=False, unique=True)