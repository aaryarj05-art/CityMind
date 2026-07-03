from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


class HospitalExternalMapping(Base):
    __tablename__ = "hospital_external_mappings"

    id = Column(Integer, primary_key=True, index=True)
    citymind_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    google_place_id = Column(String, nullable=False, unique=True, index=True)
    google_name = Column(String, nullable=True)
    google_address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    match_confidence = Column(Float, nullable=True)
    verified = Column(Boolean, nullable=False, default=False)
    last_synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
