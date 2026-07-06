"""Validated runtime configuration shared by the API entrypoint and services."""

from __future__ import annotations

import os
from urllib.parse import urlsplit

LOCAL_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def environment_name() -> str:
    return (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").strip().lower()



def judge_open_access() -> bool:
    return os.getenv("CITYMIND_JUDGE_OPEN_ACCESS", "false").strip().lower() in {"1", "true", "yes", "on"}

def is_production() -> bool:
    # ENVIRONMENT is the explicit deployment switch; APP_ENV remains a legacy feature gate.
    return os.getenv("ENVIRONMENT", "").strip().lower() == "production"


def _validate_http_url(value: str, setting: str, *, reject_loopback: bool = False) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError(f"{setting} must be an absolute http(s) URL")
    if reject_loopback and parsed.hostname.lower() in LOOPBACK_HOSTS:
        raise RuntimeError(f"{setting} must not use localhost in production")
    return value.rstrip("/")


def adk_base_url() -> str:
    configured = os.getenv("ADK_BASE_URL", "").strip()
    if not configured:
        if is_production():
            raise RuntimeError("ADK_BASE_URL is required in production")
        configured = "http://127.0.0.1:8001"
    return _validate_http_url(configured, "ADK_BASE_URL", reject_loopback=is_production())


def allowed_origins() -> list[str]:
    raw = os.getenv("CITYMIND_ALLOWED_ORIGINS", "").strip()
    if not raw:
        legacy = os.getenv("FRONTEND_ORIGIN", "").strip()
        if legacy:
            raw = legacy
        elif is_production():
            raise RuntimeError("CITYMIND_ALLOWED_ORIGINS is required in production")
        else:
            return list(LOCAL_ORIGINS)

    origins: list[str] = []
    for candidate in raw.split(","):
        origin = candidate.strip().rstrip("/")
        if not origin:
            continue
        if "*" in origin:
            raise RuntimeError("CITYMIND_ALLOWED_ORIGINS must contain exact origins, not wildcards")
        parsed = urlsplit(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise RuntimeError("CITYMIND_ALLOWED_ORIGINS contains an invalid origin")
        if parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise RuntimeError("CITYMIND_ALLOWED_ORIGINS must contain origins without paths or credentials")
        if origin not in origins:
            origins.append(origin)
    if not origins:
        raise RuntimeError("CITYMIND_ALLOWED_ORIGINS must contain at least one origin")
    return origins


def validate_api_production_config() -> None:
    if not is_production():
        return
    required = (
        "GOOGLE_MAPS_SERVER_API_KEY",
        "GOOGLE_OAUTH_CLIENT_ID",
        "CITYMIND_JWT_SECRET",
        "CITYMIND_INTERNAL_SERVICE_TOKEN",
        "CITYMIND_ROLE_MAPPINGS_JSON",
    )
    missing = [name for name in required if not os.getenv(name, "").strip()]
    adk_base_url()
    allowed_origins()
    if missing:
        raise RuntimeError("Missing required production configuration: " + ", ".join(missing))
