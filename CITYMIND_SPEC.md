# CityMind – AI Decision Intelligence Platform for Smarter Cities

## Project Vision
CityMind is an AI Decision Intelligence Platform designed to aggregate, analyze, and visualize real-time urban data for smart cities. It empowers city control-room officers, traffic departments, emergency response teams, hospitals, municipal departments, and public-safety authorities to make data-driven decisions and respond effectively to urban challenges.

## Primary Users
- City Control-Room Officers
- Traffic Departments
- Emergency Response Teams (Police, Fire, Ambulance)
- Hospital Administration
- Municipal Departments

## Final MVP Scope
The complete platform will feature:
- Traffic, weather, incident, citizen complaint, hospital capacity, and emergency-resource data aggregation.
- Identification of high-risk areas using a calculated city risk score.
- Prediction of developing emergencies and recommended response actions.
- Allocation and dispatch of emergency resources.
- Explainable AI recommendations.
- Interactive map-based city overview.
- Gemini-powered assistant for intuitive query resolution.

## Architecture Overview
- **Frontend**: React, Vite, Tailwind CSS, React Router, Axios, Recharts, Leaflet.
- **Backend**: Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic, SQLite.
- **Database**: SQLite (Phase 1), to be upgraded in later phases.

## Current Technology Stack
- **Frontend**: React (JS, no TS), Vite, Tailwind CSS, Leaflet.
- **Backend**: FastAPI, SQLAlchemy, SQLite, python-dotenv.

## Database Entities
- **Area**: Represents a city ward/zone with operational scores and aggregated metrics.
- **Incident**: Captures specific events (accidents, fires, etc.) occurring within an area.
- **Resource**: Emergency units (ambulances, police, fire engines) with statuses and locations.
- **Hospital**: Medical facilities with bed capacity metrics.
- **Complaint**: Citizen-reported issues with priority and status.

## Planned API Contracts
- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/dashboard`
- `GET /api/areas` & `GET /api/areas/{id}`
- `GET /api/incidents` & `GET /api/incidents/{id}`
- `GET /api/resources` & `GET /api/resources/{id}`
- `GET /api/hospitals` & `GET /api/hospitals/{id}`
- `GET /api/complaints` & `GET /api/complaints/{id}`

## Statuses
- **Resource Statuses**: Available, Dispatched, On Scene, Returning, Maintenance, Offline.
- **Incident Statuses**: Reported, Assigned, In Progress, Resolved, Closed.
- **Operational Status Levels**: Low, Moderate, High, Critical.

## Future Five-Phase Roadmap
1. **Phase 1: Foundation and dashboard (Current)**
2. **Phase 2: Deterministic risk-scoring engine**
3. **Phase 3: Resource allocation and dispatch**
4. **Phase 4: Gemini recommendations and agentic intelligence**
5. **Phase 5: Simulation, deployment, testing, and demo polish**

> **IMPORTANT:** Future agents must preserve working functionality, implement only the requested phase, avoid rewriting unrelated files, and update CURRENT_STATUS.md after meaningful changes.
