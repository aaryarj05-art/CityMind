from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class HospitalBase(BaseModel):
    name: str
    area_id: Optional[int] = None
    latitude: float
    longitude: float
    total_beds: int
    available_beds: int
    emergency_capacity: str
    status: str
    facility_category: str = "Hospital"
    ownership: str = "Public"
    emergency_capability: bool = True
    trauma_capability: bool = False
    icu_capability: bool = False
    cardiac_capability: bool = False
    paediatric_capability: bool = False
    maternity_capability: bool = False
    emergency_bed_capacity: int = 0
    occupied_emergency_beds: int = 0
    icu_bed_capacity: int = 0
    available_icu_beds: int = 0
    diversion_status: str = "Accepting"
    blood_bank_available: bool = False
    ambulance_base_support: bool = False
    simulated: bool = True
    source_note: str | None = None


class HospitalCreate(HospitalBase):
    pass


class Hospital(HospitalBase):
    id: int
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)
