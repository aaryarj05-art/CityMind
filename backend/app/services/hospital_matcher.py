"""Deterministic hospital suitability ranking for transport incidents."""

from app.config.allocation_rules import HOSPITAL_WEIGHTS
from app.models import Hospital
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
        if not valid_coords:
            eligible = False
            reasons.append("Hospital coordinates are invalid.")
        if hospital.status != "Online":
            eligible = False
            reasons.append("Hospital is not operational.")
        if hospital.available_beds < demand:
            eligible = False
            reasons.append(f"Hospital lacks the required {demand} available bed(s).")
        if hospital.emergency_capacity == "Full":
            eligible = False
            reasons.append("Emergency capacity is full.")

        if valid_coords:
            distance = haversine_km(incident.latitude, incident.longitude, hospital.latitude, hospital.longitude)
            eta_minutes = estimate_eta(distance, "Ambulance", area.traffic_level, area.rainfall, incident.severity)["estimated_arrival_minutes"]
        else:
            distance, eta_minutes = 0.0, 60.0
        occupancy = 100 * (hospital.total_beds - hospital.available_beds) / hospital.total_beds if hospital.total_beds > 0 else 50
        factors = {
            "transport_eta": clamp(100 - eta_minutes / 60 * 100),
            "available_beds": clamp(hospital.available_beds / 25 * 100),
            "emergency_capacity": EMERGENCY_CAPACITY_SCORES.get(hospital.emergency_capacity, 0.0),
            "operational_status": 100.0 if hospital.status == "Online" else 0.0,
            "load_headroom": clamp(100 - occupancy),
        }
        score = round(clamp(sum(factors[key] * weight for key, weight in HOSPITAL_WEIGHTS.items())), 2) if eligible else 0.0
        if eligible:
            reasons.append(f"{hospital.name} has {hospital.available_beds} available beds, {hospital.emergency_capacity.lower()} emergency capacity, and an estimated {eta_minutes:.2f}-minute transport time.")
        results.append({"hospital_id": hospital.id, "hospital_name": hospital.name, "eligible": eligible,
            "suitability_score": score, "distance_km": distance, "estimated_transport_minutes": eta_minutes,
            "available_beds": hospital.available_beds, "emergency_capacity": hospital.emergency_capacity,
            "expected_patient_demand": demand, "factor_scores": {k: round(v, 2) for k, v in factors.items()}, "reasons": reasons})
    ranked = sorted(results, key=lambda item: (not item["eligible"], -item["suitability_score"], item["distance_km"], item["hospital_id"]))
    for index, item in enumerate(ranked, 1):
        item["rank"] = index if item["eligible"] else None
    return ranked
