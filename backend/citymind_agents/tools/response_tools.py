from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from citymind_agents.tools.internal_api import (
    InternalServiceTokenMissing, internal_auth_error, internal_service_headers,
)
from citymind_agents.runtime_config import backend_api_base_url



def get_incident_allocation_plan(incident_id: int) -> dict[str, Any]:
    """
    Retrieve a verified, read-only CityMind allocation plan for an incident.

    Use this tool when the user asks:
    - which resources should respond;
    - which hospital is recommended;
    - what the estimated arrival times are;
    - whether the response plan is complete;
    - whether there are resource shortages.

    Args:
        incident_id: Numeric CityMind incident ID.

    Returns:
        Verified allocation-plan data from CityMind, or a structured error.
    """

    try:
        headers = internal_service_headers()
    except InternalServiceTokenMissing:
        return internal_auth_error()

    url = (
        f"{backend_api_base_url()}/allocation/"
        f"incidents/{incident_id}/plan"
    )

    request = Request(
        url,
        headers=headers,
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            payload = response.read().decode("utf-8")
            data = json.loads(payload)

            return {
                "success": True,
                "source": "CityMind deterministic allocation API",
                "endpoint": (
                    f"/api/allocation/incidents/{incident_id}/plan"
                ),
                "data": data,
            }

    except HTTPError as exc:
        if exc.code == 404:
            message = f"Incident {incident_id} was not found."
        else:
            message = f"CityMind API returned HTTP {exc.code}."

        return {
            "success": False,
            "error_type": "http_error",
            "status_code": exc.code,
            "message": message,
        }

    except URLError as exc:
        return {
            "success": False,
            "error_type": "connection_error",
            "message": (
                "Could not connect to the CityMind backend. "
                "Confirm FastAPI is running on port 8000."
            ),
            "details": str(exc.reason),
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error_type": "invalid_json",
            "message": "CityMind returned invalid JSON.",
        }

    except Exception as exc:
        return {
            "success": False,
            "error_type": "unexpected_error",
            "message": str(exc),
        }


def get_dispatch_summary() -> dict[str, Any]:
    """
    Retrieve the verified CityMind dispatch summary.

    Use this tool when the user asks about:
    - active dispatches;
    - assigned resources;
    - average ETA;
    - incomplete response plans;
    - resource shortages;
    - dispatch status distribution.

    This tool is read-only.
    """

    try:
        headers = internal_service_headers()
    except InternalServiceTokenMissing:
        return internal_auth_error()

    url = f"{backend_api_base_url()}/dispatches/summary"
    request = Request(
        url,
        headers=headers,
        method="GET",
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = response.read().decode("utf-8")
            data = json.loads(payload)

            return {
                "success": True,
                "source": "CityMind dispatch summary API",
                "endpoint": "/api/dispatches/summary",
                "data": data,
            }

    except HTTPError as exc:
        return {
            "success": False,
            "error_type": "http_error",
            "status_code": exc.code,
            "message": f"CityMind API returned HTTP {exc.code}.",
        }

    except URLError as exc:
        return {
            "success": False,
            "error_type": "connection_error",
            "message": (
                "Could not connect to the CityMind backend. "
                "Confirm FastAPI is running on port 8000."
            ),
            "details": str(exc.reason),
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error_type": "invalid_json",
            "message": "CityMind returned invalid JSON.",
        }

    except Exception as exc:
        return {
            "success": False,
            "error_type": "unexpected_error",
            "message": str(exc),
        }