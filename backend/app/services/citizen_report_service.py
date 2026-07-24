"""Citizen eyewitness incident reporting services."""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models import Area, CitizenReport, CitizenReportMedia, Incident
from app.services.distance_service import has_valid_coordinates, haversine_km

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_DESCRIPTION_LENGTH = 500
MAX_ADDRESS_LENGTH = 200
MATCH_RADIUS_KM = 1.0


class ReportValidationError(ValueError):
    pass


@dataclass(frozen=True)
class StoredUpload:
    original_filename: str
    stored_filename: str
    content_type: str
    media_url: str
    size_bytes: int


class ReportValidationService:
    def sanitize_description(self, description: str) -> str:
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", description or "").strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        if not cleaned:
            raise ReportValidationError("Description is required")
        if len(cleaned) > MAX_DESCRIPTION_LENGTH:
            raise ReportValidationError(f"Description must be {MAX_DESCRIPTION_LENGTH} characters or fewer")
        return cleaned

    def validate_location(self, latitude: float, longitude: float) -> None:
        if not has_valid_coordinates(latitude, longitude):
            raise ReportValidationError("Valid latitude and longitude are required")

    def sanitize_address(self, readable_address: str | None) -> str:
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", readable_address or "").strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        if not cleaned:
            raise ReportValidationError("Readable incident location is required")
        if len(cleaned) > MAX_ADDRESS_LENGTH:
            raise ReportValidationError(f"Readable incident location must be {MAX_ADDRESS_LENGTH} characters or fewer")
        return cleaned

    def validate_files(self, files: Iterable[UploadFile]) -> list[UploadFile]:
        uploads = list(files or [])
        if not uploads:
            raise ReportValidationError("At least one incident image is required")
        for upload in uploads:
            if upload.content_type not in ALLOWED_CONTENT_TYPES:
                raise ReportValidationError("Only JPG, JPEG, PNG, and WEBP images are supported")
        return uploads


class ImageStorageService:
    def __init__(self, base_dir: str | Path = "uploads/citizen_reports"):
        self.base_dir = Path(base_dir)

    def store(self, upload: UploadFile) -> StoredUpload:
        extension = ALLOWED_CONTENT_TYPES.get(upload.content_type)
        if extension is None:
            raise ReportValidationError("Unsupported image format")
        self.base_dir.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}{extension}"
        target = self.base_dir / stored_filename
        size = 0
        with target.open("wb") as output:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    target.unlink(missing_ok=True)
                    raise ReportValidationError("Each uploaded image must be 5 MB or smaller")
                output.write(chunk)
        logger.info("Citizen report upload stored", extra={"stored_filename": stored_filename, "size_bytes": size, "content_type": upload.content_type})
        return StoredUpload(
            original_filename=Path(upload.filename or "incident-image").name,
            stored_filename=stored_filename,
            content_type=upload.content_type or "application/octet-stream",
            media_url=f"/api/user/report-media/{stored_filename}",
            size_bytes=size,
        )


class LocationMatchingService:
    def nearest_incident(self, db: Session, latitude: float, longitude: float) -> tuple[Incident | None, float | None]:
        candidates = db.query(Incident).filter(Incident.status.notin_(["Resolved", "Closed"])).all()
        best: tuple[Incident | None, float | None] = (None, None)
        for incident in candidates:
            distance = haversine_km(latitude, longitude, incident.latitude, incident.longitude)
            if distance <= MATCH_RADIUS_KM and (best[1] is None or distance < best[1]):
                best = (incident, distance)
        return best

    def nearest_area(self, db: Session, latitude: float, longitude: float) -> Area | None:
        areas = db.query(Area).all()
        if not areas:
            return None
        return min(areas, key=lambda area: haversine_km(latitude, longitude, area.latitude, area.longitude))


class CitizenReportService:
    def __init__(self, validator: ReportValidationService | None = None, storage: ImageStorageService | None = None, matcher: LocationMatchingService | None = None):
        self.validator = validator or ReportValidationService()
        self.storage = storage or ImageStorageService()
        self.matcher = matcher or LocationMatchingService()

    def submit_report(self, db: Session, *, description: str, latitude: float, longitude: float, readable_address: str | None, files: list[UploadFile]) -> CitizenReport:
        description = self.validator.sanitize_description(description)
        self.validator.validate_location(latitude, longitude)
        uploads = self.validator.validate_files(files)
        stored_files = [self.storage.store(upload) for upload in uploads]
        incident, distance_km = self.matcher.nearest_incident(db, latitude, longitude)
        match_status = "matched"
        if incident is None:
            area = self.matcher.nearest_area(db, latitude, longitude)
            incident = Incident(
                title="Citizen-reported incident awaiting verification",
                description=description,
                category="Citizen Report",
                severity="Medium",
                status="Reported",
                area_id=area.id if area else None,
                latitude=latitude,
                longitude=longitude,
                responding_department="Citizen Report Intake",
            )
            db.add(incident)
            db.flush()
            match_status = "new_pending_incident"
            distance_meters = 0.0
        else:
            distance_meters = round((distance_km or 0.0) * 1000, 2)

        report = CitizenReport(
            incident_id=incident.id,
            description=description,
            latitude=latitude,
            longitude=longitude,
            readable_address=readable_address,
            verification_status="Pending Verification",
            match_status=match_status,
            distance_to_incident_meters=distance_meters,
        )
        db.add(report)
        db.flush()
        for stored in stored_files:
            db.add(CitizenReportMedia(
                report_id=report.id,
                original_filename=stored.original_filename,
                stored_filename=stored.stored_filename,
                content_type=stored.content_type,
                media_url=stored.media_url,
                size_bytes=stored.size_bytes,
            ))
        db.commit()
        db.refresh(report)
        logger.info("Citizen report submitted", extra={"report_id": report.id, "incident_id": incident.id, "match_status": match_status, "latitude": latitude, "longitude": longitude})
        return report

    def get_report(self, db: Session, report_id: int) -> CitizenReport | None:
        return db.get(CitizenReport, report_id)

    def eyewitness_for_incident(self, db: Session, incident_id: int) -> list[CitizenReport]:
        return db.query(CitizenReport).filter(CitizenReport.incident_id == incident_id).order_by(CitizenReport.submitted_at.desc()).all()

    def update_verification(self, db: Session, incident_id: int, corroborated: bool) -> None:
        if not corroborated:
            return
        reports = self.eyewitness_for_incident(db, incident_id)
        changed = False
        for report in reports:
            if report.verification_status == "Pending Verification":
                report.verification_status = "Verified"
                changed = True
        if changed:
            db.commit()
            logger.info("Citizen eyewitness reports corroborated", extra={"incident_id": incident_id, "report_count": len(reports)})