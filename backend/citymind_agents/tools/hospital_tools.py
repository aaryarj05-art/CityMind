"""Read-only ADK tools for hospital identity, ranking, and provenance."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from citymind_agents.tools.internal_api import (
    InternalServiceTokenMissing, internal_auth_error, internal_service_headers,
)

CITYMIND_API_BASE_URL = "http://127.0.0.1:8000/api"


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
        f"{CITYMIND_API_BASE_URL}/{path.lstrip('/')}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=20) as response:
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


def _valid_limit(limit: int) -> dict[str, Any] | None:
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 20:
        return {
            "success": False,
            "error_type": "validation_error",
            "message": "limit must be an integer between 1 and 20.",
        }
    return None


def find_real_hospitals_for_incident(incident_id: int, limit: int = 10) -> dict[str, Any]:
    """Discover Google hospital identities without adding capacity claims."""
    invalid = _valid_limit(limit)
    if invalid:
        return invalid
    try:
        incident = _api(f"incidents/{incident_id}")
        query = urlencode({
            "latitude": incident["latitude"],
            "longitude": incident["longitude"],
            "limit": limit,
        })
        nearby = _api(f"hospitals/nearby?{query}")
        return {
            "success": True,
            "incident_id": incident_id,
            "requested_limit": limit,
            "hospitals": nearby.get("hospitals", [])[:limit],
            "source": nearby.get("source"),
            "live_data": nearby.get("live_data"),
            "retrieved_at": nearby.get("retrieved_at"),
            "notice": nearby.get("notice"),
            "capacity_data_included": False,
        }
    except _ToolAPIError as exc:
        return exc.error


def rank_hospitals_for_incident(incident_id: int, limit: int = 10) -> dict[str, Any]:
    """Return the backend's deterministic hospital ranking unchanged."""
    invalid = _valid_limit(limit)
    if invalid:
        return invalid
    try:
        ranked = _api("hospitals/rank-live", method="POST", body={"incident_id": incident_id, "limit": limit})
        return {
            "success": True,
            "incident_id": incident_id,
            "requested_limit": limit,
            "required_capability": ranked.get("required_capability"),
            "weights": ranked.get("weights"),
            "hospitals": ranked.get("hospitals", [])[:limit],
            "retrieved_at": ranked.get("retrieved_at"),
            "source": "CityMind deterministic live hospital ranking API",
        }
    except _ToolAPIError as exc:
        return exc.error


def get_hospital_provenance(incident_id: int, google_place_id: str) -> dict[str, Any]:
    """Extract provenance from the deterministic rank-live response."""
    if not google_place_id:
        return {"success": False, "error_type": "validation_error", "message": "google_place_id is required."}
    ranked = rank_hospitals_for_incident(incident_id, limit=20)
    if not ranked.get("success"):
        return ranked
    hospital = next((item for item in ranked.get("hospitals", []) if item.get("google_place_id") == google_place_id), None)
    if hospital is None:
        return {
            "success": False,
            "error_type": "not_found",
            "incident_id": incident_id,
            "google_place_id": google_place_id,
            "message": "The hospital was not present in the deterministic ranking result.",
        }
    provenance = hospital.get("data_provenance") or {}
    icu_available = hospital.get("icu_available")
    return {
        "success": True,
        "incident_id": incident_id,
        "google_place_id": google_place_id,
        "google_identity_source": provenance.get("identity_source", "Google Places"),
        "mapping_verified": provenance.get("mapping_verified", False),
        "citymind_hospital_id": hospital.get("citymind_hospital_id"),
        "bed_source": hospital.get("capacity_source", "unknown"),
        "icu_source": hospital.get("capacity_source") if icu_available is not None else "unknown",
        "icu_available": icu_available,
        "capacity_timestamp": hospital.get("capacity_timestamp"),
        "capacity_is_simulated": hospital.get("capacity_is_simulated"),
        "stale_data_warnings": hospital.get("stale_data_warnings", []),
        "routing_source": provenance.get("routing_source"),
        "retrieved_at": ranked.get("retrieved_at"),
    }
