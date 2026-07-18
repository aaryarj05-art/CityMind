from collections import defaultdict
from typing import Literal

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.risk_weights import NEARBY_RADIUS_KM
from app.database import get_db
from app.models import Area, Incident, Resource
from app.schemas.risk import AreaRisk, IncidentPriority, RiskSummary
from app.services.incident_priority import calculate_incident_priority
from app.services.risk_engine import calculate_all_area_risks, distance_km, utc_now
from app.services.weather_service import get_current_weather

router = APIRouter(prefix="/risk", tags=["Risk Intelligence"])


async def _weather_by_area(areas: list[Area]) -> dict[int, dict]:
    weather_results = await asyncio.gather(*[
        get_current_weather(area.latitude, area.longitude, area.rainfall)
        for area in areas
    ])
    return {area.id: weather for area, weather in zip(areas, weather_results)}


async def _risk_context(db: Session):
    calculated_at = utc_now()
    area_rows = db.query(Area).all()
    weather_by_area = await _weather_by_area(area_rows)
    area_risks = calculate_all_area_risks(db, calculated_at, weather_by_area)
    areas = {area.id: area for area in area_rows}
    resources = db.query(Resource).all()
    return calculated_at, area_risks, areas, resources


def _nearby_incident_resources(incident: Incident, resources: list[Resource]) -> list[Resource]:
    return [resource for resource in resources if resource.area_id == incident.area_id or distance_km(incident.latitude, incident.longitude, resource.latitude, resource.longitude) <= NEARBY_RADIUS_KM]


async def _all_incident_priorities(db: Session, context: tuple | None = None) -> tuple[list[dict], object]:
    calculated_at, area_risks, areas, resources = context or await _risk_context(db)
    risks_by_area = {risk["area_id"]: risk for risk in area_risks}
    results = []
    for incident in db.query(Incident).all():
        area = areas.get(incident.area_id)
        if area is not None:
            results.append(calculate_incident_priority(incident, risks_by_area[incident.area_id], _nearby_incident_resources(incident, resources), area.name, calculated_at))
    return results, calculated_at


@router.get("/areas", response_model=list[AreaRisk])
async def read_area_risks(risk_level: Literal["Low", "Moderate", "High", "Critical"] | None = None, min_score: float | None = Query(default=None, ge=0, le=100), search: str | None = None, sort_order: Literal["asc", "desc"] = "desc", db: Session = Depends(get_db)):
    _, results, _, _ = await _risk_context(db)
    if risk_level:
        results = [result for result in results if result["risk_level"] == risk_level]
    if min_score is not None:
        results = [result for result in results if result["risk_score"] >= min_score]
    if search:
        needle = search.strip().lower()
        results = [result for result in results if needle in result["area_name"].lower() or needle in result["ward_number"].lower()]
    return sorted(results, key=lambda result: (result["risk_score"], result["area_name"]), reverse=sort_order == "desc")


@router.get("/areas/{area_id}", response_model=AreaRisk)
async def read_area_risk(area_id: int, db: Session = Depends(get_db)):
    _, results, _, _ = await _risk_context(db)
    result = next((risk for risk in results if risk["area_id"] == area_id), None)
    if result is None:
        raise HTTPException(status_code=404, detail="Area not found")
    return result


@router.get("/incidents", response_model=list[IncidentPriority])
async def read_incident_priorities(priority_level: Literal["Routine", "Elevated", "Urgent", "Immediate"] | None = None, status: str | None = None, area_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db)):
    results, _ = await _all_incident_priorities(db)
    if priority_level:
        results = [result for result in results if result["priority_level"] == priority_level]
    if status:
        results = [result for result in results if result["status"].lower() == status.lower()]
    if area_id is not None:
        results = [result for result in results if result["area_id"] == area_id]
    return sorted(results, key=lambda result: (-result["priority_score"], result["incident_id"]))


@router.get("/incidents/{incident_id}", response_model=IncidentPriority)
async def read_incident_priority(incident_id: int, db: Session = Depends(get_db)):
    results, _ = await _all_incident_priorities(db)
    result = next((item for item in results if item["incident_id"] == incident_id), None)
    if result is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.get("/summary", response_model=RiskSummary)
async def read_risk_summary(db: Session = Depends(get_db)):
    context = await _risk_context(db)
    calculated_at, area_risks, _, _ = context
    incident_priorities, _ = await _all_incident_priorities(db, context)
    ranked_areas = sorted(area_risks, key=lambda result: result["risk_score"], reverse=True)
    factor_totals: dict[str, float] = defaultdict(float)
    for result in area_risks:
        for factor, contribution in result["weighted_contributions"].items():
            factor_totals[factor] += contribution
    top_factor = max(factor_totals, key=factor_totals.get) if factor_totals else None
    return {"critical_area_count": sum(result["risk_level"] == "Critical" for result in area_risks), "high_risk_area_count": sum(result["risk_level"] == "High" for result in area_risks), "average_city_risk_score": round(sum(result["risk_score"] for result in area_risks) / len(area_risks), 2) if area_risks else 0.0, "highest_risk_area": ranked_areas[0] if ranked_areas else None, "top_contributing_factor_city_wide": top_factor, "immediate_priority_incident_count": sum(result["priority_level"] == "Immediate" for result in incident_priorities), "last_calculated": calculated_at}
