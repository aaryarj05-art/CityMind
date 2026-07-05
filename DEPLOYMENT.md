# CityMind Cloud Run deployment

This runbook prepares deployment; nothing in the repository deploys automatically. Run commands from an authenticated operator workstation. Never place secret values in command history or files.

## Architecture

The browser frontend is deployed separately and calls the public `citymind-api` Cloud Run URL. Cloud Run permits unauthenticated network access to the API so Google login exchange and browser requests can reach it; operational endpoints still enforce CityMind JWT permissions and deterministic RBAC. The API security gateway, approval boundary, and audit logging remain active.

`citymind-api` calls `citymind-adk` through `ADK_BASE_URL`. ADK tools call `citymind-api` through `CITYMIND_BACKEND_BASE_URL` and include the internal service token. The prototype ADK service is unauthenticated at the Cloud Run IAM layer because the current API bridge does not mint Google identity tokens. This makes the ADK HTTP surface publicly reachable and is a known prototype limitation; replace it with authenticated service-to-service ID tokens before production.

Both services run as `citymind-runtime@citymind-apac.iam.gserviceaccount.com` in project `citymind-apac`, region `asia-south1`. The scripts use Artifact Registry repository `citymind`; create it once if it does not exist:

```cmd
gcloud artifacts repositories create citymind --project citymind-apac --location asia-south1 --repository-format docker
```

Grant the runtime account only the APIs and secret versions it needs. Cloud Build's account also needs permission to push to that repository and deploy Cloud Run.

## Images and entrypoints

The backend directory is the build context. `.dockerignore` excludes environment files, tests, caches, local SQLite files, frontend output, Git/editor state, and temporary files.

- API: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1`
- ADK: validation followed by `adk api_server --host 0.0.0.0 --port ${PORT:-8080} --no-reload --session_service_uri=memory:// --artifact_service_uri=memory:// agent_apps`

The dedicated `agent_apps` directory contains only the `citymind_agents` wrapper, so `GET /list-apps` returns `["citymind_agents"]`; `app` and `tests` are not discoverable ADK applications. Local development uses `adk api_server --port 8001 agent_apps`.

One API worker avoids unsafe multi-process sharing of one SQLite file. The deployment script also uses concurrency 1 and should be limited to one instance during the prototype if consistent in-instance state is needed. None of these controls makes SQLite durable.

## Configuration

### citymind-adk

Secret Manager mappings:

| Environment variable | Secret |
|---|---|
| `GEMINI_API_KEY` | `citymind-google-api-key:latest` |
| `CITYMIND_INTERNAL_SERVICE_TOKEN` | `citymind-internal-service-token:latest` |

Regular environment variables:

| Name | Value |
|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `FALSE` |
| `CITYMIND_BACKEND_BASE_URL` | deployed `citymind-api` service URL |
| `ENVIRONMENT` | `production` |

### citymind-api

Secret Manager mappings:

| Environment variable | Secret |
|---|---|
| `GOOGLE_MAPS_SERVER_API_KEY` | `citymind-maps-server-key:latest` |
| `GOOGLE_OAUTH_CLIENT_ID` | `citymind-oauth-client-id:latest` |
| `CITYMIND_JWT_SECRET` | `citymind-jwt-secret:latest` |
| `CITYMIND_INTERNAL_SERVICE_TOKEN` | `citymind-internal-service-token:latest` |
| `CITYMIND_ROLE_MAPPINGS_JSON` | `citymind-role-mappings:latest` |

Regular environment variables:

| Name | Value |
|---|---|
| `CITYMIND_SESSION_MINUTES` | `15` |
| `ADK_BASE_URL` | deployed `citymind-adk` service URL |
| `ENVIRONMENT` | `production` |
| `CITYMIND_ALLOWED_ORIGINS` | exact deployed frontend origin |

`CITYMIND_ALLOWED_ORIGINS` accepts comma-separated exact HTTP(S) origins. Never use `*` with credentialed CORS. For one production frontend, pass one origin to the CMD script. If multiple origins are needed, use a gcloud env YAML file or its custom delimiter syntax so the comma remains part of the value.

