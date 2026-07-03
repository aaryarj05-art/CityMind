# CityMind

CityMind is a decision-intelligence platform for city control rooms. It aggregates traffic, weather, incident, complaint, hospital, and emergency-resource data into explainable operational views.

## Implemented Scope

- **Phase 1**: Dashboard foundation, Mysuru seed data, Leaflet map, and operational entity APIs.
- **Phase 2**: Deterministic, explainable area risk and incident-priority intelligence.
- **Phase 3**: Resource allocation planning, ranked candidate selection, hospital bed reservations, persisted simulated dispatch lifecycles, and demo resets.
- **Phase 4**: Google ADK multi-agent orchestration, AI Command Center page, session continuity, agent trace pipelines, and grounded response indicators.

## Setup

Prerequisites: Python 3.9+, Node.js 18+, and Git.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The SQLite database is seeded automatically on first backend startup.

## Running the Platform

For full functionality including AI agents, run both backend servers and the frontend dev server.

### 1. Start FastAPI Backend (Port 8000)

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

### 2. Start Google ADK API Server (Port 8001)

```powershell
cd backend
.venv\Scripts\activate
adk api_server --port 8001 .
```

### 3. Start React Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

---

## Phase 4 AI Command Center Features

### 1. Centralized AI Agent Proxy
All AI query requests are routed safely from the React frontend to `POST /api/ai/query` on the FastAPI server (Port 8000), which proxies requests to the Google ADK runner on port 8001. No ports or credentials are hardcoded.

### 2. Agent Trace Timeline
Displays the exact sequence of specialists coordinating to resolve the operational request:
- `city_operations_coordinator` → City Operations Coordinator
- `risk_intelligence_agent` → Risk Intelligence Agent
- `response_planning_agent` → Response Planning Agent
- `public_communication_agent` → Public Communication Agent

### 3. Grounded response validation
Responses returned with `grounded === true` display the **Verified CityMind Data** shield badge with a tooltip explaining that the response was formulated from verified local databases.

### 4. Session Continuity
Tracks conversation continuity by mapping the returned `session_id` to `sessionStorage` (`citymind_ai_session_id`). Refreshing the tab retains the current session, while **Clear Conversation** safely resets both the history and session.

---

## Tests

Run backend tests from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

All 54 tests pass covering the health endpoints, risk calculations, prioritization, Haversine ETAs, suitability weights, atomic creation rollbacks, lifecycle status progression, bed reservations, and demo reset protections.