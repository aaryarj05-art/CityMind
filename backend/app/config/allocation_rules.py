"""Central deterministic rules for Phase 3 allocation and dispatch."""

RESOURCE_TYPES = ("Ambulance", "Police Vehicle", "Fire Engine", "Municipal Unit")

INCIDENT_RESOURCE_REQUIREMENTS = {
    "Medical Emergency": {"Ambulance": 1},
    "Road Accident": {"Ambulance": 1, "Police Vehicle": 1},
    "Fire": {"Fire Engine": 1},
    "Traffic Congestion": {"Police Vehicle": 1},
    "Road Blockage": {"Police Vehicle": 1, "Municipal Unit": 1},
    "Waterlogging": {"Municipal Unit": 1},
    "Public Disturbance": {"Police Vehicle": 1},
}

MEDICAL_INCIDENT_CATEGORIES = {"Medical Emergency", "Road Accident"}

AVERAGE_SPEED_KMH = {
    "Ambulance": 40.0,
    "Police Vehicle": 45.0,
    "Fire Engine": 35.0,
    "Municipal Unit": 30.0,
}

SUITABILITY_WEIGHTS = {
    "eta": 0.40,
    "readiness": 0.20,
    "type_match": 0.20,
    "capacity": 0.10,
    "area_conditions": 0.10,
}

HOSPITAL_WEIGHTS = {
    "transport_eta": 0.35,
    "available_beds": 0.25,
    "emergency_capacity": 0.20,
    "operational_status": 0.10,
    "load_headroom": 0.10,
}

CAPACITY_LEVELS = {"Basic": 1, "Standard": 2, "Advanced": 3, "Heavy": 3}
REQUIRED_CAPACITY = {category: "Standard" for category in INCIDENT_RESOURCE_REQUIREMENTS}

MINIMUM_ETA_MINUTES = 2.0
MAX_ETA_FOR_SCORING_MINUTES = 60.0

ACTIVE_DISPATCH_STATUSES = {"Planned", "Dispatched", "En Route", "On Scene", "Transporting"}
DISPATCH_TRANSITIONS = {
    "Planned": {"Dispatched", "Cancelled"},
    "Dispatched": {"En Route", "Cancelled"},
    "En Route": {"On Scene"},
    "On Scene": {"Transporting", "Completed"},
    "Transporting": {"Completed"},
    "Completed": set(),
    "Cancelled": set(),
}


def required_resources(category: str, severity: str) -> dict[str, int]:
    requirements = dict(INCIDENT_RESOURCE_REQUIREMENTS.get(category, {}))
    if category == "Fire" and severity in {"High", "Critical"}:
        requirements["Ambulance"] = 1
    if category in {"Medical Emergency", "Road Accident"} and severity == "Critical":
        requirements["Ambulance"] = requirements.get("Ambulance", 0) + 1
    return requirements


for configured_weights in (SUITABILITY_WEIGHTS, HOSPITAL_WEIGHTS):
    if abs(sum(configured_weights.values()) - 1.0) > 1e-9:
        raise ValueError("Allocation weights must total 100%")
