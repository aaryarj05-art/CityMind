"""Read-only ADK tools for deterministic CityMind traffic intelligence."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from citymind_agents.tools.internal_api import (
    InternalServiceTokenMissing, internal_auth_error, internal_service_headers,
)
from citymind_agents.runtime_config import backend_api_base_url


class _ToolAPIError(Exception):
    def __init__(self, error: dict[str, Any]):
        super().__init__(error["message"])
        self.error = error


def _api(path: str, method: str = "GET", body: dict | None = None) -> Any:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        headers = internal_service_headers(json_content=body is not None)
    except InternalServiceTokenMissing:
        raise _ToolAPIError(internal_auth_error()) from None
    request = Request(
        f"{backend_api_base_url()}/{path.lstrip('/')}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = "Requested CityMind data was not found." if exc.code == 404 else f"CityMind API returned HTTP {exc.code}."
        raise _ToolAPIError({"success": False, "error_type": "http_error", "status_code": exc.code, "message": message}) from None
    except URLError as exc:
        raise _ToolAPIError({
            "success": False,
            "error_type": "connection_error",
            "message": "Could not connect to the CityMind backend on port 8000.",
            "details": str(exc.reason),
        }) from None
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise _ToolAPIError({"success": False, "error_type": "invalid_json", "message": "CityMind returned invalid JSON."}) from None
    except _ToolAPIError:
        raise
    except Exception as exc:
        raise _ToolAPIError({"success": False, "error_type": "unexpected_error", "message": str(exc)}) from None


def _incident_context(incident_id: int) -> tuple[dict, dict, list[dict]]:
    incident = _api(f"incidents/{incident_id}")
    plan = _api(f"allocation/incidents/{incident_id}/plan")
    resources = _api("resources")
    return incident, plan, resources


def compare_resource_routes_for_incident(incident_id: int) -> dict[str, Any]:
    """Rank only CityMind-eligible incident resources using the route matrix API."""
    try:
        incident, plan, resources = _incident_context(incident_id)
        eligible_candidates = [item for item in plan.get("candidates", []) if item.get("eligible")][:8]
        rejected = [{
            "resource_code": item.get("resource_code"),
            "resource_type": item.get("resource_type"),
            "reasons": item.get("reasons", []),
        } for item in plan.get("candidates", []) if not item.get("eligible")]
        resources_by_code = {item.get("resource_code"): item for item in resources}
        origins = []
        eligible_metadata = []
        for candidate in eligible_candidates:
            resource = resources_by_code.get(candidate.get("resource_code"))
            if resource is None:
                rejected.append({
                    "resource_code": candidate.get("resource_code"),
                    "resource_type": candidate.get("resource_type"),
                    "reasons": ["Resource details were unavailable from CityMind."],
                })
                continue
            origins.append({
                "resource_id": resource["resource_code"],
                "latitude": resource["latitude"],
                "longitude": resource["longitude"],
            })
            eligible_metadata.append({
                "resource_code": resource["resource_code"],
                "resource_type": resource["resource_type"],
                "haversine_distance_km": candidate.get("distance_km"),
                "eligibility_confirmed": True,
            })
        if not origins:
            return {
                "success": True,
                "status": "no_eligible_resources",
                "incident_id": incident_id,
                "rankings": [],
                "eligible_resources": [],
                "rejected_resources": rejected,
                "message": "No resources satisfy the existing CityMind eligibility rules.",
                "source": "CityMind deterministic allocation API",
            }
        matrix = _api("maps/route-matrix", method="POST", body={
            "origins": origins,
            "destination": {"latitude": incident["latitude"], "longitude": incident["longitude"]},
            "incident_id": incident_id,
        })
        ranking_sources = list(dict.fromkeys(item.get("source") for item in matrix.get("rankings", []) if item.get("source")))
        live_values = [item.get("live_data", False) for item in matrix.get("rankings", [])]
        return {
            "success": True,
            "status": "ranked",
            "incident_id": incident_id,
            "incident": {"id": incident.get("id"), "title": incident.get("title")},
            "rankings": matrix.get("rankings", []),
            "eligible_resources": eligible_metadata,
            "rejected_resources": rejected,
            "source": "CityMind deterministic route-matrix API",
            "source_metadata": {
                "ranking_sources": ranking_sources,
                "live_data": bool(live_values) and all(live_values),
                "fallback_used": matrix.get("fallback_used", False),
                "retrieved_at": matrix.get("retrieved_at"),
                "warning": matrix.get("warning"),
            },
        }
    except _ToolAPIError as exc:
        return exc.error


def get_live_route_for_resource(incident_id: int, resource_code: str) -> dict[str, Any]:
    """Return a route only after the allocation API confirms resource eligibility."""
    try:
        incident, plan, resources = _incident_context(incident_id)
        candidate = next((item for item in plan.get("candidates", []) if item.get("resource_code") == resource_code), None)
        if candidate is None or not candidate.get("eligible"):
            return {
                "success": False,
                "error_type": "ineligible_resource",
                "incident_id": incident_id,
                "resource_code": resource_code,
                "message": "The resource is not eligible for this incident under CityMind rules.",
                "reasons": candidate.get("reasons", []) if candidate else ["Resource is not a required candidate for this incident."],
            }
        resource = next((item for item in resources if item.get("resource_code") == resource_code), None)
        if resource is None:
            return {"success": False, "error_type": "not_found", "message": f"Resource {resource_code} was not found."}
        route = _api("maps/route", method="POST", body={
            "origin": {"latitude": resource["latitude"], "longitude": resource["longitude"]},
            "destination": {"latitude": incident["latitude"], "longitude": incident["longitude"]},
        })
        return {
            "success": True,
            "incident_id": incident_id,
            "resource_code": resource_code,
            "resource_type": resource.get("resource_type"),
            "eligibility_confirmed": True,
            "distance_meters": route.get("distance_meters"),
            "traffic_duration_seconds": route.get("traffic_duration_seconds"),
            "static_duration_seconds": route.get("static_duration_seconds"),
            "traffic_delay_seconds": route.get("traffic_delay_seconds"),
            "congestion_level": route.get("congestion_level"),
            "source": route.get("source"),
            "live_data": route.get("live_data", False),
            "fallback_used": route.get("fallback_used", False),
            "retrieved_at": route.get("retrieved_at"),
            "warning": route.get("warning"),
        }
    except _ToolAPIError as exc:
        return exc.error


def get_traffic_decision_summary(incident_id: int) -> dict[str, Any]:
    """Explain nearest-versus-fastest using backend-produced distances and rankings."""
    compared = compare_resource_routes_for_incident(incident_id)
    if not compared.get("success") or not compared.get("rankings"):
        return compared
    eligible = compared.get("eligible_resources", [])
    nearest = min(eligible, key=lambda item: (item.get("haversine_distance_km", float("inf")), item["resource_code"]))
    fastest = min(compared["rankings"], key=lambda item: (item["traffic_duration_seconds"], item.get("rank", 9999)))
    ranking_by_code = {item["resource_id"]: item for item in compared["rankings"]}
    nearest_route = ranking_by_code.get(nearest["resource_code"])
    fallback_used = compared.get("source_metadata", {}).get("fallback_used", False)
    changed = None if fallback_used else nearest["resource_code"] != fastest["resource_id"]
    saved = None
    if nearest_route is not None:
        saved = max(nearest_route["traffic_duration_seconds"] - fastest["traffic_duration_seconds"], 0)
    return {
        "success": True,
        "incident_id": incident_id,
        "closest_eligible_resource": nearest,
        "fastest_resource": fastest,
        "traffic_changed_recommended_resource": changed,
        "estimated_time_saved_seconds": saved,
        "source_metadata": compared.get("source_metadata"),
        "fallback_used": fallback_used,
        "explanation": (
            "Live traffic changed the recommendation from the geographically closest eligible resource."
            if changed else
            "The geographically closest eligible resource is also the fastest traffic-aware resource."
            if changed is False else
            "Google traffic was unavailable, so a live-traffic recommendation change cannot be confirmed."
        ),
    }
