# CityMind frontend

React/Vite control-room UI for the CityMind FastAPI and Google ADK services.

## Local setup

Create `frontend/.env` from `.env.example` and set only browser-visible values: `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, and the referrer-restricted `VITE_GOOGLE_MAPS_API_KEY`. Never place server Maps, Gemini, JWT, or internal-service secrets in the frontend.

```powershell
npm install
npm run dev
npm test
npm run build
```

The Overview refreshes every 20 seconds while the tab is visible and immediately after successful mutations. Resource browsing is server-paginated. Judge mode is reported by the authenticated backend session and displayed once in the shared page shell; the browser cannot self-assign a role.

Operational simulation seeded from public Mysuru facility directories. Vehicle availability, staffing and hospital capacity are simulated for prototype demonstration.

Live Google and login flows require valid restricted credentials and manual browser verification. The production build may emit the existing large-chunk advisory.