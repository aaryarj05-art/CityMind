"""Deterministic prototype ETA estimation (not road-network routing)."""

from app.config.allocation_rules import AVERAGE_SPEED_KMH, MINIMUM_ETA_MINUTES
from app.services.risk_engine import clamp, normalize_incident_severity, normalize_rainfall, normalize_traffic


def estimate_eta(
    distance_km: float,
    resource_type: str,
    traffic: str | float,
    rainfall_mm: float,
    severity: str,
) -> dict:
    speed = AVERAGE_SPEED_KMH[resource_type]
    base_minutes = max(0.0, distance_km) / speed * 60
    traffic_score = normalize_traffic(traffic)
    rainfall_score = normalize_rainfall(rainfall_mm)
    severity_score = normalize_incident_severity(severity)
    modifier = 1 + traffic_score / 100 * 0.50 + rainfall_score / 100 * 0.30 + severity_score / 100 * 0.20
    final_minutes = max(MINIMUM_ETA_MINUTES, base_minutes * modifier)
    return {
        "base_travel_minutes": round(base_minutes, 2),
        "delay_modifier": round(clamp(modifier, 1.0, 2.0), 2),
        "estimated_arrival_minutes": round(final_minutes, 2),
        "explanation": (
            f"ETA uses {distance_km:.2f} km at {speed:.0f} km/h with a {modifier:.2f}x "
            "traffic, rainfall, and severity delay modifier."
        ),
    }
