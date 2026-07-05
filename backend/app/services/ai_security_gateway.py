"""Transparent rule-based AI prompt security and role-aware policy gateway.

Risk score formula: sum the fixed weights for each unique matched rule, capped at
100. Scores 1-69 are warning, 70-100 are critical. Any matched blocking rule is
rejected; Gemini is never used to calculate the score.
"""

from __future__ import annotations

import base64
import hashlib
import os
import re
import threading
import time
import urllib.parse
from collections import defaultdict, deque
from dataclasses import dataclass

from app.config.ai_policy import policy_for_role


@dataclass(frozen=True)
class GatewayResult:
    allowed: bool
    threat_level: str
    risk_score: int
    categories: list[str]
    reason_codes: list[str]
    safe_message: str


class RateLimitExceeded(Exception):
    pass


_RULES = [
    (r"\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b|\boverride\s+(the\s+)?instructions?\b", 85, "instruction_override", "PROMPT_INJECTION_OVERRIDE"),
    (r"\b(reveal|show|print|repeat|extract)\b.{0,35}\b(system prompt|hidden (agent )?instructions?|developer message|chain of thought)\b", 95, "system_prompt_extraction", "SYSTEM_PROMPT_EXTRACTION"),
    (r"\b(jailbreak|dan mode|developer mode|unfiltered mode|do anything now)\b", 90, "jailbreak", "JAILBREAK_LANGUAGE"),
    (r"\bpretend\s+(that\s+)?i\s+am\b|\bact as if i (am|were)\b|\bmake me (the )?(mayor|commissioner|admin)\b", 75, "role_escalation", "ROLE_ESCALATION_ATTEMPT"),
    (r"\b(call|invoke|execute|run)\s+(every|all)\s+(available\s+)?tools?\b|\bforce\s+(the\s+)?tool\b", 80, "unauthorized_tool_request", "TOOL_ABUSE_REQUEST"),
    (r"\bbypass\s+(authorization|authentication|rbac|security|approval)\b", 95, "authorization_bypass", "AUTHORIZATION_BYPASS_ATTEMPT"),
    (r"\b(create|approve|complete|cancel|mark)\b.{0,35}\b(dispatch|ambulance|resource)\b|\b(dispatch|reserve)\b.{0,20}\b(without approval|automatically|now)\b", 90, "operational_action_request", "HUMAN_APPROVAL_BYPASS"),
    (r"\b(claim|say|report)\b.{0,30}\b(dispatch|ambulance).{0,20}(occurred|dispatched|en route)\b", 80, "fake_operational_claim", "FAKE_DISPATCH_CLAIM"),
    (r"\b(drop|truncate|alter|delete)\s+(table|from)\b|\bunion\s+select\b|;\s*--|\bor\s+1\s*=\s*1\b", 95, "sql_injection", "SQL_INJECTION_PATTERN"),
    (r"(?:\.\.[/\\]){1,}|/etc/passwd|windows[/\\]system32", 95, "path_traversal", "PATH_TRAVERSAL_PATTERN"),
    (r"\bcurl\b.{0,80}\b(authorization|x-citymind|/api/)\b|\b(delete|reset)\s+/api/|\bpost\s+/api/dispatch", 80, "api_abuse", "API_ABUSE_PATTERN"),
    (r"\b(patient records?|patient files?|medical records?|personally identifiable patient|confidential hospital)\b", 85, "restricted_data", "PATIENT_DATA_REQUEST"),
    (r"\bconfidential police (intelligence|records?|operations?)\b|\bundercover officer|informant identities\b", 85, "restricted_data", "POLICE_INTELLIGENCE_REQUEST"),
]

_request_times: dict[int, deque[float]] = defaultdict(deque)
_blocked_times: dict[int, deque[float]] = defaultdict(deque)
_suspicious_hashes: dict[tuple[int, str], deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(value, maximum))


def _variants(prompt: str) -> tuple[list[str], bool]:
    variants = [prompt.lower(), urllib.parse.unquote(prompt).lower()]
    encoded_suspicious = variants[0] != variants[1]
    for candidate in re.findall(r"[A-Za-z0-9+/]{24,}={0,2}", prompt):
        try:
            decoded = base64.b64decode(candidate, validate=True).decode("utf-8")
            if decoded and any(char.isalpha() for char in decoded):
                variants.append(decoded.lower())
                encoded_suspicious = True
        except (ValueError, UnicodeDecodeError):
            continue
    return list(dict.fromkeys(variants)), encoded_suspicious


