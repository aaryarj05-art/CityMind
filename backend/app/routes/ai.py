import asyncio
import logging
import re
from datetime import timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_permission
from app.runtime_config import adk_base_url
from app.schemas.ai import AIQueryRequest, AIQueryResponse
from app.services.adk_service import ADKServiceError, query_citymind_agents
from app.services.ai_fast_path import FALLBACK_SOURCE, FAST_PATH_SOURCE, build_adk_fallback_response, build_fast_path_response
from app.services.ai_security_gateway import RateLimitExceeded, evaluate_prompt
from app.services.auth_service import AuthenticatedUser
from app.services.security_audit import append_security_event, new_decision_id

router = APIRouter(prefix="/api/ai", tags=["AI"])
logger = logging.getLogger(__name__)
ADK_DEMO_BUDGET_SECONDS = 25.0


def _metadata(request: Request) -> tuple[str | None, str | None]:
    return (request.client.host if request.client else None, request.headers.get("user-agent"))


def _assurance(result: dict) -> tuple[str, list[str], list[str]]:
    text = result.get("response", "").lower()
    grounded = result.get("grounded") is True
    tools = result.get("tools_used") or []
    limitations: list[str] = []
    reasons: list[str] = []
    low_markers = ("fallback", "unavailable", "could not connect", "incomplete")
    medium_markers = ("simulated", "stale", "unknown", "not tracked")
    if not grounded:
        limitations.append("The response was not confirmed as grounded by the result.")
        reasons.append("Grounding was not confirmed.")
        return "Low", reasons, limitations
    if any(marker in text for marker in low_markers):
        limitations.append("One or more sources were unavailable, incomplete, or used a labelled fallback.")
        reasons.append("The response includes unavailable, incomplete, or fallback data.")
        return "Low", reasons, limitations
    if any(marker in text for marker in medium_markers):
        limitations.append("Some verified fields are simulated, stale, untracked, or unknown.")
        reasons.append("The response includes qualified data provenance.")
        return "Medium", reasons, limitations
    if not tools:
        limitations.append("No deterministic tool invocation was observed for this response.")
        reasons.append("The response is grounded but has no observed tool metadata.")
        return "Medium", reasons, limitations
    reasons.append("Verified tools completed with no fallback or qualified-data marker detected.")
    return "High", reasons, limitations


def _unsupported_operational_claim(text: str) -> bool:
    return bool(re.search(
        r"(?i)\b(ambulance|resource|unit)\s+(has been|was|is now)\s+(dispatched|cancelled|completed|en route)\b|"
        r"\bhospital\s+(has\s+)?(accepted|reserved|confirmed admission)\b|\bbed\s+(has been|was)\s+reserved\b",
        text,
    ))


def _unique(items: list[str]) -> list[str]:
    result = []
    for item in items:
        if item and item not in result:
            result.append(item)
    return result


def _simulation_disclaimer() -> str:
    return (
        "Operational simulation seeded from public Mysuru facility directories. "
        "Vehicle availability, staffing and hospital capacity are simulated for prototype demonstration."
    )


def _prepare_result(result: dict) -> tuple[dict, str, list[str], list[str], str]:
    result = dict(result)
    result.setdefault("agents_used", [])
    result.setdefault("tools_used", [])
    result.setdefault("status", "ok")
    result["grounded"] = result.get("grounded") is True
    disclaimer = _simulation_disclaimer()
    if re.search(r"(?i)\b(resource|ambulance|police|fire|hospital|bed|capacity|staffing|vehicle)\b", result.get("response", "")) and disclaimer not in result["response"]:
        result["response"] = result["response"].rstrip() + "\n\nData limitation: " + disclaimer
    assurance, reasons, assurance_limitations = _assurance(result)
    result_limitations = result.pop("limitations", []) or []
    limitations = _unique(assurance_limitations + result_limitations)
    action = "allowed"
    if _unsupported_operational_claim(result["response"]):
        result["response"] = (
            "CityMind withheld an AI response because it contained an unsupported operational-action claim. "
            "No dispatch, hospital acceptance, or bed reservation was executed."
        )
        result["grounded"] = False
        assurance = "Low"
        reasons = ["Response validation detected an unsupported operational-action claim."]
        limitations.append("The original generated response was withheld by deterministic response validation.")
        action = "response_withheld"
    return result, assurance, reasons, limitations, action


def _finish_response(
    db: Session,
    request: Request,
    current: AuthenticatedUser,
    payload: AIQueryRequest,
    decision_id: str,
    result: dict,
    *,
    action: str | None = None,
    model_version: str,
    source_metadata: dict,
) -> AIQueryResponse:
    source_ip, user_agent = _metadata(request)
    session_id = str(current.claims["session_id"])
    result, assurance, reasons, limitations, validation_action = _prepare_result(result)
    event_action = action or validation_action
    if validation_action == "response_withheld":
        event_action = validation_action
    event = append_security_event(
        db, event_type="ai_response_decision", action=event_action, blocked=False,
        threat_level="safe", risk_score=0, user=current.user, session_id=session_id,
        prompt=payload.message, agent_chain=result["agents_used"], tools_used=result["tools_used"],
        grounded=result["grounded"], decision_id=decision_id, assurance_level=assurance,
        limitations=limitations, model_version=model_version, source_metadata=source_metadata,
        source_ip=source_ip, user_agent=user_agent,
    )
    timestamp = event.created_at.replace(tzinfo=timezone.utc).isoformat() if event.created_at.tzinfo is None else event.created_at.isoformat()
    return AIQueryResponse(
        **result, decision_id=decision_id,
        security={"threat_level": "safe", "authorized": True, "policy_checked": True},
        audit={"integrity_hash": event.integrity_hash, "timestamp": timestamp,
               "previous_hash": event.previous_hash, "model_version": model_version},
        assurance_level=assurance, assurance_reasons=reasons, limitations=limitations,
    )


