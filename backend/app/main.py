from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, SessionLocal, engine
from app.dependencies.auth import require_permission, require_user_or_internal_service
from app.routes import (
    ai, areas, auth, complaints, dashboard, demo, dispatch, hospitals,
    hospitals_google, incidents, maps, resources, risk, security,
)
from app.seed.seed_data import seed_db
from app.runtime_config import allowed_origins, environment_name, validate_api_production_config

load_dotenv()

# Importing routers loads all models before the lightweight SQLite migration.
Base.metadata.create_all(bind=engine)


def _migrate_security_event_columns():
    """Additive SQLite migration for Phase 6B decision metadata."""
    if engine.dialect.name != "sqlite" or "security_events" not in inspect(engine).get_table_names():
        return
    columns = {column["name"] for column in inspect(engine).get_columns("security_events")}
    statements = []
    if "model_version" not in columns:
        statements.append("ALTER TABLE security_events ADD COLUMN model_version VARCHAR")
    if "source_metadata_json" not in columns:
        statements.append("ALTER TABLE security_events ADD COLUMN source_metadata_json TEXT NOT NULL DEFAULT '{}'")
    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


_migrate_security_event_columns()


def startup_event():
    validate_api_production_config()
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
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
        "environment": environment_name(),
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
app.include_router(security.router, prefix="/api")