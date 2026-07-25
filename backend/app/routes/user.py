from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_permission
from app.schemas.citizen_report import CitizenReportResponse
from app.services.citizen_report_service import CitizenReportService, ReportStorageError, ReportValidationError, STORAGE_ERROR_MESSAGE, resolve_upload_dir

router = APIRouter(prefix="/user", tags=["Citizen Reporting"])


@router.post("/report", response_model=CitizenReportResponse, status_code=201)
def submit_citizen_report(
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    readable_address: str = Form(...),
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _permission=Depends(require_permission("citizen.report.create")),
):
    try:
        return CitizenReportService().submit_report(
            db,
            description=description,
            latitude=latitude,
            longitude=longitude,
            readable_address=readable_address,
            files=images,
        )
    except ReportValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ReportStorageError as exc:
        raise HTTPException(status_code=500, detail=STORAGE_ERROR_MESSAGE) from exc


@router.get("/report/{report_id}", response_model=CitizenReportResponse)
def read_citizen_report(
    report_id: int,
    db: Session = Depends(get_db),
    _permission=Depends(require_permission("citizen.report.read")),
):
    report = CitizenReportService().get_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Citizen report not found")
    return report


@router.get("/report-media/{stored_filename}")
def read_report_media(
    stored_filename: str,
    _permission=Depends(require_permission("citizen.report.read")),
):
    if "/" in stored_filename or "\\" in stored_filename or ".." in stored_filename:
        raise HTTPException(status_code=404, detail="Media not found")
    media_path = resolve_upload_dir() / stored_filename
    if not media_path.exists() or not media_path.is_file():
        raise HTTPException(status_code=404, detail="Media not found")
    return FileResponse(media_path)