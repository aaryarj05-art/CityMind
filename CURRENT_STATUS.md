# Current Status

**Current Phase:** Phase 2 — Deterministic Risk Intelligence (backend + frontend complete, UI consistency pass applied)

## Completed

### Phase 1 (preserved)

- FastAPI + SQLite backend and automatic Mysuru seed data.
- Existing dashboard, area, incident, resource, hospital, and complaint APIs.
- React command-center with Overview dashboard, Incidents table, Risk Zones list, Analytics charts, Resources table, Settings page.
- All 11 original Phase 1 backend tests remain passing.

### Phase 2 Backend

- Central validated risk and incident-priority weights.
- Transparent normalization and 0–100 clamping.
- Dynamic area risk scoring with Low, Moderate, High, and Critical classification.
- Bounded multi-incident severity aggregation.
- Geographic 5 km hospital/resource proximity calculations.
- Structured factor scores, contributions, deterministic top factors, explanations, priorities, and UTC timestamps.
- Deterministic incident priority scoring with Routine, Elevated, Urgent, and Immediate classification.
- Pydantic response contracts and HTTP 404/422 handling.
- No persisted risk tables and no changes to Phase 1 operational scores.

### Phase 2 Frontend

- **Dashboard**: City Risk Intelligence panel with city-wide average score, risk distribution bar, and top 5 highest-risk areas. Priority Risk Zones table now driven by Phase 2 `/api/risk/areas` data (Phase 1 operational scores removed). CityMap displays dynamic Leaflet markers colored by risk level with compact color legend.
- **Risk Zones**: Full risk-scored area table with search, risk level filter, minimum score filter, and sort toggle. Details modal shows factor contribution Recharts bar chart and calculation explanation panel.
- **Incidents**: Priority-ranked incident list with priority scores and levels. Details modal shows Phase 1 core data plus Phase 2 prioritization breakdown.
- **Analytics**: Five dynamic Recharts visualizations. Hotspot Zones card replaced with explicit "Critical & High-Risk Zones" metrics.
- **Notifications**: Bell dropdown now derives alerts from Phase 2 `/api/risk/areas`, `/api/risk/incidents`, and `/api/risk/summary`. Zone alerts reference Phase 2 risk scores (consistent with Risk Zones page).
- **Settings**: Phase label reads "Development (Phase 2)" by default, configurable via `VITE_APP_PHASE` env var.
- **Select dropdowns**: All native `<select>` elements styled with dark backgrounds and readable text in Chrome on Windows.
- **Map Legend**: Compact overlay explaining Critical (red), High (orange), Moderate (yellow), Low (green), Hospital (violet), and Incident markers.
- **Reusable Components**: RiskScoreBadge, RiskLevelBadge, PriorityBadge, FactorContributionChart, RiskExplanationPanel.

## Phase 2 Endpoints

- `GET /api/risk/areas` — all areas with deterministic risk scores, filters, and sorting
- `GET /api/risk/areas/{area_id}` — single area with full factor breakdown
- `GET /api/risk/incidents` — all incidents with priority scores, filters, and sorting
- `GET /api/risk/incidents/{incident_id}` — single incident with priority breakdown
- `GET /api/risk/summary` — city-wide risk summary statistics

## Verification

### Backend Tests

Run from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

40 tests pass: 11 Phase 1 tests + 29 Phase 2 tests.

### Frontend Build

Run from `frontend`:

```powershell
npm run build
```

Builds successfully with no errors (2464 modules, 910ms).

### UI Consistency Verification

| Item | Status |
|------|--------|
| Select dropdowns (Risk Zones, Incidents, Resources) | ✅ Dark background, readable text |
| Overview Priority Risk Zones table | ✅ Phase 2 API data, no operational scores |
| Notification alerts | ✅ Phase 2 risk scores, consistent with Risk Zones |
| Settings phase label | ✅ "Development (Phase 2)" |
| Analytics hotspot label | ✅ Explicit "Critical & High-Risk Zones" |
| Map legend | ✅ Compact overlay with all marker categories |
| Cross-page score consistency | ✅ Same `/api/risk/areas` data across Overview, Risk Zones, Analytics, Notifications |

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