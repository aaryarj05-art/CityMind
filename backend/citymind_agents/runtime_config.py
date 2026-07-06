"""Runtime configuration for ADK-to-API service calls."""

from __future__ import annotations

import os
from urllib.parse import urlsplit

LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def environment_name() -> str:
    return (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "development").strip().lower()


def backend_api_base_url() -> str:
    configured = os.getenv("CITYMIND_BACKEND_BASE_URL", "").strip()
    if not configured:
        if environment_name() == "production":
            raise RuntimeError("CITYMIND_BACKEND_BASE_URL is required in production")
        configured = "http://127.0.0.1:8000"

    parsed = urlsplit(configured)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError("CITYMIND_BACKEND_BASE_URL must be an absolute http(s) URL")
    if environment_name() == "production" and parsed.hostname.lower() in LOOPBACK_HOSTS:
        raise RuntimeError("CITYMIND_BACKEND_BASE_URL must not use localhost in production")

    base = configured.rstrip("/")
    return base if base.endswith("/api") else f"{base}/api"


def validate_adk_production_config() -> None:
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    if gemini_key and not os.getenv("GOOGLE_API_KEY", "").strip():
        # Google ADK/GenAI recognizes GOOGLE_API_KEY; copy in memory only and never log it.
        os.environ["GOOGLE_API_KEY"] = gemini_key
    if environment_name() != "production":
        return
    missing = []
    if not gemini_key:
        missing.append("GEMINI_API_KEY or GOOGLE_API_KEY")
    if not os.getenv("CITYMIND_INTERNAL_SERVICE_TOKEN", "").strip():
        missing.append("CITYMIND_INTERNAL_SERVICE_TOKEN")
    backend_api_base_url()
    if missing:
        raise RuntimeError("Missing required production configuration: " + ", ".join(missing))


if __name__ == "__main__":
    validate_adk_production_config()
