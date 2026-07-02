from google.adk.agents import Agent

root_agent = Agent(
    name="citymind_test_agent",
    model="gemini-2.5-flash",
    description="A minimal test agent for CityMind.",
    instruction=(
        "You are a CityMind test agent. "
        "Reply briefly and clearly. "
        "When asked whether the connection works, say: "
        "'CityMind ADK connection successful.'"
    ),
)