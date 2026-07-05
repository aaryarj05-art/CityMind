# CityMind

CityMind is a decision-intelligence platform for city control rooms. It aggregates traffic, weather, incident, complaint, hospital, and emergency-resource data into explainable operational views.

## Implemented Scope

- **Phase 1**: Dashboard foundation, Mysuru seed data, Leaflet map, and operational entity APIs.
- **Phase 2**: Deterministic, explainable area risk and incident-priority intelligence.
- **Phase 3**: Resource allocation planning, ranked candidate selection, hospital bed reservations, persisted simulated dispatch lifecycles, and demo resets.
- **Phase 4**: Google ADK multi-agent orchestration, AI Command Center page, session continuity, agent trace pipelines, and grounded response indicators.
- **Phase 5A**: Backend-only Google Routes and Places integration with deterministic fallbacks, verified hospital-capacity provenance, and mocked external-call tests.
- **Phase 5B**: Nested ADK Traffic and Hospital Intelligence specialists that explain deterministic Phase 5A tool results.
- **Phase 5C**: Live Response Intelligence UI with a Google base map, traffic overlay, backend-routed ambulance and hospital comparisons, provenance, dashboard summary, and AI handoff.
- **Phase 6A**: Google Identity Services authentication, backend-verified Google ID tokens, short-lived CityMind JWT sessions, deterministic RBAC, and authentication audit events.

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

For the Phase 5C browser map only, set `VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env`. Restrict this browser key by HTTP referrer and enable only Maps JavaScript API. Routes and Places calls continue to use the separate server key through CityMind's backend APIs.

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
## Phase 5C Live Response Intelligence

The `/live-response` workspace adds a lazy-loaded operational map and decision panels without changing the existing incident, allocation, cache, or Google-service behavior:

- Google Maps JavaScript base map with an optional traffic overlay, incident/resource/hospital markers, backend-provided encoded route polylines, viewport fitting, a legend, freshness timestamps, and explicit missing-key/load-failure states.
- Backend-only route, route-matrix, Places, and live hospital-ranking requests through the centralized API client; no browser call targets Google Routes or Places.
- Eligible ambulances are filtered from the CityMind allocation plan before route comparison. Hospital results preserve deterministic ranking, verified/simulated/unknown provenance, and unknown capacity for unmatched hospitals.
- Only the selected ambulance and hospital request full route geometry. Matrix results drive the nearest-versus-fastest impact and are not repeatedly fetched on render.
- The dashboard includes a compact Live Response summary card, and a prepared operational prompt can be handed to the AI Command Center through router state.
- Layouts adapt to narrow screens; the shared sidebar/topbar no longer force horizontal overflow at a 390px viewport.

Verification: the production frontend build completed with 2,491 modules transformed; the full backend suite passed (`96 passed, 6 warnings`); and browser checks covered map rendering, traffic toggle, live candidates, incident/ambulance/hospital selection, route highlighting, provenance, dashboard summary, AI prompt handoff, desktop console errors, and mobile overflow.

Known limitations: browser map rendering requires a separately restricted Maps JavaScript key; live Google results still depend on project billing, enabled APIs, quota, and upstream availability; Places does not expose verified live bed/ICU availability; and the current main bundle retains the existing Vite large-chunk warning.
## Phase 6A Identity and RBAC

CityMind now uses Google Identity Services for authentication only. The browser renders Google's official button and sends the one-time Google ID credential to `POST /api/auth/google`. FastAPI verifies the signature, configured audience, issuer, expiry, verified email, subject, and required claims with the official Google authentication library. The stable external identity is Google's `sub`; email is used only for explicit role configuration and display.

After verification, CityMind creates or updates the local user and issues a 15-minute HS256 JWT with CityMind user ID, Google subject, verified profile, role, department, unique session ID, issue/expiry times, issuer `citymind`, and audience `citymind-api`. `CITYMIND_SESSION_MINUTES` can adjust the duration. Authentication fails safely when `GOOGLE_OAUTH_CLIENT_ID` or `CITYMIND_JWT_SECRET` is unavailable.

Role mapping is configured through exact email entries in `CITYMIND_ROLE_MAPPINGS_JSON`. Unknown valid Google users become `Guest` in `Public`; domain membership and first-user status never grant administration. The centralized roles are `Mayor`, `Commissioner`, `Police`, `Fire`, `Healthcare`, `DisasterManagement`, `Utility`, `Guest`, and `DemoAdmin`. The centralized permission matrix covers dashboard, risk, incidents, resources, dispatch, hospitals/capacity, traffic, analytics, AI, audit, and settings permissions.

