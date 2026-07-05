from app.services.adk_service import extract_agents
from citymind_agents.coordinator import city_operations_coordinator
from citymind_agents.hospital_agent import hospital_intelligence_agent
from citymind_agents.response_agent import response_planning_agent
from citymind_agents.traffic_agent import traffic_intelligence_agent
from citymind_agents.tools import hospital_tools, traffic_tools


INCIDENT = {"id": 1, "title": "Medical incident", "latitude": 12.3, "longitude": 76.64}
PLAN = {
    "candidates": [
        {"resource_code": "AMB-NEAR", "resource_type": "Ambulance", "eligible": True, "distance_km": 1.0, "reasons": []},
        {"resource_code": "AMB-FAST", "resource_type": "Ambulance", "eligible": True, "distance_km": 2.0, "reasons": []},
        {"resource_code": "AMB-BUSY", "resource_type": "Ambulance", "eligible": False, "distance_km": 0.5, "reasons": ["Resource status is Dispatched, not Available."]},
    ]
}
RESOURCES = [
    {"resource_code": "AMB-NEAR", "resource_type": "Ambulance", "latitude": 12.301, "longitude": 76.641},
    {"resource_code": "AMB-FAST", "resource_type": "Ambulance", "latitude": 12.302, "longitude": 76.642},
    {"resource_code": "AMB-BUSY", "resource_type": "Ambulance", "latitude": 12.299, "longitude": 76.639},
]
MATRIX = {
    "rankings": [
        {"resource_id": "AMB-FAST", "distance_meters": 2500, "traffic_duration_seconds": 300,
         "static_duration_seconds": 240, "traffic_delay_seconds": 60, "rank": 1,
         "source": "Google Routes API", "live_data": True},
        {"resource_id": "AMB-NEAR", "distance_meters": 1400, "traffic_duration_seconds": 420,
         "static_duration_seconds": 180, "traffic_delay_seconds": 240, "rank": 2,
         "source": "Google Routes API", "live_data": True},
    ],
    "retrieved_at": "2026-07-04T01:00:00Z", "fallback_used": False,
}


def traffic_api(path, method="GET", body=None):
    if path == "incidents/1":
        return INCIDENT
    if path == "allocation/incidents/1/plan":
        return PLAN
    if path == "resources":
        return RESOURCES
    if path == "maps/route-matrix":
        assert method == "POST"
        assert body["incident_id"] == 1
        assert {item["resource_id"] for item in body["origins"]} == {"AMB-NEAR", "AMB-FAST"}
        return MATRIX
    raise AssertionError(path)


def test_traffic_tool_success(monkeypatch):
    monkeypatch.setattr(traffic_tools, "_api", traffic_api)
    result = traffic_tools.compare_resource_routes_for_incident(1)
    assert result["success"] is True
    assert [item["resource_id"] for item in result["rankings"]] == ["AMB-FAST", "AMB-NEAR"]
    assert result["source_metadata"] == {
        "ranking_sources": ["Google Routes API"], "live_data": True,
        "fallback_used": False, "retrieved_at": "2026-07-04T01:00:00Z", "warning": None,
    }
    assert result["rejected_resources"][0]["resource_code"] == "AMB-BUSY"


def test_traffic_fallback_response(monkeypatch):
    def fake_api(path, method="GET", body=None):
        if path == "incidents/1": return INCIDENT
        if path == "allocation/incidents/1/plan": return PLAN
        if path == "resources": return RESOURCES
        if path == "maps/route":
            return {"distance_meters": 1500, "traffic_duration_seconds": 180,
                "static_duration_seconds": 180, "traffic_delay_seconds": 0,
                "congestion_level": "low", "source": "CityMind estimated fallback",
                "live_data": False, "fallback_used": True,
                "retrieved_at": "2026-07-04T01:01:00Z",
                "warning": {"code": "google_routes_timeout", "message": "fallback"}}
        raise AssertionError(path)
    monkeypatch.setattr(traffic_tools, "_api", fake_api)
    result = traffic_tools.get_live_route_for_resource(1, "AMB-NEAR")
    assert result["eligibility_confirmed"] is True
    assert result["source"] == "CityMind estimated fallback"
    assert result["live_data"] is False and result["fallback_used"] is True
    assert result["retrieved_at"] == "2026-07-04T01:01:00Z"


