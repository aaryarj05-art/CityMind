"""Append-only, tamper-evident prototype security event services."""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, time, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AuthenticationAudit, SecurityEvent

GENESIS_HASH = "0" * 64
PROMPT_EXCERPT_LIMIT = 180
CANONICAL_FIELDS = (
    "event_id", "event_type", "user_id", "email", "role", "department", "session_id",
    "endpoint", "prompt_excerpt", "prompt_hash", "threat_level", "risk_score",
    "categories_json", "reason_codes_json", "action", "blocked", "agent_chain_json",
    "tools_used_json", "grounded", "decision_id", "assurance_level", "model_version",
    "source_metadata_json", "limitations_json",
    "source_ip", "user_agent", "created_at",
)


def _aware_iso(value: datetime) -> str:
    value = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return value.isoformat()


def _canonical(event: SecurityEvent) -> str:
    data = {}
    for field in CANONICAL_FIELDS:
        value = getattr(event, field)
        data[field] = _aware_iso(value) if isinstance(value, datetime) else value
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _integrity(event: SecurityEvent, previous_hash: str) -> str:
    return hashlib.sha256((_canonical(event) + previous_hash).encode("utf-8")).hexdigest()


def prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def safe_prompt_excerpt(prompt: str) -> str:
    redacted = re.sub(r"(?i)bearer\s+\S+", "[REDACTED_BEARER]", prompt)
    redacted = re.sub(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?\b", "[REDACTED_TOKEN]", redacted)
    redacted = re.sub(r"(?i)(api[_ -]?key|secret|token)\s*[:=]\s*\S+", r"\1=[REDACTED]", redacted)
    return redacted[:PROMPT_EXCERPT_LIMIT]


def new_decision_id(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return f"CM-{now.year}-{uuid.uuid4().hex[:8].upper()}"


def append_security_event(
    db: Session,
    *,
    event_type: str,
    action: str,
    blocked: bool,
    threat_level: str = "safe",
    risk_score: int = 0,
    categories: list[str] | None = None,
    reason_codes: list[str] | None = None,
    user=None,
    session_id: str | None = None,
    endpoint: str = "/api/ai/query",
    prompt: str | None = None,
    agent_chain: list[str] | None = None,
    tools_used: list[str] | None = None,
    grounded: bool | None = None,
    decision_id: str | None = None,
    assurance_level: str | None = None,
    model_version: str | None = None,
    source_metadata: dict[str, Any] | None = None,
    limitations: list[str] | None = None,
    source_ip: str | None = None,
    user_agent: str | None = None,
) -> SecurityEvent:
    previous = db.query(SecurityEvent).order_by(SecurityEvent.id.desc()).first()
    previous_hash = previous.integrity_hash if previous else GENESIS_HASH
    now = datetime.now(timezone.utc)
    event = SecurityEvent(
        event_id=f"SEC-{now.year}-{uuid.uuid4().hex[:10].upper()}",
        event_type=event_type,
        user_id=getattr(user, "id", None),
        email=getattr(user, "email", None),
        role=getattr(user, "role", None),
        department=getattr(user, "department", None),
        session_id=session_id,
        endpoint=endpoint,
        prompt_excerpt=safe_prompt_excerpt(prompt) if prompt else None,
        prompt_hash=prompt_hash(prompt) if prompt else None,
        threat_level=threat_level,
        risk_score=max(0, min(int(risk_score), 100)),
        categories_json=json.dumps(categories or []),
        reason_codes_json=json.dumps(reason_codes or []),
        action=action,
        blocked=blocked,
        agent_chain_json=json.dumps(agent_chain or []),
        tools_used_json=json.dumps(tools_used or []),
        grounded=grounded,
        decision_id=decision_id,
        assurance_level=assurance_level,
        model_version=model_version,
        source_metadata_json=json.dumps(source_metadata or {}, sort_keys=True),
        limitations_json=json.dumps(limitations or []),
        source_ip=source_ip,
        user_agent=user_agent,
        created_at=now,
        previous_hash=previous_hash,
        integrity_hash="pending",
    )
    event.integrity_hash = _integrity(event, previous_hash)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def verify_audit_chain(db: Session) -> dict[str, Any]:
    previous_hash = GENESIS_HASH
    records = db.query(SecurityEvent).order_by(SecurityEvent.id.asc()).all()
    for event in records:
        expected = _integrity(event, previous_hash)
        if event.previous_hash != previous_hash or event.integrity_hash != expected:
            return {"valid": False, "records_checked": len(records), "broken_record_id": event.event_id,
                    "verified_at": datetime.now(timezone.utc).isoformat()}
        previous_hash = event.integrity_hash
    return {"valid": True, "records_checked": len(records), "broken_record_id": None,
            "verified_at": datetime.now(timezone.utc).isoformat()}


def _json(value: str) -> list:
    try:
        parsed = json.loads(value or "[]")
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def serialize_event(event: SecurityEvent, include_excerpt: bool = True) -> dict[str, Any]:
    return {
        "event_id": event.event_id, "event_type": event.event_type,
        "user_id": event.user_id, "email": event.email, "role": event.role,
        "department": event.department, "session_id": event.session_id,
        "endpoint": event.endpoint,
        "prompt_excerpt": event.prompt_excerpt if include_excerpt else None,
        "prompt_hash": event.prompt_hash, "threat_level": event.threat_level,
        "risk_score": event.risk_score, "categories": _json(event.categories_json),
        "reason_codes": _json(event.reason_codes_json), "action": event.action,
        "blocked": event.blocked, "agent_chain": _json(event.agent_chain_json),
        "tools_used": _json(event.tools_used_json), "grounded": event.grounded,
        "decision_id": event.decision_id, "assurance_level": event.assurance_level,
        "model_version": event.model_version, "source_metadata": json.loads(event.source_metadata_json or "{}"),
        "limitations": _json(event.limitations_json), "created_at": _aware_iso(event.created_at),
        "previous_hash": event.previous_hash, "integrity_hash": event.integrity_hash,
    }


def security_summary(db: Session) -> dict[str, Any]:
    start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
    events = db.query(SecurityEvent).filter(SecurityEvent.created_at >= start).all()
    auth_events = db.query(AuthenticationAudit).filter(AuthenticationAudit.timestamp >= start).all()
    ai_events = [item for item in events if item.endpoint == "/api/ai/query"]
    request_events = [item for item in ai_events if item.event_type in {
        "ai_request_allowed", "ai_request_blocked", "ai_rate_limited",
    }]
    response_events = [item for item in ai_events if item.event_type == "ai_response_decision"]
    grounded_values = [item.grounded for item in response_events if item.grounded is not None]
    threat_counts = {level: sum(item.threat_level == level for item in events) for level in ("safe", "warning", "critical")}
    return {
        "blocked_prompts_today": sum(item.event_type == "ai_request_blocked" for item in events),
        "unauthorized_requests_today": sum("role_policy" in _json(item.categories_json) for item in events),
        "failed_logins_today": sum(item.event_type == "login_failure" and not item.success for item in auth_events),
        "permission_denials_today": sum(item.event_type == "permission_denied" for item in auth_events),
        "ai_requests_today": len(request_events),
        "threat_levels": threat_counts,
        "grounding_percentage": round(sum(bool(value) for value in grounded_values) / len(grounded_values) * 100, 1) if grounded_values else None,
        "fallback_count": sum(item.assurance_level == "Low" for item in response_events),
        "audit_integrity": verify_audit_chain(db),
        "active_sessions": None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def agent_health(db: Session) -> dict[str, Any]:
    events = db.query(SecurityEvent).filter(SecurityEvent.blocked.is_(False)).order_by(SecurityEvent.id.desc()).all()
    stats: dict[str, dict] = {}
    for event in events:
        for agent in _json(event.agent_chain_json):
            item = stats.setdefault(agent, {"agent": agent, "observed_requests": 0, "last_seen": None})
            item["observed_requests"] += 1
            if item["last_seen"] is None:
                item["last_seen"] = _aware_iso(event.created_at)
    return {"agents": list(stats.values()), "source": "recorded security events"}


def grounding_metrics(db: Session) -> dict[str, Any]:
    events = db.query(SecurityEvent).filter(SecurityEvent.grounded.isnot(None), SecurityEvent.blocked.is_(False)).all()
    grounded = sum(item.grounded is True for item in events)
    return {"responses_measured": len(events), "grounded_responses": grounded,
            "grounding_percentage": round(grounded / len(events) * 100, 1) if events else None,
            "fallback_count": sum(item.assurance_level == "Low" for item in events)}