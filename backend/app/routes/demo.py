from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dispatch import DemoResetResponse
from app.services.dispatch_service import reset_demo
from app.runtime_config import environment_name

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/reset", response_model=DemoResetResponse)
def demo_reset(db: Session = Depends(get_db)):
    environment = environment_name()
    if environment not in {"development", "demo", "test"}:
        raise HTTPException(status_code=403, detail="Demo reset is disabled outside development or demo environments")
    return reset_demo(db)