def test_traffic_no_eligible_resources(monkeypatch):
    calls = []
    def fake_api(path, method="GET", body=None):
        calls.append(path)
        if path == "incidents/1": return INCIDENT
        if path == "allocation/incidents/1/plan":
            return {"candidates": [{"resource_code": "AMB-BUSY", "resource_type": "Ambulance",
                "eligible": False, "reasons": ["Already assigned."]}]}
        if path == "resources": return RESOURCES
        raise AssertionError("Route matrix must not be called")
    monkeypatch.setattr(traffic_tools, "_api", fake_api)
    result = traffic_tools.compare_resource_routes_for_incident(1)
    assert result["status"] == "no_eligible_resources"
    assert result["rankings"] == []
    assert "maps/route-matrix" not in calls
    assert result["rejected_resources"][0]["reasons"] == ["Already assigned."]


def test_fastest_versus_nearest_explanation_data(monkeypatch):
    monkeypatch.setattr(traffic_tools, "compare_resource_routes_for_incident", lambda incident_id: {
        "success": True,
        "eligible_resources": [
            {"resource_code": "AMB-NEAR", "haversine_distance_km": 1.0, "eligibility_confirmed": True},
            {"resource_code": "AMB-FAST", "haversine_distance_km": 2.0, "eligibility_confirmed": True},
        ],
        "rankings": MATRIX["rankings"],
        "source_metadata": {"fallback_used": False, "retrieved_at": MATRIX["retrieved_at"]},
    })
    result = traffic_tools.get_traffic_decision_summary(1)
    assert result["closest_eligible_resource"]["resource_code"] == "AMB-NEAR"
    assert result["fastest_resource"]["resource_id"] == "AMB-FAST"
    assert result["traffic_changed_recommended_resource"] is True
    assert result["estimated_time_saved_seconds"] == 120


def test_hospital_discovery_has_identity_only(monkeypatch):
    calls = []
    def fake_api(path, method="GET", body=None):
        calls.append(path)
        if path == "incidents/1": return INCIDENT
        if path.startswith("hospitals/nearby?"):
            return {"hospitals": [{"google_place_id": "g1", "name": "Real Hospital",
                "latitude": 12.31, "longitude": 76.65, "identity_source": "Google Places"}],
                "source": "Google Places API", "live_data": True,
                "retrieved_at": "2026-07-04T01:02:00Z", "notice": "Identity only"}
        raise AssertionError(path)
    monkeypatch.setattr(hospital_tools, "_api", fake_api)
    result = hospital_tools.find_real_hospitals_for_incident(1, limit=5)
    assert result["hospitals"][0]["google_place_id"] == "g1"
    assert result["capacity_data_included"] is False
    assert "limit=5" in calls[1]
    assert "available_beds" not in result["hospitals"][0]


def ranked_hospital(mapping_verified, simulated, capacity_source, citymind_id=None):
    return {
        "rank": 1, "google_place_id": "g1", "citymind_hospital_id": citymind_id,
        "name": "Hospital", "traffic_duration_seconds": 500, "distance_meters": 4000,
        "available_beds": 8 if mapping_verified else None, "icu_available": None,
        "capacity_source": capacity_source, "capacity_timestamp": "2026-07-04T01:00:00Z" if mapping_verified else None,
        "capacity_is_simulated": simulated, "overall_score": 80 if mapping_verified else 35,
        "score_breakdown": {"traffic_aware_eta": {"weight": 0.4, "score": 80, "weighted_score": 32}},
        "data_provenance": {"identity_source": "Google Places", "routing_source": "Google Routes API",
            "capacity_source": capacity_source, "mapping_verified": mapping_verified},
        "stale_data_warnings": ["capacity stale"] if mapping_verified else ["capacity unknown"],
    }


