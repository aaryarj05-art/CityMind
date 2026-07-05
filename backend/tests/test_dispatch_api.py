import itertools

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Dispatch, Hospital, Incident, Resource, SecurityEvent
from app.services.dispatch_service import reset_demo

counter = itertools.count(1)


@pytest.fixture
def phase3_data():
    db = SessionLocal()
    reset_demo(db)
    area = db.query(__import__("app.models", fromlist=["Area"]).Area).first()
    created_incidents, created_resources, created_hospitals = [], [], []

    def incident(category="Medical Emergency", severity="High", status="Reported"):
        number = next(counter)
        item = Incident(title=f"PHASE3-INC-{number}", description="Phase 3 test incident",
            category=category, severity=severity, status=status, area_id=area.id,
            latitude=area.latitude, longitude=area.longitude, responding_department="Test")
        db.add(item); db.commit(); db.refresh(item); created_incidents.append(item.id)
        return item

    def resource(resource_type="Ambulance", status="Available"):
        number = next(counter)
        item = Resource(resource_code=f"P3-{number:04d}", resource_type=resource_type,
            status=status, area_id=area.id, latitude=area.latitude,
            longitude=area.longitude, assigned_incident_id=None, capacity="Standard")
        db.add(item); db.commit(); db.refresh(item); created_resources.append(item.id)
        return item

    def hospital():
        number = next(counter)
        item = Hospital(name=f"PHASE3-HOSP-{number}", area_id=area.id,
            latitude=area.latitude, longitude=area.longitude, total_beds=500,
            available_beds=500, emergency_capacity="Adequate", status="Online")
        db.add(item); db.commit(); db.refresh(item); created_hospitals.append(item.id)
        return item

    yield db, incident, resource, hospital
    reset_demo(db)
    db.query(Resource).filter(Resource.id.in_(created_resources)).delete(synchronize_session=False)
    db.query(Incident).filter(Incident.id.in_(created_incidents)).delete(synchronize_session=False)
    db.query(Hospital).filter(Hospital.id.in_(created_hospitals)).delete(synchronize_session=False)
    db.commit(); db.close()


def test_plan_endpoint_ranks_resources_and_hospitals(phase3_data):
    _, make_incident, make_resource, make_hospital = phase3_data
    incident = make_incident("Medical Emergency", "High")
    near = make_resource("Ambulance")
    make_hospital()
    with TestClient(app) as client:
        response = client.get(f"/api/allocation/incidents/{incident.id}/plan")
        assert response.status_code == 200
        data = response.json()
        assert data["required_resources"] == {"Ambulance": 1}
        assert data["recommended_resources"]
        assert data["recommended_resources"][0]["rank"] == 1
        assert any(item["resource_id"] == near.id for item in data["candidates"])
        assert data["hospital_recommendations"][0]["eligible"]
        assert "deterministic plan" in data["explanation"]


def test_dispatch_creation_is_atomic_and_updates_states(phase3_data):
    db, make_incident, make_resource, make_hospital = phase3_data
    incident = make_incident("Road Accident", "High")
    ambulance, police = make_resource("Ambulance"), make_resource("Police Vehicle")
    hospital = make_hospital(); beds_before = hospital.available_beds
    with TestClient(app) as client:
        response = client.post("/api/dispatches", json={"incident_id": incident.id,
            "selected_resource_ids": [ambulance.id, police.id], "selected_hospital_id": hospital.id,
            "decision_id": "CM-2026-TEST"})
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "Dispatched" and data["plan_complete"]
        assert len(data["assignments"]) == 2
        approval = db.query(SecurityEvent).filter_by(action="dispatch_created", decision_id="CM-2026-TEST").one()
        assert approval.role == "DemoAdmin" and len(approval.integrity_hash) == 64
    db.expire_all()
    assert db.get(Incident, incident.id).status == "Assigned"
    assert db.get(Resource, ambulance.id).status == "Dispatched"
    assert db.get(Hospital, hospital.id).available_beds == beds_before - 1


