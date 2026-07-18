"""OpenWeatherMap rainfall lookup with deterministic seeded fallback."""

from __future__ import annotations

import copy
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
REQUEST_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 90
_cache: dict[tuple[Any, ...], tuple[float, dict]] = {}


def clear_weather_cache() -> None:
    _cache.clear()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _key(latitude: float, longitude: float, seeded_rainfall: float | None) -> tuple:
    return ("current_rainfall", round(latitude, 5), round(longitude, 5), round(seeded_rainfall or 0.0, 2))


def _cached(key: tuple) -> dict | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at <= time.monotonic():
        _cache.pop(key, None)
        return None
    return copy.deepcopy(value)


def _store(key: tuple, value: dict) -> dict:
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, copy.deepcopy(value))
    return value


def _warning(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def fallback_weather(seeded_rainfall: float | None, code: str, message: str) -> dict:
    rainfall = float(seeded_rainfall or 0.0)
    return {
        "rainfall_mm": rainfall,
        "precipitation_mm": rainfall,
        "source": "CityMind seeded area rainfall",
        "live_data": False,
        "retrieved_at": _now(),
        "fallback_used": True,
        "warning": _warning(code, message),
    }


def _failure(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, httpx.TimeoutException):
        return "openweather_timeout", "OpenWeatherMap timed out; seeded rainfall is used."
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return "openweather_rate_limited", "OpenWeatherMap rate limit reached; seeded rainfall is used."
        if status in {401, 403}:
            return "openweather_unavailable", "OpenWeatherMap authorization failed; seeded rainfall is used."
        return "openweather_http_error", "OpenWeatherMap was unavailable; seeded rainfall is used."
    if isinstance(exc, (httpx.NetworkError, httpx.RequestError)):
        return "openweather_network_error", "OpenWeatherMap could not be reached; seeded rainfall is used."
    return "openweather_invalid_response", "OpenWeatherMap returned no usable precipitation data; seeded rainfall is used."


def _precipitation_mm(payload: dict) -> float:
    rain = payload.get("rain", {})
    snow = payload.get("snow", {})
    rain = {} if rain is None else rain
    snow = {} if snow is None else snow
    if not isinstance(rain, dict) or not isinstance(snow, dict):
        raise ValueError("Malformed precipitation payload")
    rain_mm = rain.get("1h", rain.get("3h", 0.0))
    snow_mm = snow.get("1h", snow.get("3h", 0.0))
    value = float(rain_mm or 0.0) + float(snow_mm or 0.0)
    if value < 0:
        raise ValueError("Negative precipitation")
    return round(value, 2)


async def get_current_weather(
    latitude: float,
    longitude: float,
    seeded_rainfall: float | None,
    client: httpx.AsyncClient | None = None,
) -> dict:
    key = _key(latitude, longitude, seeded_rainfall)
    cached = _cached(key)
    if cached is not None:
        return cached
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    if not api_key:
        return _store(key, fallback_weather(
            seeded_rainfall,
            "openweather_key_missing",
            "OpenWeatherMap is not configured; seeded rainfall is used.",
        ))
    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": api_key,
        "units": "metric",
    }
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        response = await active_client.get(OPENWEATHER_URL, params=params)
        response.raise_for_status()
        precipitation = _precipitation_mm(response.json())
        result = {
            "rainfall_mm": precipitation,
            "precipitation_mm": precipitation,
            "source": "OpenWeatherMap Current Weather API",
            "live_data": True,
            "retrieved_at": _now(),
            "fallback_used": False,
            "warning": None,
        }
        return _store(key, result)
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        code, message = _failure(exc)
        return _store(key, fallback_weather(seeded_rainfall, code, message))
    finally:
        if owned_client:
            await active_client.aclose()