Production startup rejects missing required settings and loopback service URLs without logging secret values. URLs are never hard-coded in application source.

## Build and deployment order

The two CMD scripts explicitly choose `Dockerfile.api` or `Dockerfile.adk` through separate Cloud Build configurations. They perform real builds and deployments only when an operator runs them.

There is a first-deployment dependency cycle: ADK needs the API URL, while the API needs the ADK URL. Bootstrap the API with a non-loopback, non-secret placeholder, then immediately replace it after ADK deploys:

```cmd
scripts\deploy-api.cmd https://configuration-pending.invalid https://FRONTEND_ORIGIN
for /f "usebackq delims=" %i in (`gcloud run services describe citymind-api --project citymind-apac --region asia-south1 --format="value(status.url)"`) do set CITYMIND_API_URL=%i
scripts\deploy-adk.cmd %CITYMIND_API_URL%
for /f "usebackq delims=" %i in (`gcloud run services describe citymind-adk --project citymind-apac --region asia-south1 --format="value(status.url)"`) do set CITYMIND_ADK_URL=%i
gcloud run services update citymind-api --project citymind-apac --region asia-south1 --update-env-vars ADK_BASE_URL=%CITYMIND_ADK_URL%
```

Do not send AI traffic during the short placeholder interval. On later releases, deploy ADK first with the existing API URL, then API with the resulting ADK URL:

```cmd
scripts\deploy-adk.cmd https://CURRENT_CITYMIND_API_URL
scripts\deploy-api.cmd https://NEW_CITYMIND_ADK_URL https://FRONTEND_ORIGIN
```

The scripts deliberately do not set minimum instances. A minimum of 1 can reduce cold starts but does not make SQLite durable. The API should remain capped at one instance for this prototype to reduce divergent local state; production persistence must be implemented before horizontal scaling.

## OAuth and frontend cutover

After the frontend is deployed:

1. Add its exact HTTPS origin to the OAuth client's authorized JavaScript origins in Google Cloud Console.
2. Set API `CITYMIND_ALLOWED_ORIGINS` to that exact origin and redeploy/update the service.
3. Build the frontend with `VITE_API_BASE_URL=https://CITYMIND_API_URL/api` and the separately restricted browser Maps key.
4. Do not add wildcard OAuth or CORS origins.

`Cross-Origin-Opener-Policy: same-origin-allow-popups` is returned by the API to preserve the Google popup flow.

## Persistence warning

The API image defaults to `sqlite:////tmp/citymind.db` and seeds a new database at instance startup. Cloud Run's filesystem is ephemeral. Users, auth audits, sessions represented in application state, dispatches, resource/capacity updates, and security/audit events may reset when an instance is stopped or replaced. Scale-out would create separate databases per instance. Minimum instances, concurrency 1, and max instances 1 are operational mitigations only—not durability.

Use Cloud SQL (relational migration path) or Firestore (if the data model is intentionally redesigned) for production persistence. This change does not introduce either service.

## Health and public verification

After both URLs are configured:

```cmd
curl https://CITYMIND_API_URL/api/health
curl https://CITYMIND_ADK_URL/list-apps
```

Expected API health includes `"status":"ok"` and `"environment":"production"`. Expected ADK discovery is exactly `["citymind_agents"]`.

Also verify:

- an unauthenticated operational API request returns 401 rather than data;
- a valid Google login exchanges for a short-lived CityMind token;
- a role-denied request returns 403;
- a blocked prompt is rejected before ADK and appears in redacted audit telemetry;
- an approved AI request reaches ADK and its tools reach the API with internal authentication;
- the frontend origin receives a matching CORS header and the COOP popup header;
- no localhost service URL appears in service configuration.

## Logs and rollback

Read recent logs without exposing environment values:

```cmd
gcloud run services logs read citymind-api --project citymind-apac --region asia-south1 --limit 100
gcloud run services logs read citymind-adk --project citymind-apac --region asia-south1 --limit 100
```

List revisions and send all traffic back to a known-good revision:

