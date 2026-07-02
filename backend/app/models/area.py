from sqlalchemy import Column, Integer, String, Float, DateTime
from app.database import Base
from datetime import datetime, timezone

class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ward_number = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    operational_score = Column(Integer)
    status = Column(String)
    traffic_level = Column(String)
    rainfall = Column(Float)
    complaint_count = Column(Integer)
    active_incident_count = Column(Integer)
    main_issue = Column(String)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))
