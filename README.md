# CityMind

CityMind is a smart-city control-room dashboard with a React frontend, FastAPI backend, SQLAlchemy, Pydantic, and SQLite.

## Implemented Scope

- Phase 1: dashboard foundation, Mysuru seed data, map and operational entity APIs.
- Phase 2: deterministic, explainable area risk and incident-priority intelligence.
- Phase 3: deterministic resource planning and persisted simulated dispatch lifecycle.

Phase 3 remains a simulation and does not include AI/ML, Gemini, agents, autonomous real-world dispatch, route optimization, computer vision, live CCTV, WebSockets, cloud deployment, or authentication.

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

API: `http://localhost:8000/api`
OpenAPI docs: `http://localhost:8000/docs`

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173` (Vite may select the next free port).

## Deterministic Risk Formula

```text
traffic 25% + rainfall 20% + active incidents 20% + complaints 15%
+ hospital load 10% + emergency resource shortage 10%
```

Inputs and output are clamped to 0–100 and the result is rounded to two decimals. Risk levels are Low (0–30), Moderate (>30–60), High (>60–80), and Critical (>80–100). Full normalization and incident-priority rules are documented in `CITYMIND_SPEC.md`.

## Phase 2 API

- `GET /api/risk/areas?risk_level=&min_score=&search=&sort_order=`
- `GET /api/risk/areas/{area_id}`
- `GET /api/risk/incidents?priority_level=&status=&area_id=`
- `GET /api/risk/incidents/{incident_id}`
- `GET /api/risk/summary`

Scores are computed dynamically from existing rows; Phase 1 `operational_score` and `status` values are not overwritten.

## Tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -v
```

The suite covers both the original Phase 1 APIs and Phase 2 algorithms/endpoints.

## Environment

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

## Known Limitations

Data is seeded rather than live; proximity uses a 5 km straight-line radius; calculations are uncached at request time; hospital absence falls back to neutral load; and missing local resource types count as fully short.
## Phase 3 Allocation and Simulated Dispatch

Central rules map incident categories to Ambulance, Police Vehicle, Fire Engine, and Municipal Unit requirements. The planner filters unavailable, assigned, maintenance/offline, capacity-incompatible, and invalid-coordinate resources. Eligible units are ranked with ETA 40%, readiness 20%, type match 20%, capacity 10%, and area conditions 10%.

ETA uses Haversine straight-line distance, fixed resource speeds, and deterministic traffic/rainfall/severity delays with a two-minute minimum. Medical emergencies and road accidents also receive ranked hospital options based on ETA, beds, emergency capacity, status, and load.

Dispatches are SQLite-persisted simulations. Creation atomically assigns resources and optionally reserves hospital beds. Valid lifecycle transitions prevent double assignment and unsafe completion/cancellation. `Base.metadata.create_all()` creates the two new tables without deleting existing data.

### Phase 3 API

- `GET /api/allocation/incidents/{incident_id}/plan`
- `POST /api/dispatches`
- `GET /api/dispatches?status=&incident_id=&resource_id=&active_only=`
- `GET /api/dispatches/summary`
- `GET /api/dispatches/{dispatch_id}`
- `PATCH /api/dispatches/{dispatch_id}/status`
- `POST /api/dispatches/{dispatch_id}/cancel`
- `POST /api/dispatches/{dispatch_id}/complete`
- `POST /api/demo/reset` (development/demo/test only)

The reset endpoint removes Phase 3 dispatch records and restores dispatch-linked resources, incidents, and reserved hospital beds to their pre-dispatch demo values.