Public routes are limited to health, local API documentation, and the Google credential exchange. Operational routers enforce reusable FastAPI dependencies and return 401 for invalid/missing sessions and 403 for insufficient permissions. Dispatch mutations require `dispatch.approve`; live hospital ranking additionally requires `hospital_capacity.read`; maps require `traffic.read`; and AI requires `ai.query`. AI user ID, role, department, and CityMind session ID come from the verified JWT and are passed as approved ADK context; client-supplied identity is ignored.

The frontend stores only the CityMind JWT, minimal user profile, and expiry in `sessionStorage`. It restores tabs through `/api/auth/me` and `/api/auth/session-status`, clears invalid sessions on 401, retains valid sessions on 403, filters navigation for usability, shows verified identity/session expiry, and records logout before deleting local session state. The prototype does not implement token revocation or refresh tokens. Production should use hardened HTTP-only, Secure, SameSite cookies and a revocation/rotation design to reduce XSS and stolen-token risk.

Authentication audits record login success/failure, logout, expired/invalid sessions, and permission denials with reason codes and request metadata where available. Google credentials, CityMind JWTs, access/refresh tokens, passwords, and secrets are never persisted in the audit or user tables.

Environment variable names: `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `CITYMIND_JWT_SECRET`, `CITYMIND_SESSION_MINUTES`, `CITYMIND_ROLE_MAPPINGS_JSON`, and `CITYMIND_INTERNAL_SERVICE_TOKEN`. Do not commit environment files or real values.

Verification: the full backend suite passes with `124 passed, 6 warnings`; two frontend service tests pass; the production frontend build succeeds with 2,497 modules transformed; frontend lint exits successfully with existing warnings plus a Fast Refresh advisory for the auth context. Browser verification confirmed the responsive `/login` page and official Google-rendered button. Completing the real account chooser and sign-in-dependent browser checks requires a user-controlled approved Google session and is not claimed here.

### Phase 6A integration regression fixes

Protected operational APIs remain private. Read-only ADK tools now send `X-CityMind-Internal-Token`, sourced only from `CITYMIND_INTERNAL_SERVICE_TOKEN`. FastAPI validates it with constant-time comparison through `require_user_or_internal_service(permission)`. Internal access is placed only on risk reads, incident reads, resource reads, allocation-plan reads, dispatch summary, traffic route calculations, nearby hospital discovery, and live hospital ranking. Dispatch creation, lifecycle approval/mutation, settings, authentication, user management, and audit mutation remain user-JWT-only.

If the internal token is absent, ADK tools return a structured `internal_auth_unavailable` result and do not attempt an unauthenticated call. Browser JWTs are never passed into the tool layer; verified CityMind user ID, role, department, and session context remain separate ADK policy context.

The Live Response service now constructs the exact ranking body `{ "incident_id": <integer>, "limit": 10 }`. The page calls ranking only for Medical Emergency or Road Accident incidents; selecting another category shows a clear message without sending a request or repeatedly producing HTTP 422. Node service tests cover integer normalization, snake_case fields, defaults, and invalid values; preserved backend tests cover the supported request body and limits.

Local Vite/preview and FastAPI responses set `Cross-Origin-Opener-Policy: same-origin-allow-popups` for Google Identity Services popup compatibility without changing CORS origins or credential policy. The existing `google.maps.Marker` warning remains non-blocking: the current React map component does not safely support `AdvancedMarkerElement` without introducing a configured map ID and a larger map rewrite, so behavior is intentionally preserved.

Regression verification: `124 passed, 6 warnings` in the complete backend suite; frontend service tests `2 passed`; frontend production build succeeds with 2,497 modules; lint exits successfully with existing warnings. Header probes returned `same-origin-allow-popups` from both local frontend and backend. Real Google login, live Places ranking, and Gemini/ADK answers were not claimed in this run: the browser controller blocked localhost after a connection refusal, Places returned 503, and the local ADK `/run` endpoint returned 500.
Known limitations: session invalidation is client-side until expiry because there is no denylist; SQLite `create_all` supplies the prototype table migration rather than a production migration system; the frontend currently has only focused Node service tests rather than a component/browser unit harness; and Phase 6A intentionally excludes security/authorization agents, prompt-injection defenses, a security dashboard, custom credentials/MFA, and deployment work.
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

All 96 tests pass (`96 passed, 6 warnings in 5.83s`). Google HTTP calls are fully mocked; the suite covers routing success/fallbacks, duration and congestion calculations, route-matrix eligibility/ranking/cache behavior, Places parsing/failures, hospital mapping/provenance/ranking, stale capacity, validation, the Phase 5B tool/agent hierarchy, trace extraction, and every preserved Phase 1–4 test.