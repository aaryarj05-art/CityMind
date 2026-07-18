import httpx
import pytest

from app.models import Area
from app.services.risk_engine import calculate_area_risk
from app.services.weather_service import (
    OPENWEATHER_URL,
    clear_weather_cache,
    get_current_weather,
)

MYSURU = {"latitude": 12.2958, "longitude": 76.6394}
SEEDED_RAINFALL = 18.0


@pytest.fixture(autouse=True)
def weather_environment(monkeypatch):
    clear_weather_cache()
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-weather-key-not-real")
    yield
    clear_weather_cache()


def async_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.anyio
async def test_successful_weather_response_and_cache():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        assert str(request.url).startswith(OPENWEATHER_URL)
        assert request.url.params["appid"] == "test-weather-key-not-real"
        assert request.url.params["units"] == "metric"
        return httpx.Response(200, json={"rain": {"1h": 12.4}})

    async with async_client(handler) as client:
        first = await get_current_weather(MYSURU["latitude"], MYSURU["longitude"], SEEDED_RAINFALL, client)
        second = await get_current_weather(MYSURU["latitude"], MYSURU["longitude"], SEEDED_RAINFALL, client)

    assert calls == 1
    assert first == second
    assert first["rainfall_mm"] == 12.4
    assert first["precipitation_mm"] == 12.4
    assert first["source"] == "OpenWeatherMap Current Weather API"
    assert first["live_data"] is True
    assert first["fallback_used"] is False
    assert first["warning"] is None


@pytest.mark.anyio
@pytest.mark.parametrize("failure,code", [
    ("missing", "openweather_key_missing"),
    ("timeout", "openweather_timeout"),
    ("rate_limit", "openweather_rate_limited"),
    ("malformed", "openweather_invalid_response"),
])
async def test_weather_fallbacks(monkeypatch, failure, code):
    if failure == "missing":
        monkeypatch.delenv("OPENWEATHER_API_KEY")
        result = await get_current_weather(MYSURU["latitude"], MYSURU["longitude"], SEEDED_RAINFALL)
    else:
        def handler(request):
            if failure == "timeout":
                raise httpx.ReadTimeout("timed out", request=request)
            if failure == "rate_limit":
                return httpx.Response(429, request=request)
            return httpx.Response(200, json={"rain": []})

        async with async_client(handler) as client:
            result = await get_current_weather(MYSURU["latitude"], MYSURU["longitude"], SEEDED_RAINFALL, client)

    assert result["rainfall_mm"] == SEEDED_RAINFALL
    assert result["precipitation_mm"] == SEEDED_RAINFALL
    assert result["source"] == "CityMind seeded area rainfall"
    assert result["live_data"] is False
    assert result["fallback_used"] is True
    assert result["warning"]["code"] == code


def test_risk_engine_uses_supplied_live_weather_result():
    area = Area(
        id=1,
        name="Weather Override Area",
        ward_number="W-1",
        latitude=MYSURU["latitude"],
        longitude=MYSURU["longitude"],
        traffic_level="Low",
        rainfall=SEEDED_RAINFALL,
    )
    weather = {
        "rainfall_mm": 74.0,
        "precipitation_mm": 74.0,
        "source": "OpenWeatherMap Current Weather API",
        "live_data": True,
        "fallback_used": False,
        "warning": None,
    }

    result = calculate_area_risk(area, [], [], [], [], weather=weather)

    assert result["factor_scores"]["rainfall"] == 74.0
    assert result["weighted_contributions"]["rainfall"] == 14.8
    assert result["factor_sources"]["rainfall"]["live_data"] is True
    assert result["factor_sources"]["rainfall"]["fallback_used"] is False