```cmd
gcloud run revisions list --service citymind-api --project citymind-apac --region asia-south1
gcloud run services update-traffic citymind-api --project citymind-apac --region asia-south1 --to-revisions GOOD_API_REVISION=100
gcloud run revisions list --service citymind-adk --project citymind-apac --region asia-south1
gcloud run services update-traffic citymind-adk --project citymind-apac --region asia-south1 --to-revisions GOOD_ADK_REVISION=100
```

Rollback restores code/configuration from the selected revision; it cannot recover SQLite data lost with an old instance.

## Known limitations

- SQLite and ADK in-memory sessions are ephemeral and instance-local.
- The ADK Cloud Run service is public during the prototype; internal tool calls remain token-protected, but IAM-authenticated API-to-ADK calls are still required for production.
- The security audit chain is tamper-evident application data, not immutable storage, and shares SQLite's reset risk.
- Process-local abuse controls, caches, and sessions reset on restart.
- Live Google APIs and Gemini still depend on enabled APIs, billing, quotas, valid restricted credentials, and manual end-to-end verification.
- Frontend deployment is intentionally out of scope until both backend services pass verification.

## Frontend Cloud Run deployment

The React/Vite frontend is packaged separately as `citymind-frontend`. Its multi-stage image builds with Node LTS and serves the generated static bundle from Nginx on port 8080. Nginx does not proxy API traffic; the browser calls the configured API URL directly.

Vite embeds these browser-visible build values:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_MAPS_API_KEY`

The OAuth client ID and browser-restricted Maps key are public browser identifiers, not server-side secrets. Never pass Gemini credentials, JWT secrets, the Maps server key, or the internal service token to the frontend build.

### Build and push

For a local production build using the deployed API:

```cmd
cd frontend
set VITE_API_BASE_URL=https://citymind-api-440231657585.asia-south1.run.app/api
npm run build
```

To build and push through Cloud Build, keep `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_MAPS_API_KEY` in `frontend\.env`, then run:

```cmd
scripts\deploy-frontend.cmd https://citymind-api-440231657585.asia-south1.run.app
```

The script removes one trailing slash from the argument, appends `/api` exactly once, loads the two browser identifiers without echoing them, and submits `frontend/cloudbuild.yaml`. It builds and pushes:

```text
asia-south1-docker.pkg.dev/citymind-apac/citymind/citymind-frontend:latest
```

The script does not deploy. After reviewing the build, run the command it prints:

```cmd
gcloud run deploy citymind-frontend --image=asia-south1-docker.pkg.dev/citymind-apac/citymind/citymind-frontend:latest --region=asia-south1 --platform=managed --allow-unauthenticated --port=8080
```

Capture the resulting frontend URL:

```cmd
for /f "usebackq delims=" %i in (`gcloud run services describe citymind-frontend --project citymind-apac --region asia-south1 --format="value(status.url)"`) do set CITYMIND_FRONTEND_URL=%i
```

Update the API to allow that exact origin—never a wildcard—and wait for the new revision to become ready:

```cmd
gcloud run services update citymind-api --project citymind-apac --region asia-south1 --update-env-vars CITYMIND_ALLOWED_ORIGINS=%CITYMIND_FRONTEND_URL%
```

In the Google OAuth client configuration, add `%CITYMIND_FRONTEND_URL%` as an exact Authorized JavaScript origin. In the browser Maps key restrictions, allow only the deployed frontend referrer, such as `%CITYMIND_FRONTEND_URL%/*`, and restrict the key to Maps JavaScript API. Do not use the backend Maps server key in the browser.

### Frontend production verification

- `curl %CITYMIND_FRONTEND_URL%/healthz` returns HTTP 200 with `ok`.
- Opening `%CITYMIND_FRONTEND_URL%/login` directly returns the SPA rather than an Nginx 404.
- Responses include `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- Google login accepts the exact deployed origin and protected routes still require a CityMind session.
- Browser API requests target `https://citymind-api-440231657585.asia-south1.run.app/api` with no doubled `/api`.
- Live Response loads the Maps JavaScript API with the referrer-restricted browser key.
- AI Command Center, Security Operations, and other protected routes retain their JWT/RBAC behavior.
- The built `dist` contains no localhost/loopback URLs or server-side secret names.
