"""Deterministic fast-path answers for demo-safe AI operations."""

from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import Area, Incident, Resource
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.allocation_engine import build_allocation_plan
from app.services.dispatch_service import dispatch_summary
from app.services.incident_priority import calculate_incident_priority
from app.services.risk_engine import ACTIVE_INCIDENT_STATUSES, calculate_all_area_risks, distance_km

FAST_PATH_SOURCE = "deterministic_backend_fast_path"
FALLBACK_SOURCE = "deterministic_backend_adk_fallback"
FAST_PATH_NOTE = "Generated from CityMind deterministic operational data. Google ADK remains available for complex multi-agent analysis."
HUMAN_APPROVAL_NOTE = "Human approval is required before any simulated operational action."


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(word in text for word in words)


def classify_fast_path_intent(prompt: str, known_areas: list[str] | None = None) -> dict[str, str | None]:
    text = _normalize(prompt)
    for area in known_areas or []:
        normalized_area = _normalize(area)
        if normalized_area and normalized_area in text:
            return {"intent": "area_status", "area_name": area}
    if _has(text, ("public alert", "public message", "citizen alert", "generate alert")):
        return {"intent": "public_alert", "area_name": None}
    if _has(text, ("executive briefing", "briefing", "mayor summary", "commissioner summary")):
        return {"intent": "executive_briefing", "area_name": None}
    if _has(text, ("response plan", "operator do next", "what should the operator", "generate response plan", "next step")):
        return {"intent": "response_plan", "area_name": None}
    if _has(text, ("dispatch situation", "active dispatch", "dispatches", "dispatch summary")):
        return {"intent": "dispatch_summary", "area_name": None}
    if _has(text, ("resource shortage", "resource shortages", "resources available", "available resources", "what resources", "shortages")):
        return {"intent": "resource_shortages", "area_name": None}
    if _has(text, ("priority incident", "priority incidents", "show priority", "urgent incident", "immediate incident")):
        return {"intent": "priority_incidents", "area_name": None}
    if _has(text, ("highest risk", "highest attention", "which area")):
        return {"intent": "highest_risk_area", "area_name": None}
    if _has(text, ("city risk", "city wide risk", "citywide risk", "risk situation", "current risk", "risk summary")):
        return {"intent": "city_risk_summary", "area_name": None}
    return {"intent": "security_or_unknown", "area_name": None}


def _risk_rows(db: Session) -> tuple[list[dict[str, Any]], datetime]:
    calculated_at = datetime.now(timezone.utc)
    risks = calculate_all_area_risks(db, calculated_at)
    active_counts = Counter(incident.area_id for incident in db.query(Incident).filter(Incident.status.in_(ACTIVE_INCIDENT_STATUSES)).all())
    for risk in risks:
        risk["active_incidents"] = active_counts.get(risk["area_id"], 0)
    return risks, calculated_at


def _priorities(db: Session, risks: list[dict[str, Any]], calculated_at: datetime) -> list[dict[str, Any]]:
    risk_by_area = {risk["area_id"]: risk for risk in risks}
    areas = {area.id: area for area in db.query(Area).all()}
    resources = db.query(Resource).all()
    rows = []
    for incident in db.query(Incident).all():
        area = areas.get(incident.area_id)
        risk = risk_by_area.get(incident.area_id)
        if not area or not risk:
            continue
        nearby = [resource for resource in resources if resource.area_id == incident.area_id or distance_km(incident.latitude, incident.longitude, resource.latitude, resource.longitude) <= 5.0]
        rows.append(calculate_incident_priority(incident, risk, nearby, area.name, calculated_at))
    return sorted(rows, key=lambda item: (-item["priority_score"], item["incident_id"]))


