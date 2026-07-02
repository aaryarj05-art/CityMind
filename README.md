# CityMind

CityMind is a smart-city control-room dashboard with a React frontend, FastAPI backend, SQLAlchemy, Pydantic, and SQLite.

## Implemented Scope

- Phase 1: dashboard foundation, Mysuru seed data, map and operational entity APIs.
- Phase 2: deterministic, explainable area risk and incident-priority intelligence.

Phase 2 does not include AI/ML, Gemini, agents, resource dispatch, route optimization, computer vision, live CCTV, WebSockets, cloud deployment, or authentication.

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