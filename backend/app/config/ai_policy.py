"""Deterministic, non-LLM AI data policy by verified CityMind role."""

AI_ROLE_POLICY = {
    "DemoAdmin": {"topics": "all prototype decision-support data", "restricted": ["patient_records", "automatic_operations"]},
    "Mayor": {"topics": "broad read-only city operations", "restricted": ["patient_records", "automatic_operations"]},
    "Commissioner": {"topics": "broad read-only operations and dispatch approval context", "restricted": ["patient_records", "automatic_operations"]},
    "Police": {"topics": "incidents, risk, traffic, resources, dispatch summaries", "restricted": ["patient_records", "confidential_healthcare"]},
    "Fire": {"topics": "fire incidents, risk, traffic, resources", "restricted": ["patient_records", "confidential_healthcare"]},
    "Healthcare": {"topics": "medical incidents, ambulances, hospitals, capacity provenance", "restricted": ["confidential_police"]},
    "DisasterManagement": {"topics": "cross-department read-only emergency operations", "restricted": ["patient_records", "automatic_operations"]},
    "Utility": {"topics": "utility incidents, risk, resources and analytics", "restricted": ["patient_records", "confidential_police", "confidential_healthcare"]},
    "Guest": {"topics": "none", "restricted": ["ai_access"]},
}


def policy_for_role(role: str) -> dict:
    return AI_ROLE_POLICY.get(role, {"topics": "none", "restricted": ["ai_access"]})