@router.get("/status")
async def ai_status():
    adk_status = "unavailable"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(2.0)) as client:
            response = await client.get(f"{adk_base_url()}/health")
            adk_status = "available" if response.status_code == 200 else "unavailable"
    except Exception:
        adk_status = "unavailable"
    label = "ADK Available" if adk_status == "available" else "AI Gateway Available"
    return {
        "status": "available",
        "label": label,
        "fast_path_status": "available",
        "adk_status": adk_status,
        "note": "Deterministic AI gateway is available; Google ADK remains available when reachable for complex multi-agent analysis.",
    }


@router.post("/query", response_model=AIQueryResponse)
async def query_ai(
    payload: AIQueryRequest,
    request: Request,
    current: AuthenticatedUser = Depends(require_permission("ai.query")),
    db: Session = Depends(get_db),
) -> AIQueryResponse:
    source_ip, user_agent = _metadata(request)
    session_id = str(current.claims["session_id"])
    try:
        gateway = evaluate_prompt(user_id=current.user.id, role=current.user.role, prompt=payload.message)
    except RateLimitExceeded as exc:
        event = append_security_event(
            db, event_type="ai_rate_limited", action="rate_limited", blocked=True,
            threat_level="warning", risk_score=70, categories=["rate_limit"],
            reason_codes=["AI_RATE_LIMIT_EXCEEDED"], user=current.user, session_id=session_id,
            prompt=payload.message, source_ip=source_ip, user_agent=user_agent,
        )
        raise HTTPException(status_code=429, detail={
            "code": "AI_RATE_LIMITED", "event_id": event.event_id,
            "safe_message": "AI request rate limit reached. Please wait and retry.",
            "threat_level": "warning", "categories": ["rate_limit"],
        }) from exc

    if not gateway.allowed:
        event = append_security_event(
            db, event_type="ai_request_blocked", action="blocked_before_adk", blocked=True,
            threat_level=gateway.threat_level, risk_score=gateway.risk_score,
            categories=gateway.categories, reason_codes=gateway.reason_codes,
            user=current.user, session_id=session_id, prompt=payload.message,
            source_ip=source_ip, user_agent=user_agent,
        )
        status_code = 403 if "role_policy" in gateway.categories else 400
        raise HTTPException(status_code=status_code, detail={
            "code": "AI_REQUEST_BLOCKED", "event_id": event.event_id,
            "threat_level": gateway.threat_level, "risk_score": gateway.risk_score,
            "categories": gateway.categories, "reason_codes": gateway.reason_codes,
            "safe_message": gateway.safe_message,
        })

    decision_id = new_decision_id()
    append_security_event(
        db, event_type="ai_request_allowed", action="authorized_before_ai_router", blocked=False,
        threat_level="safe", risk_score=0, user=current.user, session_id=session_id,
        prompt=payload.message, decision_id=decision_id, source_ip=source_ip, user_agent=user_agent,
        source_metadata={"authorization": "deterministic gateway and verified JWT role policy"},
    )

    fast_result = build_fast_path_response(db, payload.message, payload.session_id)
    if fast_result is not None:
        return _finish_response(
            db, request, current, payload, decision_id, fast_result,
            action="fast_path_allowed", model_version="deterministic-fast-path-v1",
            source_metadata={"source": FAST_PATH_SOURCE, "ai_assisted": False, "endpoint": "/api/ai/query"},
        )

    try:
        result = await asyncio.wait_for(query_citymind_agents(
            message=payload.message,
            user_id=str(current.user.id),
            session_id=payload.session_id,
            role=current.user.role,
            department=current.user.department,
            citymind_session_id=session_id,
        ), timeout=ADK_DEMO_BUDGET_SECONDS)
    except (asyncio.TimeoutError, ADKServiceError) as exc:
        logger.warning("ADK query failed or exceeded demo budget; returning deterministic fallback: %s", exc)
        fallback = build_adk_fallback_response(db, payload.message, payload.session_id, reason=str(exc))
        return _finish_response(
            db, request, current, payload, decision_id, fallback,
            action="adk_fallback", model_version="deterministic-adk-fallback-v1",
            source_metadata={"source": FALLBACK_SOURCE, "adk_error": str(exc), "endpoint": "/api/ai/query"},
        )

    if not isinstance(result.get("response"), str) or not result["response"].strip():
        fallback = build_adk_fallback_response(db, payload.message, payload.session_id, reason="ADK returned no usable response")
        return _finish_response(
            db, request, current, payload, decision_id, fallback,
            action="adk_empty_fallback", model_version="deterministic-adk-fallback-v1",
            source_metadata={"source": FALLBACK_SOURCE, "adk_error": "empty_response", "endpoint": "/api/ai/query"},
        )

    return _finish_response(
        db, request, current, payload, decision_id, result,
        model_version="gemini-2.5-flash",
        source_metadata={"agent_chain": "ADK event authors", "tools": "ADK function-call metadata", "endpoint": "/api/ai/query"},
    )