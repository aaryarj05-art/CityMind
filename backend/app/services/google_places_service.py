"""Google Places Nearby Search client for hospital identity and location only."""

from __future__ import annotations

import copy
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx

PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,"
    "places.primaryType,places.businessStatus,places.nationalPhoneNumber,"
    "places.websiteUri,places.googleMapsUri"
)
REQUEST_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 90
_cache: dict[tuple[Any, ...], tuple[float, dict]] = {}


class PlacesUnavailableError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def clear_places_cache() -> None:
    _cache.clear()


def _key(latitude: float, longitude: float, radius: int, limit: int) -> tuple:
    return ("nearby_hospitals", round(latitude, 5), round(longitude, 5), radius, limit)


def _failure(exc: Exception) -> PlacesUnavailableError:
    if isinstance(exc, httpx.TimeoutException):
        return PlacesUnavailableError("google_places_timeout", "Google Places timed out.")
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code == 429:
            return PlacesUnavailableError("google_places_rate_limited", "Google Places rate limit reached.")
        if exc.response.status_code in {401, 403}:
            return PlacesUnavailableError("google_places_unavailable", "Google Places authorization failed.")
        return PlacesUnavailableError("google_places_http_error", "Google Places is unavailable.")
    if isinstance(exc, (httpx.NetworkError, httpx.RequestError)):
        return PlacesUnavailableError("google_places_network_error", "Google Places could not be reached.")
    return PlacesUnavailableError("google_places_invalid_response", "Google Places returned an invalid response.")


async def search_nearby_hospitals(
    latitude: float,
    longitude: float,
    radius: int = 10000,
    limit: int = 10,
    client: httpx.AsyncClient | None = None,
) -> dict:
    key = _key(latitude, longitude, radius, limit)
    cached = _cache.get(key)
    if cached and cached[0] > time.monotonic():
        return copy.deepcopy(cached[1])
    api_key = os.getenv("GOOGLE_MAPS_SERVER_API_KEY")
    if not api_key:
        raise PlacesUnavailableError("google_maps_key_missing", "Google Maps is not configured.")
    body = {
        "includedTypes": ["hospital"],
        "maxResultCount": limit,
        "locationRestriction": {"circle": {
            "center": {"latitude": latitude, "longitude": longitude},
            "radius": radius,
        }},
        "languageCode": "en",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
    }
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        response = await active_client.post(PLACES_URL, headers=headers, json=body)
        response.raise_for_status()
        payload = response.json()
        places = payload.get("places", [])
        if not isinstance(places, list):
            raise ValueError("Malformed places response")
        retrieved_at = datetime.now(timezone.utc)
        hospitals = []
        for place in places:
            try:
                location = place["location"]
                place_id = place["id"]
                place_latitude = float(location["latitude"])
                place_longitude = float(location["longitude"])
                if not place_id or not (-90 <= place_latitude <= 90 and -180 <= place_longitude <= 180):
                    continue
                display_name = place.get("displayName")
                name = display_name.get("text") if isinstance(display_name, dict) else None
                hospitals.append({
                    "google_place_id": place_id,
                    "name": name,
                    "formatted_address": place.get("formattedAddress"),
                    "latitude": place_latitude,
                    "longitude": place_longitude,
                    "primary_type": place.get("primaryType"),
                    "business_status": place.get("businessStatus"),
                    "national_phone_number": place.get("nationalPhoneNumber"),
                    "website_uri": place.get("websiteUri"),
                    "google_maps_uri": place.get("googleMapsUri"),
                    "identity_source": "Google Places",
                    "retrieved_at": retrieved_at,
                })
            except (KeyError, TypeError, ValueError):
                continue
        result = {
            "hospitals": hospitals[:limit],
            "retrieved_at": retrieved_at,
            "source": "Google Places API",
            "live_data": True,
            "notice": (
                "Google Places supplies identity and location data only; it does not confirm "
                "beds, ICU capability, or emergency admission."
            ),
        }
        _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, copy.deepcopy(result))
        return result
    except PlacesUnavailableError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise _failure(exc) from None
    finally:
        if owned_client:
            await active_client.aclose()
