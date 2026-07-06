from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class OperationalBase(Base):
    __tablename__ = "operational_bases"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    locality = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    simulated = Column(Boolean, nullable=False, default=True)


class SeedMetadata(Base):
    __tablename__ = "seed_metadata"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        Index("ix_resources_category_status", "category", "status"),
        Index("ix_resources_base_status", "base_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    resource_code = Column(String, unique=True, nullable=False, index=True)
    resource_type = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, default="Municipal/Utility", index=True)
    unit_type = Column(String, nullable=False, default="Response Unit", index=True)
    status = Column(String, nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True, index=True)
    base_id = Column(Integer, ForeignKey("operational_bases.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    assigned_incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    capacity = Column(String, nullable=True)
    capabilities_json = Column(Text, nullable=False, default="[]")
    crew_capacity = Column(Integer, nullable=False, default=2)
    response_radius_km = Column(Float, nullable=False, default=12.0)
    priority_capabilities_json = Column(Text, nullable=False, default="[]")
    crew_available = Column(Boolean, nullable=False, default=True)
    simulated = Column(Boolean, nullable=False, default=True)
    last_updated = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now, index=True)
