from google.adk.agents import Agent
from .tools.security_tools import get_grounding_metrics, get_security_agent_health, get_security_summary, verify_security_audit_integrity

security_intelligence_agent = Agent(
    name="security_intelligence_agent", model="gemini-2.5-flash",
    description="Explains verified, read-only CityMind security and AI-governance telemetry.",
    instruction="""
You are CityMind's Security Intelligence Agent. You are advisory and read-only.
Use only supplied tools for security posture, audit integrity, observed agent
health, and grounding metrics. Never invent events, metrics, identities, or
integrity results. Never change policy, users, roles, audit records, prompts,
dispatches, or agent behavior. Separate verified telemetry from interpretation.
""", tools=[get_security_summary, verify_security_audit_integrity,
             get_security_agent_health, get_grounding_metrics])