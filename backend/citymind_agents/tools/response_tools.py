from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


CITYMIND_API_BASE_URL = "http://127.0.0.1:8000/api"


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

    url = (
        f"{CITYMIND_API_BASE_URL}/allocation/"
        f"incidents/{incident_id}/plan"
    )

    request = Request(
        url,
        headers={"Accept": "application/json"},
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

    url = f"{CITYMIND_API_BASE_URL}/dispatches/summary"
    request = Request(
        url,
        headers={"Accept": "application/json"},
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