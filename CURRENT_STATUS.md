# Current Status

**Current Phase:** Phase 6A - authentication/RBAC complete; internal ADK read authentication and integration regressions fixed

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

### Phase 3 (preserved)

- Incident allocation response plan modal matching required categories.
- Ranked resource suitability cards and manual resource/hospital overrides.
- Simulated dispatches persisted to SQLite, updates resources status, and reserves hospital beds.
- Active dispatches board, timeline progress tracker, and lifecycle drawer actions.
- Confirmations for Cancelling/Completing dispatches and environmental-protected demo reset.

### Phase 4 Frontend AI Command Center

- **AI Navigation**: Added "AI Command Center" sidebar route (`/ai-command-center`) represented with the `Sparkles` icon, positioned after Overview.
- **Centralized API Integration**: Extended centralized `api.js` client with `aiAPI.query({ message, session_id, user_id })` mapped to `POST /api/ai/query`.
- **System Status Bar**: Renders Google ADK status availability ("AI Available" / "AI Offline") inside Topbar header and the AI Command Center page.
- **Chat Interface**: Fully keyboard-accessible, scroll-locked messaging list. Aligned user messages and assistant messages with UTC timestamps, grounded badges, and agent sequence traces.
- **Session Continuity**: Stores returned session ID in React state and persists in `sessionStorage` (`citymind_ai_session_id`). Retains session on tab refreshes; deletes session and history on "Clear Conversation" command.
- **Quick Prompts**: Quick prompt buttons with templates (What is the current city-wide risk situation?, Which area needs the most attention, and why?, Explain the response plan for incident {id}, etc.) that resolve incident ID dynamically.
- **Agent Trace Sequence**: Timeline visualization mapping technical ADK names (`city_operations_coordinator`, `risk_intelligence_agent`, `response_planning_agent`, `public_communication_agent`) to readable titles.
- **Grounded Badge**: Indicates factual grounding with a "Verified CityMind Data" badge showing a detailed tooltip.
- **Structured Response Renderer**: Parses headers, bullet points, numbered actions, and Kannad Unicode texts. Includes copy-to-clipboard button.
- **Safety Banner**: Notice disclaimer indicating simulated decision support.
- **Error Handling**: Formats 400/422 requests, 503 unavailable, network failures, and request timeouts. Offers retry buttons.
- **Loading Experience**: Disables submit button, prevents double submission, and cycles loading status labels.
- **Quick Operational Context Panel**: Reads metrics (average risk, highest-risk area, dispatches summary, active shortages) from existing APIs.
- **Dashboard Overview Card**: Embedded "Ask CityMind AI" overview card linking to the AI Command Center page.

### Phase 5A Google Maps Backend

- Added traffic-aware Compute Routes and Compute Route Matrix clients using `GOOGLE_MAPS_SERVER_API_KEY` exclusively via `X-Goog-Api-Key`.
- Added explicit non-live Haversine/fixed-speed fallbacks for missing keys and Routes failures; fallback data is never labeled as live traffic.
- Added 90-second in-memory coordinate-rounded caching for route, matrix, and nearby-hospital requests.
- Preserved resource availability, assignment, active-dispatch, type, and incident-capacity eligibility before route-matrix ranking.
- Added Places Nearby Search (New) for real hospital identity/location data with structured 503 failures and no invented fields.
- Added `hospital_external_mappings`; only verified place-ID mappings inherit CityMind operational capacity.
- Added deterministic live hospital scoring with exposed 40/25/20/10/5 percent ETA/capability/beds/ICU/distance components. Incompatible verified hospitals are rejected.
- Unmatched Google hospitals retain null beds/ICU data and `capacity_source: "unknown"`; CityMind seed capacity is labeled simulated.
- Google-derived congestion levels are CityMind classifications, not labels supplied by Google.
- Added 30 mocked Phase 5A integration test cases; Phase 5B adds 12 agent/tool cases. Pytest never calls Google.

### Phase 5A Endpoints

