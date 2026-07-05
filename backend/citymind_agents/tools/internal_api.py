"""Internal authentication helpers for read-only ADK-to-FastAPI tool calls."""

import os
from typing import Any


class InternalServiceTokenMissing(RuntimeError):
    pass


def internal_service_headers(*, json_content: bool = False) -> dict[str, str]:
    token = os.getenv("CITYMIND_INTERNAL_SERVICE_TOKEN", "")
    if not token:
        raise InternalServiceTokenMissing("Internal service authentication is not configured")
    headers = {
        "Accept": "application/json",
        "X-CityMind-Internal-Token": token,
    }
    if json_content:
        headers["Content-Type"] = "application/json"
    return headers


def internal_auth_error() -> dict[str, Any]:
    return {
        "success": False,
        "error_type": "internal_auth_unavailable",
        "message": "CityMind internal service authentication is not configured.",
    }