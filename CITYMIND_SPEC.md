# CityMind Specification

## Project Vision
CityMind is a decision-intelligence platform for city control rooms. It aggregates traffic, weather, incident, complaint, hospital, and emergency-resource data into explainable operational views.

## Architecture

- Frontend: React, Vite, Tailwind CSS, Recharts, Leaflet.
- Backend: Python, FastAPI, SQLAlchemy, Pydantic, SQLite.
- Phase 1 operational tables remain the source of seeded data.
- Phase 2 risk and priority values are computed dynamically and are not persisted over Phase 1 mock operational scores.

## Phase Status

- Phase 1: Foundation and dashboard — complete.
- Phase 2: Deterministic risk scoring and incident intelligence — complete.
- Phase 3: Resource allocation and simulated dispatch - complete.
- Phase 4: Gemini and agentic intelligence — not implemented.
- Phase 5: Simulation, deployment, and demo polish — not implemented.

## Phase 2 Area Risk Algorithm

All inputs and the final output are clamped to 0–100. The score is rounded to two decimals:

```text
risk_score =
  traffic * 0.25 +
  rainfall * 0.20 +
  active_incidents * 0.20 +
  complaints * 0.15 +
  hospital_load * 0.10 +
  resource_shortage * 0.10
```

Weights are maintained in `backend/app/config/risk_weights.py` and validated to total 100% at import time.

### Normalization

- Traffic: numeric 0–100 values pass through. Existing Phase 1 labels map to Low=20, Moderate=45, Heavy=75, Gridlock=100.
- Rainfall: 0 mm=0 and 100 mm or more=100, linear between.
- Incident severity: Low=20, Moderate/Medium=45, High=75, Critical=100. Only Reported, Assigned, and In Progress incidents are active. Multiple scores use bounded independent pressure: `100 * (1 - product(1 - score/100))`.
- Complaints: the current complaint-table count for the area scales linearly from 0=0 to 25 or more=100.
- Hospital load: aggregate occupancy of hospitals associated with or within 5 km. If none exists, the neutral fallback is 50. Invalid zero total capacity also yields 50.
- Resource shortage: resources associated with or within 5 km are grouped into Ambulance, Police Vehicle, Fire Engine, and Municipal Unit. Per type, shortage is `1 - available/total`; an absent type is 100% short. The four shortages are averaged. No resource is assigned or dispatched.

### Area Risk Classification

- 0–30: Low
- >30–60: Moderate
- >60–80: High
- >80–100: Critical

Responses include factor scores, weights, weighted contributions, deterministic top-three factors and template explanation, recommended review priority, and a timezone-aware calculation timestamp.

## Phase 2 Incident Priority Algorithm

Incident priority is computed dynamically from:

- Severity: 35%
- Recency: 20% (100 during the first hour, then linear to 0 at 24 hours)
- Current area risk: 25%
- Status: 10% (Reported=100, Assigned=70, In Progress=50, Resolved=10, Closed=0)
- Nearby resource scarcity: 10% (0 available=100, 5 or more=0, linear between)

Classification is Routine (0–30), Elevated (>30–60), Urgent (>60–80), or Immediate (>80–100). Output includes component scores, deterministic reasons, and response urgency. It never selects or dispatches a resource.

## API Contracts

Existing Phase 1 endpoints remain available under `/api`: health, dashboard, areas, incidents, resources, hospitals, and complaints.

Phase 2 adds:

- `GET /api/risk/areas` — ranked descending; optional `risk_level`, `min_score`, `search`, and `sort_order=asc|desc`.
- `GET /api/risk/areas/{area_id}` — full explainable area risk; 404 when absent.
- `GET /api/risk/incidents` — ranked descending; optional `priority_level`, `status`, and `area_id`.
- `GET /api/risk/incidents/{incident_id}` — full incident priority; 404 when absent.
- `GET /api/risk/summary` — counts, city average, highest-risk area, top city-wide factor, immediate incident count, and timestamp.

Invalid constrained query values return HTTP 422. Responses use Pydantic schemas.

## Known Limitations

- Inputs are seeded SQLite data, not live feeds.
- The 5 km nearby radius is geographic proximity, not travel time or road-network distance.
- Complaint volume counts current rows because complaints have no resolved timestamp/history model.
- Missing hospital data uses a neutral fallback; missing resource categories are treated as fully short.
- Calculations are request-time and uncached, suitable for the current small dataset.
- No authentication, WebSockets, cloud deployment, machine learning, computer vision, routing, dispatch, Gemini, or AI agents are included in Phase 2.
## Phase 3 Resource Allocation and Dispatch Intelligence

