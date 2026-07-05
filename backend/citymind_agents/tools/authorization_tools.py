"""Read-only authorization-policy tools for the advisory agent."""
from typing import Any
from app.services.ai_security_gateway import explain_role_policy


def get_role_authorization_policy(role: str) -> dict[str, Any]:
    """Return CityMind's configured AI policy for a role without changing it."""
    return {"success": True, "source": "CityMind deterministic AI role policy", "role": role,
            "policy": explain_role_policy(role), "advisory_only": True}