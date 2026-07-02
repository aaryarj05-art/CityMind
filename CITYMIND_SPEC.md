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
- Phase 3: Resource allocation and dispatch — not implemented.
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