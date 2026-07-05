"""Google Routes clients with deterministic, non-live CityMind fallbacks."""

from __future__ import annotations

import copy
import os
import re
import time
from datetime import datetime, timezone
from math import ceil
from typing import Any

import httpx

from app.config.allocation_rules import AVERAGE_SPEED_KMH, MINIMUM_ETA_MINUTES
from app.services.distance_service import haversine_km

ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
ROUTE_FIELD_MASK = (
    "routes.distanceMeters,routes.duration,routes.staticDuration,"
    "routes.polyline.encodedPolyline"
)
MATRIX_FIELD_MASK = (
    "originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration"
)
CACHE_TTL_SECONDS = 90
REQUEST_TIMEOUT_SECONDS = 8.0
_DURATION = re.compile(r"^(\d+(?:\.\d+)?)s$")
_cache: dict[tuple[Any, ...], tuple[float, Any]] = {}


def clear_route_cache() -> None:
    _cache.clear()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(request_type: str, origins: list[dict], destination: dict) -> tuple:
    points = tuple(
        (item.get("resource_id"), round(item["latitude"], 5), round(item["longitude"], 5))
        for item in origins
    )
    return (
        request_type,
        points,
        round(destination["latitude"], 5),
        round(destination["longitude"], 5),
    )


def _cached(key: tuple) -> Any | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at <= time.monotonic():
        _cache.pop(key, None)
        return None
    return copy.deepcopy(value)


def _store(key: tuple, value: Any) -> Any:
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, copy.deepcopy(value))
    return value


def parse_google_duration(value: Any) -> int:
    """Parse a protobuf duration such as ``840s`` into whole seconds."""
    if not isinstance(value, str):
        raise ValueError("Google duration must be a string")
    match = _DURATION.fullmatch(value)
    if match is None:
        raise ValueError("Malformed Google duration")
    return max(0, ceil(float(match.group(1))))


def congestion_level(ratio: float) -> str:
    """Return CityMind-derived labels; Google does not provide these labels."""
    if ratio < 1.10:
        return "low"
    if ratio < 1.30:
        return "moderate"
    if ratio < 1.60:
        return "heavy"
    return "severe"


def _fallback_values(origin: dict, destination: dict) -> dict:
    distance_meters = round(
        haversine_km(
            origin["latitude"], origin["longitude"],
            destination["latitude"], destination["longitude"],
        ) * 1000
    )
    speed = AVERAGE_SPEED_KMH["Ambulance"]
    seconds = max(round(MINIMUM_ETA_MINUTES * 60), ceil(distance_meters / 1000 / speed * 3600))
    return {
        "distance_meters": distance_meters,
        "traffic_duration_seconds": seconds,
        "static_duration_seconds": seconds,
        "traffic_delay_seconds": 0,
    }


