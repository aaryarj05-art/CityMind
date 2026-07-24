"""Incident Evidence & Source Verification domain service."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.models import Area, CitizenReport, Incident
from app.schemas.citizen_report import EyewitnessEvidence
from app.schemas.evidence import EvidenceSource, EvidenceTimelineItem, IncidentConfidence, IncidentEvidence
from app.services.evidence_confidence import ConfidenceCalculator, SourceRankingEngine, publisher_key
from app.services.evidence_sources import default_evidence_providers

logger = logging.getLogger(__name__)

EVIDENCE_BANNER = "Evidence generated from live external sources. Every source below can be independently verified."


def _dedupe_sources(sources: list[EvidenceSource]) -> list[EvidenceSource]:
    seen: set[str] = set()
    unique: list[EvidenceSource] = []
    for source in sources:
        key = source.url.strip().lower() or f"{publisher_key(source)}|{source.title.lower()}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(source)
    return unique


def _sort_sources(sources: list[EvidenceSource]) -> list[EvidenceSource]:
    return sorted(sources, key=lambda item: (item.publication_time or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _timeline(sources: list[EvidenceSource], reports: list[CitizenReport], confidence_score: int, last_updated: datetime) -> list[EvidenceTimelineItem]:
    items = [
        EvidenceTimelineItem(
            timestamp=source.publication_time or last_updated,
            label=f"{source.publisher_name} published or confirmed evidence for the incident",
            publisher_name=source.publisher_name,
            url=source.url,
        )
        for source in sources
    ]
    items.extend(
        EvidenceTimelineItem(
            timestamp=report.submitted_at,
            label=f"Eyewitness report #{report.id} submitted with {len(report.media)} image attachment{'s' if len(report.media) != 1 else ''}",
            publisher_name="Citizen Eyewitness",
        )
        for report in reports
    )
    if sources or reports:
        items.append(EvidenceTimelineItem(
            timestamp=last_updated,
            label=f"CityMind confidence updated to {confidence_score}% from verified source and eyewitness evidence",
            publisher_name="CityMind Evidence Engine",
        ))
    return sorted(items, key=lambda item: _as_utc(item.timestamp), reverse=True)


def _location(area: Area | None, incident: Incident) -> str:
    if area:
        return f"{area.name}, Ward {area.ward_number}, Mysuru"
    return f"{incident.latitude:.5f}, {incident.longitude:.5f}"


def _eyewitness_items(reports: list[CitizenReport]) -> list[EyewitnessEvidence]:
    return [
        EyewitnessEvidence(
            report_id=report.id,
            verification_status=report.verification_status,
            description=report.description,
            latitude=report.latitude,
            longitude=report.longitude,
            readable_address=report.readable_address,
            submitted_at=report.submitted_at,
            distance_from_incident_meters=report.distance_to_incident_meters,
            media=report.media,
        )
        for report in reports
    ]


def _fresh_eyewitness_factor(reports: list[CitizenReport], now: datetime) -> float:
    if not reports:
        return 0.0
    newest = max(report.submitted_at.replace(tzinfo=timezone.utc) if report.submitted_at.tzinfo is None else report.submitted_at.astimezone(timezone.utc) for report in reports)
    age_hours = max(0.0, (now - newest).total_seconds() / 3600)
    if age_hours <= 6:
        return 1.0
    if age_hours <= 24:
        return 0.8
    if age_hours <= 72:
        return 0.55
    return 0.3


def _proximity_factor(reports: list[CitizenReport]) -> float:
    distances = [report.distance_to_incident_meters for report in reports if report.distance_to_incident_meters is not None]
    if not distances:
        return 0.0
    values = [max(0.0, 1.0 - min(distance, 1000.0) / 1000.0) for distance in distances]
    return round(sum(values) / len(values), 3)


def _apply_eyewitness_evidence(confidence_score: int, factors: dict[str, float], reasons: list[str], status: str, reports: list[CitizenReport], sources: list[EvidenceSource], now: datetime) -> tuple[int, dict[str, float], list[str], str]:
    if not reports:
        return confidence_score, factors, reasons, status

    report_factor = min(1.0, len(reports) / 3)
    proximity = _proximity_factor(reports)
    freshness = _fresh_eyewitness_factor(reports, now)
    eyewitness_score = int(round((report_factor * 0.45 + proximity * 0.35 + freshness * 0.20) * 55))
    corroborated = bool(sources) or len(reports) >= 2

    factors = {
        **factors,
        "eyewitness_report_count": float(len(reports)),
        "eyewitness_proximity": proximity,
        "eyewitness_freshness": freshness,
        "eyewitness_corroborated": 1.0 if corroborated else 0.0,
    }

    if sources:
        confidence_score = min(100, confidence_score + min(10, len(reports) * 3))
    else:
        confidence_score = max(confidence_score, eyewitness_score)

    reasons = [reason for reason in reasons if reason != "No live external evidence sources were verified for this incident."]
    reasons.append(f"{len(reports)} eyewitness submission{'s' if len(reports) != 1 else ''} attached with image evidence and reporter location metadata.")
    if proximity >= 0.7:
        reasons.append("Eyewitness reporter location is close to the incident coordinates.")
    elif proximity > 0:
        reasons.append("Eyewitness reporter location is near the incident area, but proximity is not exact.")
    else:
        reasons.append("Eyewitness report location could not be matched closely enough to raise confidence by proximity.")
    if corroborated:
        reasons.append("Eyewitness evidence is corroborated by another eyewitness report or live external source evidence.")
    else:
        reasons.append("Single eyewitness report remains Pending Verification until corroborated by another eyewitness, news, or government source.")

    if not sources:
        status = "PARTIALLY VERIFIED" if corroborated else "PENDING VERIFICATION"
    return confidence_score, factors, reasons, status


class EvidenceAggregator:
    def __init__(self, providers=None, timeout_seconds: float = 5.0):
        self.providers = providers or default_evidence_providers()
        self.timeout_seconds = timeout_seconds

    def collect(self, incident: Incident, area: Area | None) -> tuple[list[EvidenceSource], list[str]]:
        sources: list[EvidenceSource] = []
        errors: list[str] = []
        with httpx.Client(timeout=httpx.Timeout(self.timeout_seconds), follow_redirects=True) as client:
            for provider in self.providers:
                start = time.perf_counter()
                try:
                    provider_sources = provider.fetch(incident, area, client)
                    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                    logger.info("Evidence provider completed", extra={"provider": provider.name, "latency_ms": elapsed_ms, "evidence_count": len(provider_sources)})
                    sources.extend(provider_sources)
                except Exception as exc:
                    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                    message = f"{provider.name}: {exc.__class__.__name__}"
                    errors.append(message)
                    logger.warning("Evidence provider failed", extra={"provider": provider.name, "latency_ms": elapsed_ms, "error": str(exc)})
        unique_sources = _dedupe_sources(sources)
        logger.info("Evidence aggregation completed", extra={"incident_id": incident.id, "evidence_count": len(unique_sources), "provider_errors": len(errors)})
        return _sort_sources(unique_sources), errors


class GovernmentVerificationService:
    def official_sources(self, sources: list[EvidenceSource]) -> list[EvidenceSource]:
        official = [source for source in sources if source.is_official or source.source_type == "government"]
        logger.info("Government evidence evaluated", extra={"official_count": len(official)})
        return official


class EvidenceService:
    def __init__(self, aggregator: EvidenceAggregator | None = None, confidence: ConfidenceCalculator | None = None, ranking: SourceRankingEngine | None = None, government: GovernmentVerificationService | None = None):
        self.aggregator = aggregator or EvidenceAggregator()
        self.confidence = confidence or ConfidenceCalculator()
        self.ranking = ranking or SourceRankingEngine()
        self.government = government or GovernmentVerificationService()

    def _eyewitness_reports(self, db: Session, incident_id: int) -> list[CitizenReport]:
        return db.query(CitizenReport).filter(CitizenReport.incident_id == incident_id).order_by(CitizenReport.submitted_at.desc()).all()

    def _mark_corroborated_reports(self, db: Session, reports: list[CitizenReport], corroborated: bool) -> None:
        if not corroborated:
            return
        changed = False
        for report in reports:
            if report.verification_status == "Pending Verification":
                report.verification_status = "Verified"
                changed = True
        if changed:
            db.commit()
            for report in reports:
                db.refresh(report)
            logger.info("Eyewitness reports marked verified after corroboration", extra={"report_count": len(reports)})

    def get_incident_evidence(self, db: Session, incident_id: int) -> IncidentEvidence | None:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return None
        area = db.get(Area, incident.area_id) if incident.area_id else None
        sources, errors = self.aggregator.collect(incident, area)
        reports = self._eyewitness_reports(db, incident_id)
        official_sources = self.government.official_sources(sources)
        self._mark_corroborated_reports(db, reports, bool(sources) or len(reports) >= 2)
        confidence_score, factors, reasons, status = self.confidence.calculate(sources)
        primary = self.ranking.primary_source(sources)
        if official_sources and "Official or government-linked confirmation is present." not in reasons:
            reasons.append("Official or government-linked confirmation is present.")
        last_updated = datetime.now(timezone.utc)
        confidence_score, factors, reasons, status = _apply_eyewitness_evidence(confidence_score, factors, reasons, status, reports, sources, last_updated)
        response = IncidentEvidence(
            incident_id=incident.id,
            incident_title=incident.title,
            location=_location(area, incident),
            incident_time=incident.reported_at,
            verification_status=status,
            confidence_score=confidence_score,
            primary_source=primary,
            verified_by=sources,
            trust_reasons=reasons,
            evidence_timeline=_timeline(sources, reports, confidence_score, last_updated),
            last_updated=last_updated,
            banner=EVIDENCE_BANNER,
            single_source=len({publisher_key(source) for source in sources}) == 1,
            provider_errors=errors,
            eyewitness_evidence=_eyewitness_items(reports),
        )
        logger.info("Incident evidence verification completed", extra={"incident_id": incident.id, "status": status, "confidence_score": confidence_score, "primary_source": primary.publisher_name if primary else None, "eyewitness_count": len(reports)})
        return response

    def get_sources(self, db: Session, incident_id: int) -> list[EvidenceSource] | None:
        evidence = self.get_incident_evidence(db, incident_id)
        return evidence.verified_by if evidence else None

    def get_confidence(self, db: Session, incident_id: int) -> IncidentConfidence | None:
        evidence = self.get_incident_evidence(db, incident_id)
        if evidence is None:
            return None
        source_count = len(evidence.verified_by)
        unique_hosts = len({urlparse(source.url).netloc.lower() for source in evidence.verified_by})
        eyewitness_count = len(evidence.eyewitness_evidence)
        return IncidentConfidence(
            incident_id=evidence.incident_id,
            confidence_score=evidence.confidence_score,
            verification_status=evidence.verification_status,
            trust_reasons=evidence.trust_reasons,
            factors={
                "source_count": float(source_count),
                "independent_hosts": float(unique_hosts),
                "single_source": 1.0 if evidence.single_source else 0.0,
                "eyewitness_report_count": float(eyewitness_count),
            },
        )

    def get_eyewitness(self, db: Session, incident_id: int) -> list[EyewitnessEvidence] | None:
        if db.get(Incident, incident_id) is None:
            return None
        return _eyewitness_items(self._eyewitness_reports(db, incident_id))


def get_incident_evidence(db: Session, incident_id: int) -> IncidentEvidence | None:
    return EvidenceService().get_incident_evidence(db, incident_id)


def get_incident_sources(db: Session, incident_id: int) -> list[EvidenceSource] | None:
    return EvidenceService().get_sources(db, incident_id)


def get_incident_confidence(db: Session, incident_id: int) -> IncidentConfidence | None:
    return EvidenceService().get_confidence(db, incident_id)


def get_incident_eyewitness(db: Session, incident_id: int) -> list[EyewitnessEvidence] | None:
    return EvidenceService().get_eyewitness(db, incident_id)