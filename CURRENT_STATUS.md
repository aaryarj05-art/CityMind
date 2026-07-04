# Current Status

**Current Phase:** Phase 5B — nested Traffic and Hospital Intelligence ADK specialists complete; frontend Maps integration remains out of scope

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

**Result:** `96 passed, 6 warnings in 4.53s` (full Phase 1–5B backend suite).

### Frontend Build

Run from `frontend`:

```powershell
npm run build
```

**Result:** Builds successfully with no errors (2484 modules transformed, 1.31s).

### Browser/API Proxy Verification

Tested `POST http://localhost:8000/api/ai/query` with port 8001 ADK service active:
- Query succeeded with session creation: `session-6068f1d5-35a4-4188-8731-aa2a52cf4039`
- Grounded was correctly `true`
- Agents used matched: `["city_operations_coordinator", "risk_intelligence_agent"]`
- Returned Kannada characters and structured headers correctly parsed

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

Phase 5 limitations: no frontend Google Maps, no cross-process cache, and no automatic fuzzy mapping. Traffic/Hospital Intelligence agents are read-only explainers over deterministic backend APIs. Google Places does not provide live beds or verified ICU/admission capability; WHO and Google do not provide universal real-time hospital-bed availability. Real API-key quota, billing, API enablement, and live Mysuru responses require manual verification.