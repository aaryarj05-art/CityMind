from __future__ import annotations

import uuid
from typing import Any

import httpx


ADK_BASE_URL = "http://127.0.0.1:8001"
ADK_APP_NAME = "citymind_agents"


class ADKServiceError(Exception):
    pass


async def ensure_session(
    client: httpx.AsyncClient,
    user_id: str,
    session_id: str,
) -> None:
    session_url = (
        f"{ADK_BASE_URL}/apps/{ADK_APP_NAME}/users/"
        f"{user_id}/sessions/{session_id}"
    )

    response = await client.get(session_url)

    if response.status_code == 200:
        return

    if response.status_code != 404:
        raise ADKServiceError(
            f"Could not check ADK session: HTTP {response.status_code}"
        )

    create_response = await client.post(session_url, json={})

    if create_response.status_code not in (200, 201):
        raise ADKServiceError(
            f"Could not create ADK session: HTTP "
            f"{create_response.status_code}"
        )


def extract_final_text(events: list[dict[str, Any]]) -> str:
    for event in reversed(events):
        content = event.get("content") or {}
        parts = content.get("parts") or []

        for part in reversed(parts):
            text = part.get("text")
            if text:
                return text

    raise ADKServiceError("ADK returned no final text response.")


def extract_agents(events: list[dict[str, Any]]) -> list[str]:
    agents: list[str] = []

    for event in events:
        author = event.get("author")

        if author and author not in agents:
            agents.append(author)

    return agents


async def query_citymind_agents(
    message: str,
    user_id: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    resolved_session_id = session_id or f"session-{uuid.uuid4()}"

    timeout = httpx.Timeout(60.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            await ensure_session(
                client=client,
                user_id=user_id,
                session_id=resolved_session_id,
            )

            payload = {
                "appName": ADK_APP_NAME,
                "userId": user_id,
                "sessionId": resolved_session_id,
                "newMessage": {
                    "role": "user",
                    "parts": [{"text": message}],
                },
            }

            response = await client.post(
                f"{ADK_BASE_URL}/run",
                json=payload,
            )

        except httpx.ConnectError as exc:
            raise ADKServiceError(
                "Could not connect to the ADK server on port 8001."
            ) from exc

        except httpx.TimeoutException as exc:
            raise ADKServiceError(
                "The ADK request timed out."
            ) from exc

    if response.status_code != 200:
        raise ADKServiceError(
            f"ADK returned HTTP {response.status_code}: "
            f"{response.text}"
        )

    events = response.json()

    if not isinstance(events, list):
        raise ADKServiceError("ADK returned an unexpected response format.")

    return {
        "session_id": resolved_session_id,
        "response": extract_final_text(events),
        "agents_used": extract_agents(events),
        "grounded": True,
    }