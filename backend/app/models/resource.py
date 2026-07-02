from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base
from datetime import datetime

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    resource_code = Column(String, index=True)
    resource_type = Column(String)
    status = Column(String)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    latitude = Column(Float)
    longitude = Column(Float)
    assigned_incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    capacity = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
