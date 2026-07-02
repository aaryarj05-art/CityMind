# CityMind

CityMind – AI Decision Intelligence Platform for Smarter Cities.

This project provides a professional smart-city control-room dashboard for city control-room officers, traffic departments, emergency response teams, hospitals, municipal departments, and public-safety authorities.

## Phase 1 Scope
This repository contains Phase 1: Project Foundation and Dashboard Shell. It establishes a robust foundation with a React frontend, FastAPI backend, SQLite database, and realistic mock data for Mysuru city. Advanced AI algorithms, Gemini, and real-time dispatches will be implemented in future phases.

## Architecture Summary
- **Frontend**: React, Vite, Tailwind CSS, React Router, Axios, Recharts, Leaflet.
- **Backend**: Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic, SQLite.
- **Database**: SQLite (Phase 1).

## Folder Structure
```text
citymind/
├── frontend/        # React application
├── backend/         # FastAPI application
├── CITYMIND_SPEC.md # Project vision, scope, API contracts
├── CURRENT_STATUS.md# Implementation status tracking
└── README.md        # Setup and run instructions
```

## Prerequisites
- Node.js (v18+)
- Python (3.9+)
- Git

## Windows Setup Instructions

### Backend Installation
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Database Seeding
The backend application is configured to automatically seed the SQLite database upon the first startup.

### Run Backend
```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```
The FastAPI server will start on `http://localhost:8000`.
API documentation is available at `http://localhost:8000/docs`.

### Frontend Installation & Run
```powershell
cd frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:5173`.

## Environment Variables
Example `.env` for backend:
```text
APP_ENV=development
DATABASE_URL=sqlite:///./citymind.db
FRONTEND_ORIGIN=http://localhost:5173
```
Example `.env` for frontend:
```text
VITE_API_BASE_URL=http://localhost:8000/api
```

## Troubleshooting
- If you face CORS errors, check `FRONTEND_ORIGIN` in the backend `.env`.
- Ensure ports `8000` and `5173` are not in use.
- The `citymind.db` file will be created in the `backend` directory. Delete it and restart the server to trigger re-seeding if data is corrupted.

## Screenshots
*(To be added)*

## Future Roadmap
- Phase 2: Deterministic risk-scoring engine
- Phase 3: Resource allocation and dispatch
- Phase 4: Gemini recommendations and agentic intelligence
- Phase 5: Simulation, deployment, testing, and demo polish
