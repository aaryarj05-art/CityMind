from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_permission
from app.runtime_config import environment_name, judge_open_access
from app.schemas.dispatch import DemoResetResponse
from app.seed.seed_data import SIMULATION_DISCLAIMER
from app.services.auth_service import AuthenticatedUser
from app.services.dispatch_service import reset_demo
from app.services.security_audit import append_security_event

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/reset", response_model=DemoResetResponse)
def demo_reset(request: Request,
    current: AuthenticatedUser = Depends(require_permission("settings.manage")),
    db: Session = Depends(get_db)):
    environment = environment_name()
    if environment not in {"development", "demo", "test"} and not judge_open_access():
        raise HTTPException(status_code=403, detail="Demo reset is disabled outside development, demo, or authenticated judge mode")
    result = reset_demo(db)
    append_security_event(db, event_type="operational_approval", action="demo_reset", blocked=False,
        categories=["human_approval", "judge_mode" if judge_open_access() else "demo_mode"],
        reason_codes=["DEMO_RESET_BY_AUTHENTICATED_USER"], user=current.user,
        session_id=str(current.claims.get("session_id", "")), endpoint="/api/demo/reset",
        source_ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
        limitations=[SIMULATION_DISCLAIMER])
    return result
