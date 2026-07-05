"""Read-only security telemetry tools for the advisory security agent."""
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from citymind_agents.tools.internal_api import InternalServiceTokenMissing, internal_auth_error, internal_service_headers

CITYMIND_API_BASE_URL = "http://127.0.0.1:8000/api"


def _read_security_endpoint(endpoint: str, source: str) -> dict[str, Any]:
    try:
        headers = internal_service_headers()
    except InternalServiceTokenMissing:
        return internal_auth_error()
    request = Request(f"{CITYMIND_API_BASE_URL}{endpoint}", headers=headers, method="GET")
    try:
        with urlopen(request, timeout=10) as response:
            return {"success": True, "source": source, "endpoint": f"/api{endpoint}",
                    "data": json.loads(response.read().decode("utf-8")), "read_only": True}
    except HTTPError as exc:
        return {"success": False, "error_type": "http_error", "status_code": exc.code,
                "message": f"CityMind API returned HTTP {exc.code}."}
    except URLError as exc:
        return {"success": False, "error_type": "connection_error",
                "message": "Could not connect to the CityMind backend.", "details": str(exc.reason)}
    except json.JSONDecodeError:
        return {"success": False, "error_type": "invalid_json",
                "message": "CityMind returned a response that was not valid JSON."}
    except Exception as exc:
        return {"success": False, "error_type": "unexpected_error", "message": str(exc)}


def get_security_summary() -> dict[str, Any]:
    """Read verified aggregate security posture; this cannot mutate policy."""
    return _read_security_endpoint("/security/summary", "CityMind security audit API")


def verify_security_audit_integrity() -> dict[str, Any]:
    """Read the verification result for the append-only audit hash chain."""
    return _read_security_endpoint("/security/audit-integrity", "CityMind audit integrity API")


def get_security_agent_health() -> dict[str, Any]:
    """Read observed agent-chain health from recorded decisions."""
    return _read_security_endpoint("/security/agent-health", "CityMind agent health API")


def get_grounding_metrics() -> dict[str, Any]:
    """Read grounding and tool-usage metrics from audited decisions."""
    return _read_security_endpoint("/security/grounding-metrics", "CityMind grounding metrics API")