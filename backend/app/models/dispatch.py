from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_code = Column(String, unique=True, index=True, nullable=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="Dispatched", index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    en_route_at = Column(DateTime, nullable=True)
    on_scene_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    selected_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    plan_complete = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    estimated_arrival_minutes = Column(Float, nullable=True)
    shortages_json = Column(Text, default="{}", nullable=False)
    previous_incident_status = Column(String, nullable=False)
    reserved_beds = Column(Integer, default=0, nullable=False)
    hospital_beds_released = Column(Boolean, default=False, nullable=False)

    assignments = relationship("DispatchAssignment", back_populates="dispatch", cascade="all, delete-orphan")


class DispatchAssignment(Base):
    __tablename__ = "dispatch_assignments"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    sequence = Column(Integer, nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_arrival_minutes = Column(Float, nullable=False)
    suitability_score = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="Assigned")
    assigned_at = Column(DateTime, default=utc_now, nullable=False)
    released_at = Column(DateTime, nullable=True)
    previous_resource_status = Column(String, nullable=False, default="Available")

    dispatch = relationship("Dispatch", back_populates="assignments")