def _summary(db: Session) -> dict[str, Any]:
    risks, calculated_at = _risk_rows(db)
    priorities = _priorities(db, risks, calculated_at)
    ranked = sorted(risks, key=lambda item: (-item["risk_score"], item["area_id"]))
    average = round(sum(item["risk_score"] for item in risks) / len(risks), 2) if risks else 0.0
    return {
        "risks": risks,
        "priorities": priorities,
        "dispatch": dispatch_summary(db),
        "highest": ranked[0] if ranked else None,
        "average_risk": average,
        "critical_area_count": sum(item["risk_level"] == "Critical" for item in risks),
        "high_area_count": sum(item["risk_level"] == "High" for item in risks),
        "immediate_incidents": sum(item["priority_level"] == "Immediate" for item in priorities),
        "urgent_incidents": sum(item["priority_level"] == "Urgent" for item in priorities),
    }


def _drivers(risk: dict[str, Any] | None) -> str:
    factors = [item["factor"].replace("_", " ") for item in (risk or {}).get("top_contributing_factors", [])[:3]]
    return ", ".join(factors) if factors else "multiple operational factors"


def _data_note() -> str:
    return "Data note:\nMap, route, traffic, and facility-location intelligence use live or near-live Google services where available. Vehicle availability, staffing, hospital capacity, and dispatch state are simulated for prototype demonstration."


def _base(session_id: str | None, response: str, tools: list[str], source: str = FAST_PATH_SOURCE, limitations: list[str] | None = None) -> dict[str, Any]:
    return {
        "session_id": session_id or f"fast-path-{uuid.uuid4().hex[:12]}",
        "response": response,
        "agents_used": [source],
        "tools_used": tools,
        "grounded": True,
        "status": "ok",
        "source": source,
        "ai_assisted": False,
        "human_approval_required": True,
        "note": FAST_PATH_NOTE,
        "limitations": limitations or [SIMULATION_DISCLAIMER, HUMAN_APPROVAL_NOTE],
    }


def _city(s: dict[str, Any]) -> str:
    h = s["highest"]
    return f"Current city-wide risk situation:\nCityMind's current average city risk score is {s['average_risk']}/100. There are {s['critical_area_count']} critical-risk zones, {s['high_area_count']} high-risk zones, and {s['immediate_incidents']} immediate-priority incidents in the current dataset.\n\nVerified facts:\n- Highest-risk area: {h['area_name'] if h else 'Not available'}\n- Highest risk level: {h['risk_level'] if h else 'Not available'}\n- Highest risk score: {h['risk_score'] if h else 'Not available'}\n- Active dispatches: {s['dispatch'].get('active_dispatch_count', 0)}\n- Main city attention driver: {_drivers(h)}\n\nRecommended next step:\nReview the Risk Zones and Live Response Intelligence views before approving any simulated response action.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _highest(s: dict[str, Any]) -> str:
    h = s["highest"]
    if not h:
        return "CityMind could not identify a highest-risk area from the current deterministic dataset.\n\n" + FAST_PATH_NOTE
    return f"Current assessment: {h['area_name']} is the highest-risk area in the current CityMind dataset, classified as {h['risk_level']} risk with a score of {h['risk_score']}/100. The main contributing drivers are {_drivers(h)}.\n\nVerified facts:\n- Highest-risk area: {h['area_name']}\n- Risk level: {h['risk_level']}\n- City risk score: {s['average_risk']}/100\n- Immediate incidents: {s['immediate_incidents']}\n- Active dispatches: {s['dispatch'].get('active_dispatch_count', 0)}\n\nRecommended next step:\nReview related incidents in Risk Zones or open Live Response Intelligence before approving any simulated response action.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _area(s: dict[str, Any], area_name: str) -> str:
    risk = next((item for item in s["risks"] if item["area_name"] == area_name), None)
    if not risk:
        return _highest(s)
    return f"Current assessment: {risk['area_name']} is classified as {risk['risk_level']} risk with a score of {risk['risk_score']}/100. The main contributing drivers are {_drivers(risk)}.\n\nVerified facts:\n- Area: {risk['area_name']}\n- Ward: {risk['ward_number']}\n- Risk level: {risk['risk_level']}\n- Active incidents in area: {risk.get('active_incidents', 0)}\n- City risk score: {s['average_risk']}/100\n- Immediate incidents city-wide: {s['immediate_incidents']}\n- Active dispatches city-wide: {s['dispatch'].get('active_dispatch_count', 0)}\n\nRecommended next step:\nReview related incidents in Risk Zones or open Live Response Intelligence before approving any simulated response action.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _priority(s: dict[str, Any]) -> str:
    rows = [item for item in s["priorities"] if item["priority_level"] in {"Immediate", "Urgent"}] or s["priorities"][:5]
    lines = [f"- #{item['incident_id']} {item['title']} in {item['area_name']}: {item['priority_level']} priority, score {item['priority_score']}/100, status {item['status']}" for item in rows[:5]] or ["- No incidents are currently available in the deterministic dataset."]
    return "Priority incidents:\n" + f"CityMind currently has {s['immediate_incidents']} immediate and {s['urgent_incidents']} urgent priority incidents.\n\nVerified incident list:\n" + "\n".join(lines) + f"\n\nRecommended next step:\nOpen the incident details and allocation plan before approving any simulated dispatch lifecycle action.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _dispatch(s: dict[str, Any]) -> str:
    d = s["dispatch"]
    status_lines = [f"- {status}: {count}" for status, count in sorted(d.get("dispatches_by_status", {}).items())] or ["- No dispatches recorded"]
    return f"Dispatch situation:\nThere are {d.get('active_dispatch_count', 0)} active simulated dispatches, {d.get('resources_currently_assigned', 0)} resources currently assigned, and an average ETA of {d.get('average_eta', 0)} minutes.\n\nVerified dispatch status counts:\n" + "\n".join(status_lines) + f"\n\nIncomplete active response plans: {d.get('incomplete_response_plan_count', 0)}\n\nRecommended next step:\nReview each dispatch detail before approving status transitions. CityMind AI does not execute dispatch actions.\n\n{FAST_PATH_NOTE}"


