from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base
from datetime import datetime, timezone

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    total_beds = Column(Integer)
    available_beds = Column(Integer)
    emergency_capacity = Column(String)
    status = Column(String)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))
