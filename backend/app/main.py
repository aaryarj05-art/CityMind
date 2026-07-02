from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

from app.database import engine, Base, SessionLocal
from app.seed.seed_data import seed_db
from app.routes import dashboard, areas, incidents, resources, hospitals, complaints, risk

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

# Seed database on startup
def startup_event():
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()

app = FastAPI(
    title="CityMind API",
    description="Backend for AI Decision Intelligence Platform for Smarter Cities",
    version="1.0.0",
    on_startup=[startup_event]
)

# CORS configuration
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "environment": os.getenv("APP_ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Include routers
app.include_router(dashboard.router, prefix="/api")
app.include_router(areas.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(hospitals.router, prefix="/api")
app.include_router(complaints.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
