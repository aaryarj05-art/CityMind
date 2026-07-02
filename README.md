# CityMind

CityMind is a decision-intelligence platform for city control rooms. It aggregates traffic, weather, incident, complaint, hospital, and emergency-resource data into explainable operational views.

## Implemented Scope

- **Phase 1**: Dashboard foundation, Mysuru seed data, Leaflet map, and operational entity APIs.
- **Phase 2**: Deterministic, explainable area risk and incident-priority intelligence.
- **Phase 3**: Resource allocation planning, ranked candidate selection, hospital bed reservations, persisted simulated dispatch lifecycles, and demo resets.

Phase 3 remains a simulation and does not include AI/ML, Gemini, autonomous real-world dispatch, road-network route optimization, computer vision, live CCTV feeds, WebSockets, cloud deployment, or authentication.

## Setup

Prerequisites: Python 3.9+, Node.js 18+, and Git.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The SQLite database is seeded automatically on first backend startup.

## Run

Backend:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

API base path: `http://localhost:8000/api`  
OpenAPI documentation: `http://localhost:8000/docs`  

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend UI path: `http://localhost:5173` (Vite may select the next free port).

## Phase 3 Features & Workflows

### 1. Incident Response Planner
From the **Incidents** list, active incidents feature a **Generate Response Plan** action. Clicking this fetches the allocation plan, detailing:
- Required resource counts vs available candidates.
- Suitability scoring for eligible candidates (readiness, ETA, capacities).
- Ranked hospital options with bed availability (for medical emergencies).
- Unresolved shortages warning banners.

### 2. Confirmed simulated dispatches
Dispatchers can review allocations, customize candidates/hospitals, add optional notes, and execute the dispatch plan. Active dispatches:
- Progress resources to "Dispatched" status.
- Update target incidents to "Assigned" status.
- Dynamically reserve beds at target hospitals.

### 3. Management & Lifecycle
The new **Dispatches** sidebar tab provides:
- Statistics on active dispatches, assigned resources, average ETA, and shortages.
- Searchable and filterable dispatch lists.
- Full details slide-out drawer with assignments list and status progression controls (Planned -> Dispatched -> En Route -> On Scene -> Transporting -> Completed / Cancelled).
- Confirmations for terminal actions (Complete / Cancel) that correctly release resources and update final incident resolutions.

### 4. Settings & Demo Reset
A developer-only restoration control panel is exposed in settings for Vite dev mode, allowing officers to trigger a `/api/demo/reset` rollback of all simulated records.

## Tests

Run from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

All 54 tests pass covering the health endpoints, risk calculations, prioritization, Haversine ETAs, suitability weights, atomic creation rollbacks, lifecycle status progression, bed reservations, and demo reset protections.

## Environment Config

Backend `.env` example:

```text
APP_ENV=development
DATABASE_URL=sqlite:///./citymind.db
FRONTEND_ORIGIN=http://localhost:5173
```

Frontend `.env` example:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```