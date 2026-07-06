"""Deterministic ranking over seeded facilities and simulated capacity."""

from app.config.allocation_rules import HOSPITAL_WEIGHTS
from app.models import Hospital
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.distance_service import has_valid_coordinates, haversine_km
from app.services.eta_service import estimate_eta
from app.services.risk_engine import clamp

EMERGENCY_CAPACITY_SCORES = {"Adequate": 100.0, "Nearing Capacity": 50.0, "Full": 0.0}


def expected_patient_demand(severity: str) -> int:
    return 2 if severity == "Critical" else 1


def rank_hospitals(db, incident, area) -> list[dict]:
    demand = expected_patient_demand(incident.severity)
    results = []
    for hospital in db.query(Hospital).all():
        reasons, eligible = [], True
        valid_coords = has_valid_coordinates(hospital.latitude, hospital.longitude)
        if not valid_coords: eligible, reasons = False, ["Hospital coordinates are invalid."]
        if hospital.status != "Online": eligible = False; reasons.append("Hospital is not operational.")
        if hospital.diversion_status != "Accepting": eligible = False; reasons.append("Hospital is on simulated diversion.")
        if hospital.available_beds < demand: eligible = False; reasons.append(f"Hospital lacks the required {demand} available bed(s).")
        if hospital.emergency_capacity == "Full": eligible = False; reasons.append("Emergency capacity is full.")
        if incident.category == "Road Accident" and incident.severity == "Critical" and not hospital.trauma_capability:
            eligible = False; reasons.append("Critical road trauma requires a trauma-capable facility.")
        if incident.category == "Medical Emergency" and incident.severity == "Critical" and not hospital.icu_capability:
            eligible = False; reasons.append("Critical medical transport requires simulated ICU capability.")

        if valid_coords:
            distance = haversine_km(incident.latitude, incident.longitude, hospital.latitude, hospital.longitude)
            eta_minutes = estimate_eta(distance, "Ambulance", area.traffic_level, area.rainfall, incident.severity)["estimated_arrival_minutes"]
        else:
            distance, eta_minutes = 0.0, 60.0
        capacity = hospital.emergency_bed_capacity or hospital.total_beds
        occupied = hospital.occupied_emergency_beds if hospital.emergency_bed_capacity else max(0, hospital.total_beds - hospital.available_beds)
        occupancy = 100 * occupied / capacity if capacity > 0 else 50
        capability_score = 100.0
        if incident.category == "Road Accident": capability_score = 100.0 if hospital.trauma_capability else 40.0
        elif incident.category == "Medical Emergency": capability_score = 100.0 if hospital.icu_capability else 55.0
        factors = {"transport_eta": clamp(100 - eta_minutes / 60 * 100),
            "available_beds": clamp(hospital.available_beds / 25 * 100),
            "emergency_capacity": EMERGENCY_CAPACITY_SCORES.get(hospital.emergency_capacity, 0.0),
            "operational_status": 100.0 if hospital.status == "Online" and hospital.diversion_status == "Accepting" else 0.0,
            "load_headroom": clamp(100 - occupancy)}
        score = round(clamp(sum(factors[key] * weight for key, weight in HOSPITAL_WEIGHTS.items())) * capability_score / 100, 2) if eligible else 0.0
        if eligible: reasons.append(f"{hospital.name} has {hospital.available_beds} simulated emergency beds and an estimated {eta_minutes:.2f}-minute transport time.")
        results.append({"hospital_id": hospital.id, "hospital_name": hospital.name, "eligible": eligible,
            "suitability_score": score, "distance_km": distance, "estimated_transport_minutes": eta_minutes,
            "available_beds": hospital.available_beds, "available_icu_beds": hospital.available_icu_beds,
            "emergency_capacity": hospital.emergency_capacity, "diversion_status": hospital.diversion_status,
            "trauma_capability": hospital.trauma_capability, "cardiac_capability": hospital.cardiac_capability,
            "paediatric_capability": hospital.paediatric_capability, "maternity_capability": hospital.maternity_capability,
            "expected_patient_demand": demand, "capacity_simulated": True,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
            "factor_scores": {k: round(v, 2) for k, v in factors.items()}, "reasons": reasons})
    ranked = sorted(results, key=lambda item: (not item["eligible"], -item["suitability_score"], item["distance_km"], item["hospital_id"]))
    for index, item in enumerate(ranked, 1): item["rank"] = index if item["eligible"] else None
    return ranked
