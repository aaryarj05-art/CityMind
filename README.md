# CityMind

CityMind is a decision-intelligence platform for city control rooms. It aggregates traffic, weather, incident, complaint, hospital, and emergency-resource data into explainable operational views.

## Implemented Scope

- **Phase 1**: Dashboard foundation, Mysuru seed data, Leaflet map, and operational entity APIs.
- **Phase 2**: Deterministic, explainable area risk and incident-priority intelligence.
- **Phase 3**: Resource allocation planning, ranked candidate selection, hospital bed reservations, persisted simulated dispatch lifecycles, and demo resets.
- **Phase 4**: Google ADK multi-agent orchestration, AI Command Center page, session continuity, agent trace pipelines, and grounded response indicators.
- **Phase 5A**: Backend-only Google Routes and Places integration with deterministic fallbacks, verified hospital-capacity provenance, and mocked external-call tests.
- **Phase 5B**: Nested ADK Traffic and Hospital Intelligence specialists that explain deterministic Phase 5A tool results.

## Setup

Prerequisites: Python 3.9+, Node.js 18+, and Git.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The SQLite database is seeded automatically on first backend startup.

For Phase 5A, set `GOOGLE_MAPS_SERVER_API_KEY` in `backend/.env`. The server sends it only in the `X-Goog-Api-Key` header; it is never returned to clients or placed in request URLs.

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

## Phase 5A Google Maps Backend

The backend adds these endpoints without replacing the existing CityMind hospital or allocation APIs:

- `POST /api/maps/route` — traffic-aware route, distance, encoded polyline, and CityMind-derived congestion classification.
- `POST /api/maps/route-matrix` — traffic-duration ranking after existing availability, assignment, active-dispatch, type, and (when `incident_id` is supplied) capacity eligibility checks.
- `GET /api/hospitals/nearby` — Google hospital identity and location discovery.
- `POST /api/hospitals/rank-live` — deterministic ranking for medical incidents using routing plus verified CityMind capacity mappings.

Google calls are server-side POST requests:

- Routes Compute Routes: `https://routes.googleapis.com/directions/v2:computeRoutes`, field mask `routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline`.
- Routes Compute Route Matrix: `https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, field mask `originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration`.
- Places Nearby Search (New): `https://places.googleapis.com/v1/places:searchNearby`, field mask `places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri`.

Route and matrix results use a process-local, coordinate-rounded 90-second TTL cache. Missing credentials, timeouts, network failures, authorization/rate-limit/server errors, empty results, and malformed route data fall back to the existing Haversine/fixed-speed estimate and are explicitly marked `live_data: false`, `fallback_used: true`. Places failures return a structured HTTP 503 because hospital identities are not fabricated.

Google Places supplies identity, location, and business metadata—not bed availability, ICU verification, or guaranteed emergency admission. Only a verified `hospital_external_mappings` row may attach existing CityMind operational capacity to a Google place. Unmatched places retain null capacity and `capacity_source: "unknown"`. Current CityMind seed capacity is explicitly identified as simulated. Neither Google nor WHO provides universal real-time hospital-bed availability.

Known limitations: the TTL cache is per process; the current CityMind hospital model has no verified ICU field; verified mappings require administrative curation; route-matrix compatibility is strongest when `incident_id` or `required_resource_type` is supplied; and real-key quota, billing, API enablement, and Mysuru production results still require manual verification.

## Phase 5B ADK Intelligence Specialists

The Response Planning Agent now owns two nested Gemini 2.5 Flash specialists:

- `traffic_intelligence_agent` calls read-only CityMind tools for eligible-resource route comparison, a verified route for one resource, and nearest-versus-fastest decision summaries.
- `hospital_intelligence_agent` calls read-only CityMind tools for Google hospital identity discovery, deterministic live ranking, and mapping/capacity provenance.

The hierarchy is `city_operations_coordinator → response_planning_agent → traffic_intelligence_agent / hospital_intelligence_agent`. ADK event authors are passed through unchanged for the existing frontend trace. The specialists never calculate distances, ETAs, rankings, suitability, beds, or capacity; all operational values come from existing FastAPI endpoints.

Traffic responses label Google Routes data as live or CityMind Haversine/fixed-speed data as fallback. Hospital responses keep Google identity separate from CityMind capacity, retain unknown values for unmatched places, and label simulated capacity. Recommendations never imply dispatch, hospital acceptance, or bed reservation.

Manual `adk run citymind_agents` verification succeeded for traffic-only, hospital-only, mixed traffic/hospital planning, and Google-traffic-unavailable prompts. Verified traces included both three-agent specialist paths and the four-agent mixed path. The fallback answer explicitly rejected cached, last-known, and historical traffic claims.

Known limitations: ADK delegation and wording remain model-driven; FastAPI must be running on port 8000; Gemini access is required for manual runs; and hospital mappings/capacity remain limited to the deterministic Phase 5A data available at query time.
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

All 96 tests pass (`96 passed, 6 warnings in 4.53s`). Google HTTP calls are fully mocked; the suite covers routing success/fallbacks, duration and congestion calculations, route-matrix eligibility/ranking/cache behavior, Places parsing/failures, hospital mapping/provenance/ranking, stale capacity, validation, the Phase 5B tool/agent hierarchy, trace extraction, and every preserved Phase 1–4 test.