"""Straight-line geographic distance helpers."""

from math import asin, cos, radians, sin, sqrt


def has_valid_coordinates(latitude: float | None, longitude: float | None) -> bool:
    return (
        latitude is not None
        and longitude is not None
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if not all((has_valid_coordinates(lat1, lon1), has_valid_coordinates(lat2, lon2))):
        raise ValueError("Valid latitude and longitude values are required")
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    value = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return round(earth_radius_km * 2 * asin(sqrt(value)), 2)
