from types import SimpleNamespace

import pytest

from app.config.allocation_rules import SUITABILITY_WEIGHTS, required_resources
from app.database import SessionLocal
from app.models import Area, Incident, Resource
from app.services.allocation_engine import build_allocation_plan, resource_eligibility, score_resource
from app.services.distance_service import has_valid_coordinates, haversine_km
from app.services.eta_service import estimate_eta


def test_haversine_distance_and_coordinate_validation():
    assert haversine_km(0, 0, 0, 1) == pytest.approx(111.19, abs=0.02)
    assert has_valid_coordinates(12.3, 76.6)
    assert not has_valid_coordinates(91, 76.6)
    with pytest.raises(ValueError):
        haversine_km(91, 0, 0, 0)


def test_eta_formula_and_minimum():
    eta = estimate_eta(10, "Ambulance", 50, 50, "High")
    assert eta["base_travel_minutes"] == 15
    assert eta["delay_modifier"] == 1.55
    assert eta["estimated_arrival_minutes"] == 23.25
    assert estimate_eta(0, "Police Vehicle", 0, 0, "Low")["estimated_arrival_minutes"] == 2


def test_multi_resource_rules():
    assert required_resources("Road Accident", "High") == {"Ambulance": 1, "Police Vehicle": 1}
    assert required_resources("Road Accident", "Critical") == {"Ambulance": 2, "Police Vehicle": 1}
    assert required_resources("Fire", "Critical") == {"Fire Engine": 1, "Ambulance": 1}


def test_suitability_weights_total_100_percent():
    assert sum(SUITABILITY_WEIGHTS.values()) == pytest.approx(1.0)


def test_resource_eligibility_and_score_clamping():
    db = SessionLocal()
    try:
        area = db.query(Area).first()
        incident = SimpleNamespace(category="Medical Emergency", severity="High",
            latitude=area.latitude, longitude=area.longitude)
        resource = SimpleNamespace(id=-1, resource_type="Ambulance", status="Available",
            assigned_incident_id=None, latitude=area.latitude, longitude=area.longitude,
            capacity="Standard", resource_code="UNIT-TEST")
        eligible, reasons = resource_eligibility(db, resource, incident, "Ambulance")
        assert eligible and not reasons
        result = score_resource(db, resource, incident, area, "Ambulance")
        assert 0 <= result["suitability_score"] <= 100
        assert all(0 <= value <= 100 for value in result["factor_scores"].values())
        resource.status = "Maintenance"
        eligible, reasons = resource_eligibility(db, resource, incident, "Ambulance")
        assert not eligible
        assert any("Maintenance" in reason for reason in reasons)
    finally:
        db.close()


def test_partial_plan_reports_shortage():
    db = SessionLocal()
    original = []
    incident = None
    try:
        area = db.query(Area).first()
        for resource in db.query(Resource).filter(Resource.resource_type == "Municipal Unit").all():
            original.append((resource.id, resource.status, resource.assigned_incident_id))
            resource.status = "Maintenance"
            resource.assigned_incident_id = None
        incident = Incident(title="PHASE3-PARTIAL", description="test", category="Waterlogging",
            severity="High", status="Reported", area_id=area.id, latitude=area.latitude,
            longitude=area.longitude, responding_department="Municipal")
        db.add(incident)
        db.commit()
        plan = build_allocation_plan(db, incident)
        assert not plan["plan_complete"]
        assert plan["shortages"] == {"Municipal Unit": 1}
        assert any(not item["eligible"] for item in plan["candidates"])
    finally:
        if incident and incident.id:
            db.query(Incident).filter(Incident.id == incident.id).delete()
        for resource_id, status, assigned_id in original:
            resource = db.query(Resource).filter(Resource.id == resource_id).first()
            resource.status, resource.assigned_incident_id = status, assigned_id
        db.commit()
        db.close()
