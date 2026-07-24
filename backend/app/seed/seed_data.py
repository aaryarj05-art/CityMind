"""Deterministic Mysuru operational simulation seed and explicit demo reset."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import (
    Area, Complaint, Dispatch, DispatchAssignment, Hospital, HospitalExternalMapping,
    Incident, OperationalBase, Resource, SeedMetadata,
)

SEED_VERSION = "mysuru-hackathon-2026.07"
SIMULATION_DISCLAIMER = (
    "Operational simulation seeded from public Mysuru facility directories. "
    "Vehicle availability, staffing and hospital capacity are simulated for prototype demonstration."
)
MYSURU_BOUNDS = {"min_lat": 12.20, "max_lat": 12.42, "min_lng": 76.52, "max_lng": 76.78}

AREA_DATA = [
    (1, "Kuvempunagar", "W-01", 12.2867, 76.6251, 42, "Moderate", "Moderate", 2.0, "Traffic"),
    (2, "Vijayanagara", "W-02", 12.3354, 76.6124, 55, "Moderate", "Heavy", 1.0, "Roadworks"),
    (3, "Hebbal", "W-03", 12.3671, 76.6068, 48, "Moderate", "Moderate", 0.0, "Industrial traffic"),
    (4, "Jayalakshmipuram", "W-04", 12.3237, 76.6195, 34, "Moderate", "Low", 0.0, "None"),
    (5, "Saraswathipuram", "W-05", 12.3002, 76.6291, 38, "Moderate", "Moderate", 3.0, "Drainage"),
    (6, "Nazarbad", "W-06", 12.3072, 76.6621, 68, "High", "Heavy", 1.0, "Event traffic"),
    (7, "Lashkar Mohalla", "W-07", 12.3160, 76.6557, 72, "High", "Heavy", 2.0, "Congestion"),
    (8, "Siddhartha Layout", "W-08", 12.2948, 76.6742, 46, "Moderate", "Moderate", 4.0, "Waterlogging"),
    (9, "Bannimantap", "W-09", 12.3375, 76.6590, 63, "High", "Heavy", 0.0, "Freight movement"),
    (10, "Hinkal", "W-10", 12.3371, 76.5862, 44, "Moderate", "Moderate", 0.0, "Roadworks"),
    (11, "Bogadi", "W-11", 12.3079, 76.5745, 29, "Low", "Low", 0.0, "None"),
    (12, "Alanahalli", "W-12", 12.2807, 76.6818, 57, "Moderate", "Moderate", 5.0, "Drainage"),
]

POLICE_BASE_NAMES = [
    "Devaraja Police Station", "Lashkar Police Station", "Nazarbad Police Station",
    "Udayagiri Police Station", "Alanahalli Police Station", "Narasimharaja Police Station",
    "Mandi Police Station", "Vanivilaspuram Police Station", "Jayalakshmipuram Police Station",
    "Metagally Police Station", "Vijayanagara Police Station", "Hebbal Police Station",
    "Krishnaraja Police Station", "Laxmipuram Police Station", "Ashokapuram Police Station",
    "Kuvempunagar Police Simulation Base", "Mysuru Police Control Room", "Traffic Police North",
    "Traffic Police South", "Women and Special Response Unit", "City Armed Reserve / Rapid Response Base",
]
FIRE_BASE_NAMES = [
    "Saraswathipuram Fire and Emergency Services", "Northern City Fire Response Base",
    "Eastern City Fire Response Base", "Bannimantap Industrial Response Base",
    "Outer-City Regional Rescue Base",
]
MUNICIPAL_BASE_NAMES = [
    "Mysuru Traffic Management Centre", "CESC Emergency Operations Base",
    "Vani Vilas Water Works Response Base", "MCC Road Clearance Depot",
    "District Mobile Command Base",
]

HOSPITAL_DATA = [
    ("K.R. Hospital", 12.3144, 76.6508, "Public", True, True, False, True, True),
    ("Cheluvamba Hospital", 12.3148, 76.6517, "Public", False, True, False, True, True),
    ("Mysuru District Hospital", 12.3086, 76.6551, "Public", True, True, False, True, True),
    ("Jayadeva Institute of Cardiovascular Sciences and Research", 12.2908, 76.6445, "Public", False, True, True, False, False),
    ("JSS Hospital", 12.2958, 76.6394, "Private", True, True, True, True, True),
    ("Apollo BGS Hospitals", 12.2950, 76.6125, "Private", True, True, True, True, True),
    ("Manipal Hospital Mysuru", 12.3252, 76.6274, "Private", True, True, True, True, True),
    ("Narayana Multispeciality Hospital", 12.2682, 76.6259, "Private", True, True, True, True, True),
    ("ESI Hospital", 12.3196, 76.6320, "Public", False, True, False, True, True),
    ("Railway Hospital", 12.3215, 76.6409, "Public", False, True, False, True, False),
    ("N.R. Mohalla PHC", 12.3257, 76.6662, "Public", False, False, False, True, True),
    ("Ashokapuram PHC", 12.2892, 76.6478, "Public", False, False, False, True, True),
    ("Lashkar Urban Health Facility", 12.3163, 76.6568, "Public", False, False, False, True, True),
    ("Bannimantap Urban Health Facility", 12.3400, 76.6584, "Public", False, False, False, True, True),
    ("Udayagiri Urban Health Facility", 12.3240, 76.6890, "Public", False, False, False, True, True),
    ("Hebbal Urban Health Facility", 12.3700, 76.6076, "Public", False, False, False, True, True),
    ("Kuvempunagar Health Facility", 12.2858, 76.6240, "Public", False, False, False, True, True),
    ("Vijayanagara Health Facility", 12.3360, 76.6113, "Public", False, False, False, True, True),
    ("Siddhartha Nagar Referral Centre", 12.2972, 76.6760, "Public", True, True, False, True, True),
]


def _base_coordinates(index: int, category: str) -> tuple[float, float]:
    anchors = {
        "Police": (12.305, 76.640), "Fire/Rescue": (12.310, 76.630),
        "Ambulance": (12.300, 76.645), "Municipal/Utility": (12.320, 76.635),
    }
    lat, lng = anchors[category]
    return round(lat + ((index % 7) - 3) * 0.009, 6), round(lng + ((index // 7) - 1) * 0.018, 6)


def _make_bases() -> list[OperationalBase]:
    records: list[OperationalBase] = []
    next_id = 1
    for category, names in (
        ("Police", POLICE_BASE_NAMES), ("Fire/Rescue", FIRE_BASE_NAMES),
        ("Ambulance", [item[0] for item in HOSPITAL_DATA[:12]]),
        ("Municipal/Utility", MUNICIPAL_BASE_NAMES),
    ):
        for index, name in enumerate(names):
            lat, lng = _base_coordinates(index, category)
            records.append(OperationalBase(id=next_id, name=name, category=category,
                locality=name.split()[0], latitude=lat, longitude=lng, simulated=True))
            next_id += 1
    return records


def _resource_record(resource_id: int, code: str, resource_type: str, category: str,
                     unit_type: str, status: str, base: OperationalBase, index: int,
                     capabilities: list[str], crew: int, capacity: str = "Standard") -> Resource:
    committed = status in {"Assigned", "Dispatched", "En Route", "On Scene", "Transporting"}
    return Resource(
        id=resource_id, resource_code=code, resource_type=resource_type, category=category,
        unit_type=unit_type, status=status, area_id=(index % len(AREA_DATA)) + 1,
        base_id=base.id, latitude=round(base.latitude + ((index % 3) - 1) * 0.0012, 6),
        longitude=round(base.longitude + (((index + 1) % 3) - 1) * 0.0012, 6),
        assigned_incident_id=(index % 8) + 1 if committed else None, capacity=capacity,
        capabilities_json=json.dumps(capabilities), crew_capacity=crew,
        response_radius_km=18.0 if category in {"Fire/Rescue", "Municipal/Utility"} else 12.0,
        priority_capabilities_json=json.dumps(["High", "Critical"] if capacity in {"Advanced", "Heavy"} else ["Low", "Medium", "High"]),
        crew_available=status not in {"Maintenance", "Unavailable"}, simulated=True,
    )


def _make_resources(bases: list[OperationalBase]) -> list[Resource]:
    by_category = {category: [base for base in bases if base.category == category]
                   for category in {"Police", "Ambulance", "Fire/Rescue", "Municipal/Utility"}}
    resources: list[Resource] = []
    resource_id = 1

    police_types = (["Patrol Car"] * 20 + ["Motorcycle Patrol"] * 10 + ["Rapid Response Vehicle"] * 6 +
                    ["Traffic Response Vehicle"] * 5 + ["Specialist Response Vehicle"] * 3 +
                    ["Women Safety Response Vehicle"] * 2 + ["Mobile Command/Support Vehicle"] * 2 +
                    ["Reserve Response Vehicle"] * 2)
    police_statuses = (["Available"] * 34 + ["Assigned"] * 4 + ["Dispatched"] * 4 +
                       ["En Route"] * 3 + ["On Scene"] * 2 + ["Maintenance", "Reserve", "Unavailable"])
    for index, (unit_type, status) in enumerate(zip(police_types, police_statuses)):
        base = by_category["Police"][index % len(by_category["Police"])]
        capacity = "Advanced" if unit_type in {"Rapid Response Vehicle", "Specialist Response Vehicle", "Mobile Command/Support Vehicle"} else "Standard"
        resources.append(_resource_record(resource_id, f"MYP-{index + 1:03d}", "Police Vehicle", "Police",
            unit_type, status, base, index, ["law_enforcement", "traffic_control", "public_safety"],
            2 if "Motorcycle" not in unit_type else 1, capacity))
        resource_id += 1

    ambulance_types = ["BLS Ambulance"] * 18 + ["ALS Ambulance"] * 7 + ["Reserve Ambulance", "Patient Transfer Ambulance", "Patient Transfer Ambulance"]
    ambulance_statuses = (["Available"] * 17 + ["Assigned"] * 2 + ["Dispatched"] * 2 +
                          ["En Route"] * 2 + ["Transporting", "Maintenance", "Reserve", "Reserve", "Unavailable"])
    for index, (unit_type, status) in enumerate(zip(ambulance_types, ambulance_statuses)):
        base = by_category["Ambulance"][index % len(by_category["Ambulance"])]
        als = unit_type == "ALS Ambulance"
        capabilities = ["oxygen", "trauma_transport"] + (["cardiac_monitor", "advanced_life_support", "paediatric"] if als else ["basic_life_support"])
        resources.append(_resource_record(resource_id, f"MYA-{index + 1:03d}", "Ambulance", "Ambulance",
            unit_type, status, base, index, capabilities, 3, "Advanced" if als else "Standard"))
        resource_id += 1

    fire_types = ["Fire Tender"] * 8 + ["Water Bowser"] * 2 + ["Rescue Van"] * 2 + ["Aerial Ladder Unit", "Hazmat Specialist Reserve"]
    fire_statuses = ["Available"] * 9 + ["Dispatched", "En Route", "On Scene", "Maintenance", "Reserve"]
    for index, (unit_type, status) in enumerate(zip(fire_types, fire_statuses)):
        base = by_category["Fire/Rescue"][index % len(by_category["Fire/Rescue"])]
        capabilities = ["fire_suppression", "rescue"]
        if unit_type in {"Fire Tender", "Water Bowser"}:
            capabilities.append("water_capacity_4500l" if unit_type == "Fire Tender" else "water_capacity_9000l")
        if "Hazmat" in unit_type:
            capabilities.extend(["hazmat", "limited_availability", "planned"])
        resources.append(_resource_record(resource_id, f"MYF-{index + 1:03d}", "Fire Engine", "Fire/Rescue",
            unit_type, status, base, index, capabilities, 6, "Heavy"))
        resource_id += 1

    municipal_types = (["Traffic Management Team"] * 4 + ["Electrical Emergency Team"] * 3 +
                       ["Water/Sewer Emergency Team"] * 2 + ["Road Clearance Team"] * 2 +
                       ["District Mobile Command Unit"])
    municipal_statuses = ["Available"] * 7 + ["Assigned", "Dispatched", "En Route", "Maintenance", "Reserve"]
    for index, (unit_type, status) in enumerate(zip(municipal_types, municipal_statuses)):
        base = by_category["Municipal/Utility"][index % len(by_category["Municipal/Utility"])]
        resources.append(_resource_record(resource_id, f"MYU-{index + 1:03d}", "Municipal Unit", "Municipal/Utility",
            unit_type, status, base, index, [unit_type.lower().replace(" ", "_"), "incident_support"], 4,
            "Advanced" if "Command" in unit_type else "Standard"))
        resource_id += 1
    return resources


def _make_hospitals() -> list[Hospital]:
    records = []
    for index, (name, lat, lng, ownership, trauma, icu, cardiac, paediatric, maternity) in enumerate(HOSPITAL_DATA, 1):
        emergency_capacity = 30 + (index % 5) * 10
        occupied = min(emergency_capacity - 2, 12 + (index * 3) % emergency_capacity)
        diversion = "Diversion" if index in {10, 16} else "Accepting"
        icu_capacity = 0 if not icu else 8 + (index % 4) * 4
        available_icu = 0 if not icu else max(1, icu_capacity - (index % max(icu_capacity, 1)) - 3)
        records.append(Hospital(
            id=index, name=name, area_id=((index - 1) % len(AREA_DATA)) + 1,
            latitude=lat, longitude=lng, total_beds=emergency_capacity,
            available_beds=emergency_capacity - occupied,
            emergency_capacity="Full" if diversion == "Diversion" else ("Nearing Capacity" if occupied / emergency_capacity > 0.8 else "Adequate"),
            status="Online", facility_category="Urban Health Facility" if "Facility" in name or "PHC" in name else "Hospital",
            ownership=ownership, emergency_capability=True, trauma_capability=trauma,
            icu_capability=icu, cardiac_capability=cardiac, paediatric_capability=paediatric,
            maternity_capability=maternity, emergency_bed_capacity=emergency_capacity,
            occupied_emergency_beds=occupied, icu_bed_capacity=icu_capacity,
            available_icu_beds=available_icu, diversion_status=diversion,
            blood_bank_available=index <= 10, ambulance_base_support=index <= 12,
            simulated=True, source_note="Facility identity is based on public Mysuru facility directories; all capacity fields are simulated.",
        ))
    return records


def reset_simulation_data(db: Session) -> dict:
    """Explicitly replace operational demo state; authentication/security records are preserved."""
    dispatch_count = db.query(Dispatch).count()
    assignment_count = db.query(DispatchAssignment).count()
    try:
        db.query(DispatchAssignment).delete(synchronize_session=False)
        db.query(Dispatch).delete(synchronize_session=False)
        db.query(HospitalExternalMapping).delete(synchronize_session=False)
        db.query(Resource).delete(synchronize_session=False)
        db.query(Hospital).delete(synchronize_session=False)
        db.query(Complaint).delete(synchronize_session=False)
        db.query(Incident).delete(synchronize_session=False)
        db.query(OperationalBase).delete(synchronize_session=False)
        db.query(Area).delete(synchronize_session=False)
        db.query(SeedMetadata).delete(synchronize_session=False)

        now = datetime.now(timezone.utc)
        areas = [Area(id=i, name=name, ward_number=ward, latitude=lat, longitude=lng,
            operational_score=score, status=status, traffic_level=traffic, rainfall=rain,
            complaint_count=0, active_incident_count=0, main_issue=issue, last_updated=now)
            for i, name, ward, lat, lng, score, status, traffic, rain, issue in AREA_DATA]
        db.add_all(areas)
        db.flush()

        categories = ["Road Accident", "Traffic Congestion", "Waterlogging", "Fire", "Medical Emergency", "Public Disturbance"]
        incident_statuses = ["Reported", "Assigned", "In Progress", "Reported", "Resolved", "Assigned"]
        severities = ["Critical", "High", "Medium", "High", "Low", "Medium"]
        incidents = []
        for index in range(18):
            area = areas[index % len(areas)]
            status = incident_statuses[index % len(incident_statuses)]
            incident = Incident(id=index + 1, title=f"{categories[index % len(categories)]} at {area.name}",
                description="Deterministic operational simulation incident for hackathon demonstration.",
                category=categories[index % len(categories)], severity=severities[index % len(severities)],
                status=status, area_id=area.id, latitude=round(area.latitude + ((index % 3) - 1) * 0.002, 6),
                longitude=round(area.longitude + (((index + 1) % 3) - 1) * 0.002, 6),
                responding_department=["Police", "Traffic Police", "Municipal", "Fire Dept", "Medical", "Police"][index % 6],
                reported_at=now - timedelta(minutes=15 * (index + 1)), updated_at=now - timedelta(minutes=5 * (index % 4)))
            incidents.append(incident)
            if status not in {"Resolved", "Closed"}:
                area.active_incident_count += 1
        flood_incidents = [
            (19, areas[7], "High", "Reported", "Flood at Siddhartha Layout",
                "Low-lying road flooding near Siddhartha Layout requiring pumping, barricades, and evacuation support."),
            (20, areas[11], "Critical", "Assigned", "Flood at Alanahalli",
                "Drain overflow and street flooding near Alanahalli requiring evacuation support and traffic diversion."),
        ]
        for incident_id, area, severity, status, title, description in flood_incidents:
            incidents.append(Incident(id=incident_id, title=title, description=description,
                category="Flood", severity=severity, status=status, area_id=area.id,
                latitude=area.latitude, longitude=area.longitude, responding_department="Municipal",
                reported_at=now - timedelta(minutes=15 * incident_id), updated_at=now - timedelta(minutes=5 * (incident_id % 4))))
            if status not in {"Resolved", "Closed"}:
                area.active_incident_count += 1
        db.add_all(incidents)

        bases = _make_bases()
        db.add_all(bases)
        db.flush()
        resources = _make_resources(bases)
        db.add_all(resources)
        hospitals = _make_hospitals()
        db.add_all(hospitals)

        complaints = []
        for index in range(24):
            area = areas[index % len(areas)]
            complaints.append(Complaint(id=index + 1, title=f"Simulated city issue in {area.name}",
                description="Deterministic public-service simulation record.",
                category=["Pothole", "Streetlight", "Garbage", "Water Supply"][index % 4],
                priority=["Low", "Normal", "High"][index % 3], area_id=area.id,
                latitude=area.latitude, longitude=area.longitude,
                status=["Open", "In Progress"][index % 2], submitted_at=now - timedelta(hours=index)))
            area.complaint_count += 1
        db.add_all(complaints)
        db.add(SeedMetadata(key="operational_seed_version", value=SEED_VERSION, updated_at=now))
        db.commit()
        return {
            "dispatches_removed": dispatch_count, "assignments_removed": assignment_count,
            "resources_restored": len(resources), "incidents_restored": len(incidents),
            "hospital_beds_restored": sum(item.available_beds for item in hospitals),
            "police_bases": len(POLICE_BASE_NAMES), "fire_bases": len(FIRE_BASE_NAMES),
            "police_units": 50, "ambulance_units": 28, "fire_rescue_units": 14,
            "municipal_utility_units": 12, "total_deployable_units": len(resources),
            "hospitals_restored": len(hospitals), "seed_version": SEED_VERSION,
            "message": "The deterministic Mysuru operational simulation was restored.",
        }
    except Exception:
        db.rollback()
        raise


def seed_db(db: Session):
    """Seed only an empty database; ordinary startup never replaces existing operational data."""
    if db.query(Area).count() > 0:
        return
    reset_simulation_data(db)
