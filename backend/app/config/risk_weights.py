"""Single source of truth for deterministic risk and priority weights."""

RISK_WEIGHTS = {
    "traffic": 0.25,
    "rainfall": 0.20,
    "incidents": 0.20,
    "complaints": 0.15,
    "hospital_load": 0.10,
    "resource_shortage": 0.10,
}

INCIDENT_PRIORITY_WEIGHTS = {
    "severity": 0.35,
    "recency": 0.20,
    "area_risk": 0.25,
    "status": 0.10,
    "resource_scarcity": 0.10,
}

NEARBY_RADIUS_KM = 5.0
NEUTRAL_HOSPITAL_LOAD = 50.0
AVAILABLE_RESOURCE_TARGET = 5


def validate_weights(weights: dict[str, float]) -> None:
    """Fail fast when configuration no longer totals exactly 100%."""
    if abs(sum(weights.values()) - 1.0) > 1e-9:
        raise ValueError("Risk weights must total 100%")


validate_weights(RISK_WEIGHTS)
validate_weights(INCIDENT_PRIORITY_WEIGHTS)
