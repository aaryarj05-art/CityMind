# Current Status

**Current Phase:** Phase 3 — Resource Allocation and Simulated Dispatch (backend + frontend integration complete, build verified, all tests passing)

## Completed

### Phase 1 (preserved)

- FastAPI + SQLite backend and automatic Mysuru seed data.
- Existing dashboard, area, incident, resource, hospital, and complaint APIs.
- React command-center with Overview dashboard, Incidents table, Risk Zones list, Analytics charts, Resources table, Settings page.
- All 11 original Phase 1 backend tests remain passing.

### Phase 2 (preserved)

- Dynamic area risk scoring and incident priority calculations.
- Recharts visualizations and explainable breakdown charts.
- Dark native select dropdown menus Legibility fixes in Chrome/Windows.
- Compact map legend color category overlay.

### Phase 3 Frontend Integration

- **Incident Allocation Planner**: "Generate Response Plan" button next to all active incidents. Large modal displaying severity, required resources, shortages warning, plan completeness, and deterministic rationale.
- **Ranked Resource Recommendations**: Interactive cards rendering resource code, type, suitability score, distance, base travel time, final ETA, and deterministic selection reasons. Selectable custom resource overrides.
- **Plan Completeness & Shortages**: PlanCompletenessBadge and ShortageWarning cards indicating Complete/Partial/Incomplete status. Explicit warning banners for active shortages.
- **Hospital Recommendations**: Matches medical emergencies and road accidents to ranked hospitals with suitability score, transport ETA, available beds, capacity, load, and reservation selection.
- **Simulated Dispatch Workflow**: Double-assignment validation, optional notes, explicit confirmation for partial plans, and creation response display. Disable submit while dispatching.
- **Dispatch Management Page**: Added "Dispatches" sidebar route next to Incidents/Resources. Summarizes dispatches (active dispatches, assigned resources, average ETA, incomplete plans, shortages). Searchable and filterable dispatch list (lifecycle status, target incident, resource ID, active only).
- **Dispatch Details Drawer**: Slide-out panel displaying dispatch code, status timeline, incident summary, assignments list, selected hospital, officer notes, and timestamps.
- **Lifecycle Controls**: Action bar with valid transition buttons (Planned, Dispatched, En Route, On Scene, Transporting, Completed, Cancelled). Require explicit confirmation modals for Cancel and Complete.
- **Resources Page Integration**: Active dispatch code, assigned role, and last status change merged directly into list rows and details modals. Link to open dispatch drawer.
- **Incident Page Integration**: Displays active dispatch banner, dispatch status, assigned resources, hospital, and open drawer button inside Incident Prioritization Details modal.
- **Dashboard Overview Integration**: Added "Dispatch & Resource Allocation (Phase 3)" panel displaying active dispatches, assigned resources, average ETA, incomplete plans, latest dispatches table, and active shortages column.
- **Notifications Integration**: Populates notification dropdown with Phase 3 dispatch events (new dispatches, completions, cancellations, shortages, incomplete plans) dynamically calculated from API.
- **Demo Reset Control**: Development-only panel in Settings to trigger `/api/demo/reset`. Confirms destructive reset of dispatches, hospital beds, and resource statuses to baseline.

## Phase 3 Endpoints Consumed

- `GET /api/allocation/incidents/{incident_id}/plan` — returns eligibility and suitability recommendations
- `POST /api/dispatches` — creates a new atomic dispatch configuration
- `GET /api/dispatches` — returns list of dispatches with filters
- `GET /api/dispatches/summary` — returns aggregated dispatch counters
- `GET /api/dispatches/{dispatch_id}` — returns dispatch details and assignments
- `PATCH /api/dispatches/{dispatch_id}/status` — changes dispatch status
- `POST /api/dispatches/{dispatch_id}/cancel` — cancels dispatch and releases resources/beds
- `POST /api/dispatches/{dispatch_id}/complete` — completes dispatch and releases resources/resolves incident
- `POST /api/demo/reset` — restores backend initial simulated baseline

## Verification

### Backend Tests

Run from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

**Result:** 54 passed (11 Phase 1, 29 Phase 2, 14 Phase 3 tests).

### Frontend Build

Run from `frontend`:

```powershell
npm run build
```

**Result:** Builds successfully with no errors (2476 modules transformed, 785ms).

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

Phase 3 is a simulated workflow. ETA uses straight-line distance and fixed speeds, not road networks. SQLite is used for prototype concurrency. Bed capacity and resource shortages are request-time estimates. No actual emergency alerts or autonomous agents are implemented.