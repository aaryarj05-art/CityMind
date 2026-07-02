from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


CITYMIND_API_BASE_URL = "http://127.0.0.1:8000/api"


def get_city_risk_summary() -> dict[str, Any]:
    """
    Retrieve the current verified city-wide risk summary from CityMind.

    Use this tool whenever the user asks about:
    - overall city risk;
    - the highest-risk area;
    - critical or high-risk zones;
    - immediate-priority incidents;
    - the main city-wide risk driver.

    This tool is read-only. It does not modify incidents, resources,
    dispatches, hospitals, or risk values.

    Returns:
        A dictionary containing verified CityMind risk-summary data,
        or a structured error if the backend is unavailable.
    """

    url = f"{CITYMIND_API_BASE_URL}/risk/summary"
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
                "source": "CityMind deterministic risk API",
                "endpoint": "/api/risk/summary",
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
                "Confirm that FastAPI is running on port 8000."
            ),
            "details": str(exc.reason),
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error_type": "invalid_json",
            "message": "CityMind returned a response that was not valid JSON.",
        }

    except Exception as exc:
        return {
            "success": False,
            "error_type": "unexpected_error",
            "message": str(exc),
        }