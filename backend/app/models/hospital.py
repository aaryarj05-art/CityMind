from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Hospital(Base):
    __tablename__ = "hospitals"
    __table_args__ = (Index("ix_hospitals_status_diversion", "status", "diversion_status"),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    total_beds = Column(Integer, nullable=False)
    available_beds = Column(Integer, nullable=False)
    emergency_capacity = Column(String, nullable=False)
    status = Column(String, nullable=False, index=True)
    facility_category = Column(String, nullable=False, default="Hospital")
    ownership = Column(String, nullable=False, default="Public")
    emergency_capability = Column(Boolean, nullable=False, default=True)
    trauma_capability = Column(Boolean, nullable=False, default=False)
    icu_capability = Column(Boolean, nullable=False, default=False)
    cardiac_capability = Column(Boolean, nullable=False, default=False)
    paediatric_capability = Column(Boolean, nullable=False, default=False)
    maternity_capability = Column(Boolean, nullable=False, default=False)
    emergency_bed_capacity = Column(Integer, nullable=False, default=0)
    occupied_emergency_beds = Column(Integer, nullable=False, default=0)
    icu_bed_capacity = Column(Integer, nullable=False, default=0)
    available_icu_beds = Column(Integer, nullable=False, default=0)
    diversion_status = Column(String, nullable=False, default="Accepting", index=True)
    blood_bank_available = Column(Boolean, nullable=False, default=False)
    ambulance_base_support = Column(Boolean, nullable=False, default=False)
    simulated = Column(Boolean, nullable=False, default=True)
    source_note = Column(Text, nullable=True)
    last_updated = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now, index=True)
