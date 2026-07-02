"""
Phase 1 API Verification Tests
Tests all endpoints used by the repaired frontend pages.
"""
from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "environment" in data
        assert "timestamp" in data


def test_dashboard_summary():
    with TestClient(app) as client:
        response = client.get("/api/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert "active_incidents" in data
        assert "critical_zones" in data
        assert "available_ambulances" in data
        assert "feed_statuses" in data


def test_dashboard_full():
    with TestClient(app) as client:
        response = client.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "priority_zones" in data
        assert "recent_incidents" in data
        assert "resource_summary" in data
        assert "map_markers" in data
        # Verify priority zones have all required fields
        if data["priority_zones"]:
            zone = data["priority_zones"][0]
            for field in ["name", "ward_number", "operational_score", "status",
                          "traffic_level", "rainfall", "complaint_count",
                          "active_incident_count", "main_issue", "last_updated"]:
                assert field in zone, f"Missing field: {field}"


def test_get_all_areas():
    with TestClient(app) as client:
        response = client.get("/api/areas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 10  # Spec requires 10+ areas
        area = data[0]
        for field in ["id", "name", "ward_number", "operational_score",
                      "status", "traffic_level", "rainfall",
                      "complaint_count", "active_incident_count",
                      "main_issue", "last_updated"]:
            assert field in area, f"Missing field: {field}"


def test_get_area_by_id():
    with TestClient(app) as client:
        response = client.get("/api/areas/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1


def test_get_all_incidents():
    with TestClient(app) as client:
        response = client.get("/api/incidents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 15  # Spec requires 15+ incidents
        inc = data[0]
        for field in ["id", "title", "description", "category", "severity",
                      "status", "area_id", "latitude", "longitude",
                      "responding_department", "reported_at", "updated_at"]:
            assert field in inc, f"Missing field: {field}"


def test_get_incident_by_id():
    with TestClient(app) as client:
        response = client.get("/api/incidents/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1


def test_get_all_resources():
    with TestClient(app) as client:
        response = client.get("/api/resources")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 30  # Spec requires 30+ resources
        res = data[0]
        for field in ["id", "resource_code", "resource_type", "status",
                      "latitude", "longitude", "last_updated"]:
            assert field in res, f"Missing field: {field}"


def test_get_resource_by_id():
    with TestClient(app) as client:
        response = client.get("/api/resources/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1


def test_get_all_hospitals():
    with TestClient(app) as client:
        response = client.get("/api/hospitals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # Spec requires 5+ hospitals


def test_get_all_complaints():
    with TestClient(app) as client:
        response = client.get("/api/complaints")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 20  # Spec requires 20+ complaints
