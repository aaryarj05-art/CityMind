# Current Status

**Current Phase:** Phase 2 — Deterministic Risk Scoring and Incident Intelligence (implemented and verified)

## Completed

### Phase 1 preserved

- FastAPI + SQLite backend and automatic Mysuru seed data.
- Existing dashboard, area, incident, resource, hospital, and complaint APIs.
- Existing React command-center dashboard and pages.
- All 11 original Phase 1 backend tests remain passing.

### Phase 2 backend

- Central validated risk and incident-priority weights.
- Transparent normalization and 0–100 clamping.
- Dynamic area risk scoring with Low, Moderate, High, and Critical classification.
- Bounded multi-incident severity aggregation.
- Geographic 5 km hospital/resource proximity calculations.
- Structured factor scores, contributions, deterministic top factors, explanations, priorities, and UTC timestamps.
- Deterministic incident priority scoring with Routine, Elevated, Urgent, and Immediate classification.
- Pydantic response contracts and HTTP 404/422 handling.
- No persisted risk tables and no changes to Phase 1 operational scores.

## Phase 2 Endpoints

- `GET /api/risk/areas`
- `GET /api/risk/areas/{area_id}`
- `GET /api/risk/incidents`
- `GET /api/risk/incidents/{incident_id}`
- `GET /api/risk/summary`

## Verification

Run from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

The completed suite contains the 11 Phase 1 tests plus Phase 2 normalization, clamping, boundary, explainability, priority, filter, sorting, invalid-ID, and summary coverage.

## Run Commands

Backend:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

## Known Limitations

Phase 2 uses seeded request-time data and a straight-line 5 km proximity radius. It does not include live feeds, caching, dispatch, route optimization, authentication, WebSockets, cloud deployment, ML, computer vision, Gemini, or agents.

## Recommended Next Frontend Work for Antigravity

- Replace Risk Zones operational-score displays with `/api/risk/areas` data.
- Add factor-contribution bars, top-factor labels, explanations, and calculated timestamps to area details.
- Add a priority-ranked incident view using `/api/risk/incidents` with status/area/priority filters.
- Add city summary cards sourced from `/api/risk/summary`.
- Preserve Phase 1 views while adding loading, empty, validation, and 404 states for the new contracts.