def test_hospital_ranking_preserves_score_and_provenance(monkeypatch):
    hospital = ranked_hospital(True, True, "CityMind simulated operational data", 7)
    def fake_api(path, method="GET", body=None):
        assert path == "hospitals/rank-live" and method == "POST"
        assert body == {"incident_id": 1, "limit": 10}
        return {"incident_id": 1, "required_capability": "emergency intake",
            "weights": {"traffic_aware_eta": 0.4}, "hospitals": [hospital],
            "retrieved_at": "2026-07-04T01:03:00Z"}
    monkeypatch.setattr(hospital_tools, "_api", fake_api)
    result = hospital_tools.rank_hospitals_for_incident(1)
    assert result["hospitals"][0]["score_breakdown"] == hospital["score_breakdown"]
    assert result["hospitals"][0]["traffic_duration_seconds"] == 500
    assert result["hospitals"][0]["data_provenance"]["mapping_verified"] is True


def test_unmatched_hospital_provenance_stays_unknown(monkeypatch):
    hospital = ranked_hospital(False, None, "unknown")
    monkeypatch.setattr(hospital_tools, "rank_hospitals_for_incident", lambda incident_id, limit=10: {
        "success": True, "hospitals": [hospital], "retrieved_at": "2026-07-04T01:04:00Z"})
    result = hospital_tools.get_hospital_provenance(1, "g1")
    assert result["mapping_verified"] is False
    assert result["citymind_hospital_id"] is None
    assert result["bed_source"] == "unknown"
    assert result["icu_source"] == "unknown"
    assert result["capacity_is_simulated"] is None


def test_verified_mapping_provenance_labels_simulated_capacity(monkeypatch):
    hospital = ranked_hospital(True, True, "CityMind simulated operational data", 7)
    monkeypatch.setattr(hospital_tools, "rank_hospitals_for_incident", lambda incident_id, limit=10: {
        "success": True, "hospitals": [hospital], "retrieved_at": "2026-07-04T01:04:00Z"})
    result = hospital_tools.get_hospital_provenance(1, "g1")
    assert result["mapping_verified"] is True
    assert result["citymind_hospital_id"] == 7
    assert result["bed_source"] == "CityMind simulated operational data"
    assert result["capacity_is_simulated"] is True
    assert result["stale_data_warnings"] == ["capacity stale"]


def tool_names(agent):
    return {getattr(tool, "name", getattr(tool, "__name__", "")) for tool in agent.tools}


def test_specialist_agent_configuration():
    assert traffic_intelligence_agent.name == "traffic_intelligence_agent"
    assert hospital_intelligence_agent.name == "hospital_intelligence_agent"
    assert str(traffic_intelligence_agent.model) == "gemini-2.5-flash"
    assert str(hospital_intelligence_agent.model) == "gemini-2.5-flash"
    assert tool_names(traffic_intelligence_agent) == {
        "compare_resource_routes_for_incident", "get_live_route_for_resource", "get_traffic_decision_summary"}
    assert tool_names(hospital_intelligence_agent) == {
        "find_real_hospitals_for_incident", "rank_hospitals_for_incident", "get_hospital_provenance"}
    assert "Never invent road closures" in traffic_intelligence_agent.instruction
    assert "Unknown data must remain unknown" in hospital_intelligence_agent.instruction


def test_response_agent_contains_both_nested_specialists():
    assert [agent.name for agent in response_planning_agent.sub_agents] == [
        "traffic_intelligence_agent", "hospital_intelligence_agent"]
    assert "Do not convert recommendations into confirmed dispatch actions" in response_planning_agent.instruction


def test_coordinator_preserves_original_top_level_agents():
    assert [agent.name for agent in city_operations_coordinator.sub_agents] == [
        "risk_intelligence_agent", "response_planning_agent", "public_communication_agent",
        "authorization_agent", "security_intelligence_agent"]
    assert city_operations_coordinator.sub_agents[1].sub_agents == response_planning_agent.sub_agents


def test_agent_trace_uses_real_adk_event_authors():
    events = [
        {"author": "city_operations_coordinator"},
        {"author": "response_planning_agent"},
        {"author": "traffic_intelligence_agent"},
        {"author": "response_planning_agent"},
    ]
    assert extract_agents(events) == [
        "city_operations_coordinator", "response_planning_agent", "traffic_intelligence_agent"]