- `POST /api/maps/route`
- `POST /api/maps/route-matrix`
- `GET /api/hospitals/nearby`
- `POST /api/hospitals/rank-live`

### Phase 5B ADK Specialists

- Added `traffic_intelligence_agent` and `hospital_intelligence_agent` under `response_planning_agent`; the coordinator retains its original three top-level specialists.
- Added six read-only tools backed by existing CityMind FastAPI allocation, resource, route, Places, hospital-ranking, and provenance outputs.
- Traffic tooling preserves eligibility rejections, live/fallback source flags, timestamps, and deterministic nearest-versus-fastest/time-saved facts.
- Hospital tooling preserves Google identity, deterministic scores, CityMind verified-mapping status, simulated/unknown capacity labels, timestamps, and stale warnings.
- Mixed requests sequence both nested specialists and return control to Response Planning for synthesis.
- Real ADK event authors expose three-agent traffic/hospital traces and a four-agent mixed trace without API-side name fabrication.
- Safety instructions prohibit invented closures, historical traffic fallbacks, dispatch claims, hospital acceptance claims, and bed-reservation claims.
- Added 12 fully mocked tests for tools, agent topology, coordinator preservation, and author extraction.

### Phase 6A Integration Regression Fixes

- Added constant-time `CITYMIND_INTERNAL_SERVICE_TOKEN` validation for explicitly approved read-only endpoints.
- Updated every ADK risk, response-planning, traffic, and hospital HTTP client to send `X-CityMind-Internal-Token` and fail with a structured error when unavailable.
- Internal access is limited to risk, incident, resource, allocation, dispatch-summary, traffic, hospital discovery, and hospital-ranking reads.
- Dispatch creation/status/cancel/complete, settings, authentication, user management, and audit mutation remain user-JWT-only.
- Added eight backend regression tests covering valid/invalid/missing internal credentials, mutation denial, user/Guest behavior, ADK tool headers, structured missing-token behavior, and popup headers.
- Centralized live hospital payload construction as integer `{ incident_id, limit }`; non-medical selections no longer send rank-live requests.
- Added two Node service tests for supported payloads and validation.
- Added `same-origin-allow-popups` COOP headers to Vite dev/preview and FastAPI without weakening CORS.
- Left legacy map markers unchanged because safe Advanced Marker migration requires a configured map ID; the warning is documented as non-blocking.
### Phase 6A Authentication and RBAC

- Added official Google Identity Services browser login and backend Google ID-token verification.
- Added 15-minute CityMind HS256 JWT sessions with configured issuer/audience, stable Google subject, role, department, and unique session ID.
- Added SQLite `users` and `authentication_audits` tables without storing credentials, JWTs, passwords, refresh tokens, or Google access tokens.
- Added exact configuration-driven role mapping with safe Guest/Public defaults and no domain or first-user elevation.
- Added one centralized matrix for nine roles and fourteen prototype permissions.
- Added `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`, and `/api/auth/session-status`.
- Protected all operational APIs with reusable 401/403 dependencies while keeping health, local docs, and Google exchange public.
- Added permission-specific dispatch, hospital-capacity, traffic, AI, and settings enforcement.
- AI requests now derive CityMind user ID, role, department, and session context from the verified JWT; frontend identity fields are ignored.
- Added session-only frontend storage, refresh verification, Axios bearer/401/403 handling, route guards, permission-aware navigation, identity UI, expiry warning, and logout.
- Added 20 authentication/RBAC tests with mocked Google verification; tests never contact Google.
### Phase 5C Live Response Intelligence

- Added lazy-loaded `/live-response` navigation and a responsive Google Maps workspace.
- Added incident, eligible ambulance, and ranked hospital markers plus backend-encoded ambulance and hospital route polylines.
- Added a traffic-layer toggle, fit-to-results behavior, map legend, freshness states, and explicit key/load/fallback handling.
- Added centralized frontend methods for route, route-matrix, nearby-hospital, and live hospital-ranking backend endpoints.
- Filters ambulance candidates through the existing allocation plan before matrix routing and limits full route calls to selected results.
- Preserves hospital ranking order, all provenance fields, and unknown capacity for unmatched hospitals.
- Added nearest-versus-fastest operational impact, responsible-AI guidance, dashboard Live Response summary, and prepared-prompt handoff to AI Command Center.
- Added responsive sidebar, topbar, and content behavior verified without horizontal overflow at 390px.
### Phase 5B Manual ADK Verification