def _warning(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def fallback_route(origin: dict, destination: dict, code: str, message: str) -> dict:
    values = _fallback_values(origin, destination)
    return {
        **values,
        "congestion_ratio": 1.0,
        "congestion_level": "low",
        "encoded_polyline": None,
        "source": "CityMind estimated fallback",
        "live_data": False,
        "retrieved_at": _now(),
        "fallback_used": True,
        "warning": _warning(code, message),
    }


def _failure(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, httpx.TimeoutException):
        return "google_routes_timeout", "Google Routes timed out; a fixed-speed estimate is shown."
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return "google_routes_rate_limited", "Google Routes rate limit reached; a fixed-speed estimate is shown."
        if status in {401, 403}:
            return "google_routes_unavailable", "Google Routes authorization failed; a fixed-speed estimate is shown."
        return "google_routes_http_error", "Google Routes was unavailable; a fixed-speed estimate is shown."
    if isinstance(exc, (httpx.NetworkError, httpx.RequestError)):
        return "google_routes_network_error", "Google Routes could not be reached; a fixed-speed estimate is shown."
    return "google_routes_invalid_response", "Google Routes returned no usable route; a fixed-speed estimate is shown."


def _headers(api_key: str, field_mask: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
    }


def _waypoint(point: dict) -> dict:
    return {"waypoint": {"location": {"latLng": {
        "latitude": point["latitude"], "longitude": point["longitude"]
    }}}}


async def compute_route(origin: dict, destination: dict, client: httpx.AsyncClient | None = None) -> dict:
    key = _cache_key("route", [origin], destination)
    cached = _cached(key)
    if cached is not None:
        return cached
    api_key = os.getenv("GOOGLE_MAPS_SERVER_API_KEY")
    if not api_key:
        return _store(key, fallback_route(
            origin, destination, "google_maps_key_missing",
            "Google Maps is not configured; a fixed-speed estimate is shown.",
        ))
    body = {
        "origin": _waypoint(origin)["waypoint"],
        "destination": _waypoint(destination)["waypoint"],
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
        "languageCode": "en-IN",
        "units": "METRIC",
    }
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        response = await active_client.post(ROUTES_URL, headers=_headers(api_key, ROUTE_FIELD_MASK), json=body)
        response.raise_for_status()
        routes = response.json().get("routes")
        if not isinstance(routes, list) or not routes:
            raise ValueError("Empty route result")
        route = routes[0]
        distance = int(route["distanceMeters"])
        traffic = parse_google_duration(route["duration"])
        static = parse_google_duration(route["staticDuration"])
        if distance < 0 or traffic < 0 or static <= 0:
            raise ValueError("Invalid route metrics")
        ratio = traffic / static
        result = {
            "distance_meters": distance,
            "traffic_duration_seconds": traffic,
            "static_duration_seconds": static,
            "traffic_delay_seconds": max(traffic - static, 0),
            "congestion_ratio": round(ratio, 3),
            "congestion_level": congestion_level(ratio),
            "encoded_polyline": route.get("polyline", {}).get("encodedPolyline"),
            "source": "Google Routes API",
            "live_data": True,
            "retrieved_at": _now(),
            "fallback_used": False,
            "warning": None,
        }
        return _store(key, result)
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        code, message = _failure(exc)
        return _store(key, fallback_route(origin, destination, code, message))
    finally:
        if owned_client:
            await active_client.aclose()


async def compute_route_matrix(
    origins: list[dict], destination: dict, client: httpx.AsyncClient | None = None
) -> dict:
    key = _cache_key("matrix", origins, destination)
    cached = _cached(key)
    if cached is not None:
        return cached
    retrieved_at = _now()
    api_key = os.getenv("GOOGLE_MAPS_SERVER_API_KEY")
    if not api_key:
        rankings = []
        for origin in origins:
            rankings.append({
                "resource_id": origin["resource_id"], **_fallback_values(origin, destination),
                "source": "CityMind estimated fallback", "live_data": False,
            })
        rankings.sort(key=lambda item: (item["traffic_duration_seconds"], item["resource_id"]))
        for rank, item in enumerate(rankings, 1):
            item["rank"] = rank
        return _store(key, {
            "rankings": rankings, "retrieved_at": retrieved_at, "fallback_used": True,
            "warning": _warning("google_maps_key_missing", "Google Maps is not configured; fixed-speed estimates are shown."),
        })
    body = {
        "origins": [_waypoint(origin) for origin in origins],
        "destinations": [_waypoint(destination)],
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    warning = None
    fallback_used = False
    try:
        response = await active_client.post(MATRIX_URL, headers=_headers(api_key, MATRIX_FIELD_MASK), json=body)
        response.raise_for_status()
        elements = response.json()
        if not isinstance(elements, list):
            raise ValueError("Malformed matrix response")
        by_index = {}
        for element in elements:
            try:
                index = int(element["originIndex"])
                if index < 0 or index >= len(origins) or element.get("condition") != "ROUTE_EXISTS":
                    continue
                status = element.get("status", {})
                if status and status.get("code", 0) != 0:
                    continue
                traffic = parse_google_duration(element["duration"])
                static = parse_google_duration(element["staticDuration"])
                distance = int(element["distanceMeters"])
                if static <= 0 or distance < 0:
                    continue
                by_index[index] = {
                    "resource_id": origins[index]["resource_id"],
                    "distance_meters": distance,
                    "traffic_duration_seconds": traffic,
                    "static_duration_seconds": static,
                    "traffic_delay_seconds": max(traffic - static, 0),
                    "source": "Google Routes API", "live_data": True,
                }
            except (ValueError, KeyError, TypeError):
                continue
        rankings = []
        for index, origin in enumerate(origins):
            item = by_index.get(index)
            if item is None:
                fallback_used = True
                item = {
                    "resource_id": origin["resource_id"], **_fallback_values(origin, destination),
                    "source": "CityMind estimated fallback", "live_data": False,
                }
            rankings.append(item)
        if fallback_used:
            warning = _warning(
                "google_routes_partial_response",
                "Some matrix elements were unavailable and use fixed-speed estimates.",
            )
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        fallback_used = True
        code, message = _failure(exc)
        warning = _warning(code, message)
        rankings = [{
            "resource_id": origin["resource_id"], **_fallback_values(origin, destination),
            "source": "CityMind estimated fallback", "live_data": False,
        } for origin in origins]
    finally:
        if owned_client:
            await active_client.aclose()
    rankings.sort(key=lambda item: (item["traffic_duration_seconds"], item["distance_meters"], item["resource_id"]))
    for rank, item in enumerate(rankings, 1):
        item["rank"] = rank
    return _store(key, {
        "rankings": rankings, "retrieved_at": retrieved_at,
        "fallback_used": fallback_used, "warning": warning,
    })