def _resources(db: Session, s: dict[str, Any]) -> str:
    totals, available = Counter(), Counter()
    for resource_type, status in db.query(Resource.resource_type, Resource.status).all():
        totals[resource_type] += 1
        if status == "Available":
            available[resource_type] += 1
    lines = [f"- {resource_type}: {available.get(resource_type, 0)} available of {total} total" for resource_type, total in sorted(totals.items())] or ["- No resource records are available."]
    shortages = [f"- {resource_type}: {count}" for resource_type, count in sorted(s["dispatch"].get("resource_shortages_by_type", {}).items())] or ["- No active dispatch shortages recorded"]
    return "Resource availability and shortages:\nVerified availability:\n" + "\n".join(lines) + "\n\nActive dispatch shortages:\n" + "\n".join(shortages) + f"\n\nRecommended next step:\nUse the Resources and Dispatch views to validate simulated availability before approving any action.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _plan(db: Session, s: dict[str, Any]) -> str:
    active = [item for item in s["priorities"] if item["status"] in ACTIVE_INCIDENT_STATUSES]
    target = active[0] if active else (s["priorities"][0] if s["priorities"] else None)
    if not target:
        return "No current incident is available for a deterministic response plan.\n\n" + FAST_PATH_NOTE
    incident = db.get(Incident, target["incident_id"])
    try:
        plan = build_allocation_plan(db, incident) if incident else {}
    except Exception:
        plan = {}
    required = plan.get("required_resources", {})
    recommended = plan.get("recommended_resources", [])
    shortages = plan.get("shortages", {})
    req_text = ", ".join(f"{count} {name}" for name, count in required.items()) or "no configured resource requirement"
    rec_lines = [f"- {item['resource_code']} ({item['required_type']}), ETA {item['eta']['estimated_arrival_minutes']} min" for item in recommended[:5]] or ["- No eligible recommended resource available"]
    shortage_text = ", ".join(f"{name}: {count}" for name, count in shortages.items()) or "none"
    return f"Deterministic response plan for Incident #{target['incident_id']} - {target['title']}:\nPriority: {target['priority_level']} ({target['priority_score']}/100) in {target['area_name']}.\nRequired resources: {req_text}.\nShortages: {shortage_text}.\n\nRecommended resources:\n" + "\n".join(rec_lines) + f"\n\nOperator next steps:\n1. Review the allocation plan and live response context.\n2. Confirm simulated resource eligibility and hospital context where relevant.\n3. Use the dispatch workflow only after human approval.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _alert(s: dict[str, Any]) -> str:
    h = s["highest"]
    area = h["area_name"] if h else "the city"
    return f"Draft public alert for operator review:\nCityMind is monitoring elevated operational activity around {area}. Please follow official instructions, avoid affected roads where possible, and allow emergency vehicles to pass. This is an informational prototype message and must be reviewed by an authorized operator before publication.\n\nVerified context:\n- Highest attention area: {area}\n- Risk level: {h['risk_level'] if h else 'Not available'}\n- Active dispatches: {s['dispatch'].get('active_dispatch_count', 0)}\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def _briefing(s: dict[str, Any]) -> str:
    h = s["highest"]
    return f"Executive briefing:\nCityMind reports an average city risk score of {s['average_risk']}/100, with {s['critical_area_count']} critical-risk zones, {s['high_area_count']} high-risk zones, {s['immediate_incidents']} immediate-priority incidents, and {s['dispatch'].get('active_dispatch_count', 0)} active simulated dispatches. The highest attention area is {h['area_name'] if h else 'not available'} at {h['risk_level'] if h else 'not available'} risk.\n\nRecommended executive focus:\n- Review highest-risk zones and priority incidents.\n- Confirm any simulated dispatch approvals remain human-controlled.\n- Treat resource availability, staffing, and hospital capacity as prototype simulation unless explicitly verified.\n\n{_data_note()}\n\n{FAST_PATH_NOTE}"