- Traffic prompt: passed; coordinator → response planning → traffic intelligence, with a deterministic route-matrix tool call.
- Hospital prompt: passed; coordinator → response planning → hospital intelligence, with Google identity and unknown capacity clearly separated.
- Mixed prompt: passed after explicit child hand-back sequencing; all four relevant authors appeared and the final answer denied confirmed actions/reservations.
- Traffic-unavailable prompt: passed; delegated to Traffic Intelligence and identified only the implemented Haversine/fixed-speed fallback.
## Phase 4 Endpoints Consumed

- `POST /api/ai/query` — routes requests to port 8001 ADK service coordinator
- `GET /api/risk/summary`, `GET /api/risk/areas`, `GET /api/risk/incidents`, `GET /api/dispatches/summary` — consumed by context panel

## Verification

### Backend Tests

Run from `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -v
```

**Result:** `124 passed, 6 warnings in 2.69s` (full Phase 1-6A regression suite).

### Frontend Build

Run from `frontend`:

```powershell
npm run build
```

**Result:** Builds successfully with no errors (2497 modules transformed, 656ms). Vite reports the existing large-chunk advisory.

### Browser/API Proxy Verification

Tested `POST http://localhost:8000/api/ai/query` with port 8001 ADK service active:
- Query succeeded with session creation: `session-6068f1d5-35a4-4188-8731-aa2a52cf4039`
- Grounded was correctly `true`
- Agents used matched: `["city_operations_coordinator", "risk_intelligence_agent"]`
- Returned Kannada characters and structured headers correctly parsed

### Phase 6A Browser Verification

- `/login` rendered at desktop width without horizontal overflow.
- The official Google-rendered Sign in with Google control loaded from Google Identity Services.
- No account sign-in, credential exchange, dashboard restoration, role switching, or logout flow is claimed: the Google account chooser requires the approved user-controlled browser session.
- Backend tests independently verify mocked successful exchange, Guest/DemoAdmin enforcement, refresh endpoints, logout audit, expiry, and credential/JWT rejection paths.
### Phase 5C Browser Verification

- Google map, live incident/ambulance/hospital markers, and both selected route polylines rendered.
- Traffic toggle, incident selection, ambulance/hospital selection, route highlighting, provenance badges, and nearest-versus-fastest impact behaved as intended.
- Dashboard Live Response summary loaded, and AI handoff prefilled the prepared prompt.
- No console errors were observed on the Live Response or dashboard pages.
- At a 390x844 viewport, document width remained within the viewport with no horizontal overflow.
## Run Commands

Backend FastAPI:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Backend ADK API:

```powershell
cd backend
.venv\Scripts\activate
adk api_server --port 8001 .
```

Frontend Dev:

```powershell
cd frontend
npm run dev
```

## Known Limitations

AI Command Center runs as a simulated controller. Session storage is active per-tab. High-latency agent requests require loading state transitions. No production Auth, BigQuery, Vertex AI, RAG, or computer vision is included.

Phase 6A limitations: JWT logout is local until expiry (no denylist), sessionStorage is an XSS-sensitive prototype choice, SQLite uses `create_all` rather than production migrations, and real sign-in browser flows require an approved user-controlled Google session. Production should use hardened HTTP-only secure cookies and token revocation/rotation.

Phase 5 limitations: the browser map needs a separately restricted Maps JavaScript key; there is no cross-process cache or automatic fuzzy mapping. Traffic/Hospital Intelligence agents are read-only explainers over deterministic backend APIs. Google Places does not provide live beds or verified ICU/admission capability; WHO and Google do not provide universal real-time hospital-bed availability. Real API-key quota, billing, API enablement, and live Mysuru responses require manual verification.