def _role_violations(role: str, text: str) -> list[tuple[int, str, str]]:
    violations = []
    patient = bool(re.search(r"\b(patient records?|patient files?|medical records?|confidential hospital)\b", text))
    police = bool(re.search(r"\bconfidential police (intelligence|records?|operations?)\b|\bundercover officer|informant identities\b", text))
    if patient and role in {"Police", "Fire", "Utility"}:
        violations.append((90, "role_policy", "ROLE_DENIED_HEALTHCARE_DATA"))
    if police and role in {"Healthcare", "Utility"}:
        violations.append((90, "role_policy", "ROLE_DENIED_POLICE_DATA"))
    if patient and role in {"DemoAdmin", "Mayor", "Commissioner", "DisasterManagement"}:
        violations.append((90, "role_policy", "NONEXISTENT_PATIENT_DATA"))
    if role == "Guest":
        violations.append((100, "role_policy", "ROLE_AI_ACCESS_DENIED"))
    return violations


def reset_security_state() -> None:
    with _lock:
        _request_times.clear(); _blocked_times.clear(); _suspicious_hashes.clear()


def evaluate_prompt(*, user_id: int, role: str, prompt: str) -> GatewayResult:
    now = time.monotonic()
    per_minute = _int_env("CITYMIND_AI_REQUESTS_PER_MINUTE", 20, 1, 300)
    block_threshold = _int_env("CITYMIND_SECURITY_BLOCK_THRESHOLD", 5, 2, 50)
    max_length = _int_env("CITYMIND_AI_MAX_PROMPT_LENGTH", 4000, 100, 20000)
    with _lock:
        requests = _request_times[user_id]
        while requests and now - requests[0] >= 60:
            requests.popleft()
        if len(requests) >= per_minute:
            raise RateLimitExceeded("AI request rate exceeded")
        requests.append(now)

    matches: list[tuple[int, str, str]] = []
    if len(prompt) > max_length:
        matches.append((100, "excessive_length", "PROMPT_LENGTH_EXCEEDED"))
    variants, encoded = _variants(prompt)
    for pattern, weight, category, code in _RULES:
        if any(re.search(pattern, variant, re.IGNORECASE | re.DOTALL) for variant in variants):
            matches.append((weight, category, code))
    if encoded and len(variants) > 1 and any(matches):
        matches.append((70, "obfuscated_instruction", "ENCODED_SUSPICIOUS_INSTRUCTION"))
    matches.extend(_role_violations(role, variants[0]))

    unique: dict[str, tuple[int, str]] = {}
    for weight, category, code in matches:
        current = unique.get(code)
        if current is None or weight > current[0]:
            unique[code] = (weight, category)

    if unique:
        digest = hashlib.sha256(prompt.strip().lower().encode("utf-8")).hexdigest()
        with _lock:
            blocked = _blocked_times[user_id]
            while blocked and now - blocked[0] >= 300:
                blocked.popleft()
            blocked.append(now)
            repeated = _suspicious_hashes[(user_id, digest)]
            while repeated and now - repeated[0] >= 300:
                repeated.popleft()
            repeated.append(now)
            if len(blocked) >= block_threshold:
                unique["REPEATED_BLOCKED_ATTEMPTS"] = (70, "repeated_suspicious_activity")
            if len(repeated) >= 2:
                unique["REPEATED_IDENTICAL_SUSPICIOUS_PROMPT"] = (70, "repeated_suspicious_activity")

    score = min(100, sum(weight for weight, _ in unique.values()))
    categories = list(dict.fromkeys(category for _, category in unique.values()))
    codes = list(unique.keys())
    threat = "critical" if score >= 70 else "warning" if score else "safe"
    return GatewayResult(
        allowed=not bool(unique), threat_level=threat, risk_score=score,
        categories=categories, reason_codes=codes,
        safe_message=("This request was blocked by CityMind security policy." if unique else "Request passed deterministic CityMind security policy."),
    )


def explain_role_policy(role: str) -> dict:
    policy = policy_for_role(role)
    return {"role": role, "approved_scope": policy["topics"], "restrictions": policy["restricted"],
            "enforcement": "FastAPI RBAC and deterministic gateway; advisory agents cannot override policy."}