def build_fast_path_response(db: Session, prompt: str, session_id: str | None = None) -> dict[str, Any] | None:
    areas = [name for (name,) in db.query(Area.name).all()]
    classified = classify_fast_path_intent(prompt, areas)
    intent = classified["intent"]
    if intent == "security_or_unknown":
        return None
    s = _summary(db)
    tools = ["calculate_all_area_risks", "calculate_incident_priority", "dispatch_summary"]
    if intent == "city_risk_summary": answer = _city(s)
    elif intent == "highest_risk_area": answer = _highest(s)
    elif intent == "area_status": answer = _area(s, classified["area_name"] or "")
    elif intent == "priority_incidents": answer = _priority(s)
    elif intent == "dispatch_summary": answer, tools = _dispatch(s), ["dispatch_summary"]
    elif intent == "resource_shortages": answer, tools = _resources(db, s), ["dispatch_summary", "resource_counts"]
    elif intent == "response_plan": answer = _plan(db, s); tools.append("build_allocation_plan")
    elif intent == "public_alert": answer = _alert(s)
    elif intent == "executive_briefing": answer = _briefing(s)
    else: return None
    return _base(session_id, answer, tools)


def build_adk_fallback_response(db: Session, prompt: str, session_id: str | None = None, reason: str | None = None) -> dict[str, Any]:
    s = _summary(db)
    h = s["highest"]
    response = f"Google ADK did not complete within the demo-safe response budget, so CityMind is returning a deterministic operational fallback instead of failing the request.\n\nCurrent verified snapshot:\n- Average city risk score: {s['average_risk']}/100\n- Highest-risk area: {h['area_name'] if h else 'Not available'}\n- Highest risk level: {h['risk_level'] if h else 'Not available'}\n- Immediate-priority incidents: {s['immediate_incidents']}\n- Active dispatches: {s['dispatch'].get('active_dispatch_count', 0)}\n\nDeterministic tools remain available for risk, incident priority, dispatch, resources, and public-communication drafting. For complex multi-agent analysis, retry when ADK latency recovers.\n\n{_data_note()}"
    limitations = ["Google ADK did not complete within the internal demo-safe budget.", "This fallback is generated from deterministic CityMind backend data, not a Gemini response.", SIMULATION_DISCLAIMER, HUMAN_APPROVAL_NOTE]
    if reason:
        limitations.append(f"ADK fallback reason: {reason}")
    return _base(session_id, response, ["calculate_all_area_risks", "dispatch_summary"], FALLBACK_SOURCE, limitations)