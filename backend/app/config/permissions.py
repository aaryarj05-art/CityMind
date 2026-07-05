"""Central deterministic CityMind role and permission configuration."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

ROLES = (
    "Mayor", "Commissioner", "Police", "Fire", "Healthcare",
    "DisasterManagement", "Utility", "Guest", "DemoAdmin",
)

ALL_PERMISSIONS = frozenset({
    "dashboard.read", "risk.read", "incidents.read", "incidents.write",
    "resources.read", "dispatch.read", "dispatch.approve", "hospitals.read",
    "hospital_capacity.read", "traffic.read", "analytics.read", "ai.query",
    "audit.read", "settings.manage",
})

READ_PERMISSIONS = frozenset(permission for permission in ALL_PERMISSIONS if permission.endswith(".read"))

PERMISSION_MATRIX: dict[str, frozenset[str]] = {
    "DemoAdmin": ALL_PERMISSIONS,
    "Mayor": READ_PERMISSIONS | {"ai.query", "audit.read"},
    "Commissioner": (READ_PERMISSIONS - {"audit.read"}) | {"ai.query", "dispatch.approve"},
    "Police": frozenset({
        "dashboard.read", "risk.read", "incidents.read", "incidents.write",
        "resources.read", "dispatch.read", "traffic.read", "ai.query",
    }),
    "Fire": frozenset({
        "dashboard.read", "risk.read", "incidents.read", "incidents.write",
        "resources.read", "dispatch.read", "traffic.read", "ai.query",
    }),
    "Healthcare": frozenset({
        "dashboard.read", "incidents.read", "resources.read", "hospitals.read",
        "hospital_capacity.read", "traffic.read", "ai.query",
    }),
    "DisasterManagement": frozenset({
        "dashboard.read", "risk.read", "incidents.read", "resources.read",
        "dispatch.read", "hospitals.read", "traffic.read", "analytics.read", "ai.query",
    }),
    "Utility": frozenset({
        "dashboard.read", "risk.read", "incidents.read", "resources.read",
        "analytics.read", "ai.query",
    }),
    "Guest": frozenset({"dashboard.read"}),
}


@dataclass(frozen=True)
class RoleAssignment:
    role: str
    department: str


def permissions_for_role(role: str) -> list[str]:
    return sorted(PERMISSION_MATRIX.get(role, frozenset()))


def role_for_email(email: str) -> RoleAssignment:
    """Resolve an explicit, exact email mapping; unknown accounts are Guests."""
    raw = os.getenv("CITYMIND_ROLE_MAPPINGS_JSON", "{}")
    try:
        mappings = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        mappings = {}
    if not isinstance(mappings, dict):
        mappings = {}
    entry = mappings.get(email.strip().lower())
    if isinstance(entry, dict):
        role = entry.get("role")
        department = entry.get("department")
        if role in PERMISSION_MATRIX and isinstance(department, str) and department.strip():
            return RoleAssignment(role=role, department=department.strip())
    return RoleAssignment(role="Guest", department="Public")