def test_atomic_rollback_and_duplicate_conflicts(phase3_data):
    db, make_incident, make_resource, _ = phase3_data
    first_incident = make_incident("Medical Emergency")
    second_incident = make_incident("Medical Emergency")
    ambulance = make_resource("Ambulance")
    with TestClient(app) as client:
        failed = client.post("/api/dispatches", json={"incident_id": first_incident.id,
            "selected_resource_ids": [ambulance.id, 999999]})
        assert failed.status_code == 404
        db.expire_all()
        assert db.get(Resource, ambulance.id).status == "Available"
        assert db.get(Incident, first_incident.id).status == "Reported"
        assert db.query(Dispatch).filter(Dispatch.incident_id == first_incident.id).count() == 0

        assert client.post("/api/dispatches", json={"incident_id": first_incident.id,
            "selected_resource_ids": [ambulance.id]}).status_code == 201
        assert client.post("/api/dispatches", json={"incident_id": first_incident.id,
            "use_recommended_resources": True}).status_code == 409
        assert client.post("/api/dispatches", json={"incident_id": second_incident.id,
            "selected_resource_ids": [ambulance.id]}).status_code == 409


def test_lifecycle_completion_and_resource_release(phase3_data):
    db, make_incident, make_resource, _ = phase3_data
    incident, police = make_incident("Traffic Congestion"), make_resource("Police Vehicle")
    with TestClient(app) as client:
        created = client.post("/api/dispatches", json={"incident_id": incident.id,
            "selected_resource_ids": [police.id]}).json()
        dispatch_id = created["id"]
        assert client.patch(f"/api/dispatches/{dispatch_id}/status", json={"status": "On Scene"}).status_code == 409
        assert client.patch(f"/api/dispatches/{dispatch_id}/status", json={"status": "En Route"}).status_code == 200
        db.expire_all(); assert db.get(Resource, police.id).status == "Dispatched"
        assert client.patch(f"/api/dispatches/{dispatch_id}/status", json={"status": "On Scene"}).status_code == 200
        completed = client.post(f"/api/dispatches/{dispatch_id}/complete")
        assert completed.status_code == 200 and completed.json()["status"] == "Completed"
        assert client.post(f"/api/dispatches/{dispatch_id}/complete").status_code == 409
    db.expire_all()
    assert db.get(Resource, police.id).status == "Available"
    assert db.get(Resource, police.id).assigned_incident_id is None
    assert db.get(Incident, incident.id).status == "Resolved"


def test_cancellation_releases_resource_and_hospital_bed(phase3_data):
    db, make_incident, make_resource, make_hospital = phase3_data
    incident, ambulance, hospital = make_incident(), make_resource(), make_hospital()
    beds_before = hospital.available_beds
    with TestClient(app) as client:
        created = client.post("/api/dispatches", json={"incident_id": incident.id,
            "selected_resource_ids": [ambulance.id], "selected_hospital_id": hospital.id}).json()
        cancelled = client.post(f"/api/dispatches/{created['id']}/cancel")
        assert cancelled.status_code == 200 and cancelled.json()["status"] == "Cancelled"
        assert client.post(f"/api/dispatches/{created['id']}/cancel").status_code == 409
    db.expire_all()
    assert db.get(Resource, ambulance.id).status == "Available"
    assert db.get(Incident, incident.id).status == "Reported"
    assert db.get(Hospital, hospital.id).available_beds == beds_before


def test_dispatch_filters_summary_and_demo_reset(phase3_data):
    _, make_incident, make_resource, _ = phase3_data
    incident, police = make_incident("Public Disturbance"), make_resource("Police Vehicle")
    with TestClient(app) as client:
        created = client.post("/api/dispatches", json={"incident_id": incident.id,
            "selected_resource_ids": [police.id]}).json()
        assert len(client.get("/api/dispatches", params={"status": "Dispatched"}).json()) == 1
        assert len(client.get("/api/dispatches", params={"incident_id": incident.id}).json()) == 1
        assert len(client.get("/api/dispatches", params={"resource_id": police.id}).json()) == 1
        summary = client.get("/api/dispatches/summary").json()
        assert summary["active_dispatch_count"] == 1
        assert summary["resources_currently_assigned"] >= 1
        reset = client.post("/api/demo/reset")
        assert reset.status_code == 200 and reset.json()["dispatches_removed"] == 1
        assert client.get(f"/api/dispatches/{created['id']}").status_code == 404


def test_api_not_found_and_validation_behavior(phase3_data):
    _, make_incident, _, _ = phase3_data
    incident = make_incident()
    with TestClient(app) as client:
        assert client.get("/api/allocation/incidents/999999/plan").status_code == 404
        assert client.get("/api/dispatches/999999").status_code == 404
        assert client.post("/api/dispatches", json={"incident_id": incident.id}).status_code == 422
        assert client.patch("/api/dispatches/999999/status", json={"status": "En Route"}).status_code == 404

def test_demo_reset_is_environment_protected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    with TestClient(app) as client:
        response = client.post("/api/demo/reset")
        assert response.status_code == 403