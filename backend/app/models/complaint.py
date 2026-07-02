from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base
from datetime import datetime

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    category = Column(String)
    priority = Column(String)
    area_id = Column(Integer, ForeignKey("areas.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String)
    submitted_at = Column(DateTime, default=datetime.utcnow)
