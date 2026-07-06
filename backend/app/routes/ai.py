import re
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_permission
from app.schemas.ai import AIQueryRequest, AIQueryResponse
from app.services.adk_service import ADKServiceError, query_citymind_agents
from app.services.ai_security_gateway import RateLimitExceeded, evaluate_prompt
from app.services.auth_service import AuthenticatedUser
from app.services.security_audit import append_security_event, new_decision_id

router = APIRouter(prefix="/api/ai", tags=["AI"])


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
        limitations.append("The response was not confirmed as grounded by the ADK result.")
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
        db, event_type="ai_request_allowed", action="authorized_before_adk", blocked=False,
        threat_level="safe", risk_score=0, user=current.user, session_id=session_id,
        prompt=payload.message, decision_id=decision_id, source_ip=source_ip, user_agent=user_agent,
        source_metadata={"authorization": "deterministic gateway and verified JWT role policy"},
    )
    try:
        result = await query_citymind_agents(
            message=payload.message,
            user_id=str(current.user.id),
            session_id=payload.session_id,
            role=current.user.role,
            department=current.user.department,
            citymind_session_id=session_id,
        )
    except ADKServiceError as exc:
        append_security_event(
            db, event_type="ai_request_failed", action="adk_unavailable", blocked=False,
            threat_level="safe", risk_score=0, user=current.user, session_id=session_id,
            prompt=payload.message, decision_id=decision_id, assurance_level="Low",
            limitations=["The ADK coordinator was unavailable."], source_ip=source_ip, user_agent=user_agent,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not isinstance(result.get("response"), str) or not result["response"].strip():
        raise HTTPException(status_code=503, detail="ADK returned no usable response")
    simulation_disclaimer = (
        "Operational simulation seeded from public Mysuru facility directories. "
        "Vehicle availability, staffing and hospital capacity are simulated for prototype demonstration."
    )
    if re.search(r"(?i)\b(resource|ambulance|police|fire|hospital|bed|capacity|staffing|vehicle)\b", result["response"]) and simulation_disclaimer not in result["response"]:
        result["response"] = result["response"].rstrip() + "\n\nData limitation: " + simulation_disclaimer
    result.setdefault("agents_used", [])
    result.setdefault("tools_used", [])
    result["grounded"] = result.get("grounded") is True
    assurance, reasons, limitations = _assurance(result)
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

    event = append_security_event(
        db, event_type="ai_response_decision", action=action, blocked=False,
        threat_level="safe", risk_score=0, user=current.user, session_id=session_id,
        prompt=payload.message, agent_chain=result["agents_used"], tools_used=result["tools_used"],
        grounded=result["grounded"], decision_id=decision_id, assurance_level=assurance,
        limitations=limitations, model_version="gemini-2.5-flash",
        source_metadata={"agent_chain": "ADK event authors", "tools": "ADK function-call metadata", "endpoint": "/api/ai/query"},
        source_ip=source_ip, user_agent=user_agent,
    )
    timestamp = event.created_at.replace(tzinfo=timezone.utc).isoformat() if event.created_at.tzinfo is None else event.created_at.isoformat()
    return AIQueryResponse(
        **result, decision_id=decision_id,
        security={"threat_level": "safe", "authorized": True, "policy_checked": True},
        audit={"integrity_hash": event.integrity_hash, "timestamp": timestamp,
               "previous_hash": event.previous_hash, "model_version": "gemini-2.5-flash"},
        assurance_level=assurance, assurance_reasons=reasons, limitations=limitations,
    )