Phase 3 is a deterministic simulation and decision-support workflow. It does not control real emergency systems.

### Incident-to-resource mapping

- Medical Emergency: 1 Ambulance; Critical adds a second Ambulance.
- Road Accident: 1 Ambulance and 1 Police Vehicle; Critical adds a second Ambulance.
- Fire: 1 Fire Engine; High/Critical adds 1 Ambulance.
- Traffic Congestion: 1 Police Vehicle.
- Road Blockage: 1 Police Vehicle and 1 Municipal Unit.
- Waterlogging: 1 Municipal Unit.
- Public Disturbance: 1 Police Vehicle.

Rules live in `backend/app/config/allocation_rules.py`. Eligible resources must match the required type, be Available and unassigned, have Standard-or-better configured capacity, have valid coordinates, and have no assignment in another active dispatch.

### Distance, ETA, and suitability

Distance uses the Haversine straight-line formula and is rounded to two decimals. It is not road-network distance.

```text
base_minutes = distance_km / configured_speed_kmh * 60
delay_modifier = 1 + traffic_score*0.50 + rainfall_score*0.30 + severity_score*0.20
final_eta = max(2 minutes, base_minutes * delay_modifier)
```

The normalized scores in the modifier are divided by 100. Speeds are Ambulance 40, Police Vehicle 45, Fire Engine 35, and Municipal Unit 30 km/h.

Resource suitability is clamped to 0-100:

```text
ETA 40% + readiness 20% + type match 20% + capacity 10% + area conditions 10%
```

The planner returns ranked eligible and rejected candidates, factor scores, contributions, deterministic reasons, recommendations, explicit shortages, and partial-plan status.

### Hospital matching

Medical Emergency and Road Accident plans rank operational hospitals with sufficient beds and non-Full emergency capacity using transport ETA 35%, available beds 25%, emergency capacity 20%, operational status 10%, and load headroom 10%. Expected demand is one bed, or two for Critical incidents. Creating a dispatch reserves those beds; cancellation releases them, completion treats them as occupied, and demo reset restores the demo baseline.

### Persisted models and schema initialization

`Dispatch` stores the incident, lifecycle, timestamps, hospital, completeness, shortages, notes, ETA, and reset metadata. `DispatchAssignment` stores each selected resource, role, rank sequence, distance, ETA, suitability, and release state. Existing `Base.metadata.create_all()` safely creates only missing SQLite tables at application import/startup; it does not delete existing data. A production migration tool remains recommended before deployment.

### Lifecycle and state integration

Allowed transitions are Planned -> Dispatched or Cancelled; Dispatched -> En Route or Cancelled; En Route -> On Scene; On Scene -> Transporting or Completed; and Transporting -> Completed. Terminal states reject further transitions with HTTP 409.

Creation starts a simulated dispatch in Dispatched, marks resources Dispatched, and marks the incident Assigned. Because the existing resource enum has no En Route value, resources remain Dispatched at that stage. On Scene updates resources to On Scene. Completion releases resources and marks the incident Resolved. Cancellation releases resources, restores the previous incident state, and does not close the incident. Transactions rollback all changes when validation or persistence fails.

### Phase 3 API

- `GET /api/allocation/incidents/{incident_id}/plan` - side-effect-free allocation and hospital plan.
- `POST /api/dispatches` - create an atomic simulated dispatch using explicit or recommended resources.
- `GET /api/dispatches` - filters: status, incident_id, resource_id, active_only.
- `GET /api/dispatches/summary` - active count, assigned resources, ETA, incomplete plans, shortages, status counts.
- `GET /api/dispatches/{dispatch_id}` - dispatch and assignments.
- `PATCH /api/dispatches/{dispatch_id}/status` - validated lifecycle transition.
- `POST /api/dispatches/{dispatch_id}/cancel` - cancel and release.
- `POST /api/dispatches/{dispatch_id}/complete` - complete and release.
- `POST /api/demo/reset` - development/demo/test-only restoration of Phase 3 simulated state.

### Phase 3 limitations

ETA uses straight-line distance and fixed speeds, not roads, traffic feeds, navigation, or GPS. SQLite concurrency is suitable for the prototype, not a real dispatch centre. Capacity labels and hospital demand are simplified. Reset affects only Phase 3 dispatch-linked records. There is no frontend UI, autonomous execution, external emergency integration, notifications, authentication, WebSockets, cloud deployment, Gemini, ML, or agents.