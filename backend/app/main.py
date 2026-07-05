from datetime import datetime, timezone
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.dependencies.auth import require_permission, require_user_or_internal_service
from app.routes import (
    ai, areas, auth, complaints, dashboard, demo, dispatch, hospitals,
    hospitals_google, incidents, maps, resources, risk,
)
from app.seed.seed_data import seed_db

load_dotenv()

# Importing routers loads all models before the lightweight SQLite migration.
Base.metadata.create_all(bind=engine)


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
    on_startup=[startup_event],
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_popup_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "environment": os.getenv("APP_ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Public authentication exchange; all operational routers enforce deterministic RBAC.
app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api", dependencies=[Depends(require_permission("dashboard.read"))])
app.include_router(areas.router, prefix="/api", dependencies=[Depends(require_permission("risk.read"))])
app.include_router(incidents.router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("incidents.read"))])
app.include_router(resources.router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("resources.read"))])
app.include_router(complaints.router, prefix="/api", dependencies=[Depends(require_permission("incidents.read"))])
app.include_router(risk.router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("risk.read"))])
app.include_router(dispatch.allocation_router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("dispatch.read"))])
app.include_router(dispatch.dispatch_router, prefix="/api")
app.include_router(demo.router, prefix="/api", dependencies=[Depends(require_permission("settings.manage"))])
app.include_router(maps.router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("traffic.read"))])
app.include_router(hospitals_google.router, prefix="/api", dependencies=[Depends(require_user_or_internal_service("hospitals.read"))])
app.include_router(hospitals.router, prefix="/api", dependencies=[Depends(require_permission("hospital_capacity.read"))])
app.include_router(ai.router)