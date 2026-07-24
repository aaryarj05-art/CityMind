"""Incident Evidence & Source Verification domain service."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.models import Area, Incident
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


def _timeline(sources: list[EvidenceSource], confidence_score: int, last_updated: datetime) -> list[EvidenceTimelineItem]:
    items = [
        EvidenceTimelineItem(
            timestamp=source.publication_time or last_updated,
            label=f"{source.publisher_name} published or confirmed evidence for the incident",
            publisher_name=source.publisher_name,
            url=source.url,
        )
        for source in sources
    ]
    if sources:
        items.append(EvidenceTimelineItem(
            timestamp=last_updated,
            label=f"CityMind confidence updated to {confidence_score}% from verified source evidence",
            publisher_name="CityMind Evidence Engine",
        ))
    return sorted(items, key=lambda item: item.timestamp, reverse=True)


def _location(area: Area | None, incident: Incident) -> str:
    if area:
        return f"{area.name}, Ward {area.ward_number}, Mysuru"
    return f"{incident.latitude:.5f}, {incident.longitude:.5f}"


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

    def get_incident_evidence(self, db: Session, incident_id: int) -> IncidentEvidence | None:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return None
        area = db.get(Area, incident.area_id) if incident.area_id else None
        sources, errors = self.aggregator.collect(incident, area)
        official_sources = self.government.official_sources(sources)
        confidence_score, factors, reasons, status = self.confidence.calculate(sources)
        primary = self.ranking.primary_source(sources)
        if official_sources and "Official or government-linked confirmation is present." not in reasons:
            reasons.append("Official or government-linked confirmation is present.")
        last_updated = datetime.now(timezone.utc)
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
            evidence_timeline=_timeline(sources, confidence_score, last_updated),
            last_updated=last_updated,
            banner=EVIDENCE_BANNER,
            single_source=len({publisher_key(source) for source in sources}) == 1,
            provider_errors=errors,
        )
        logger.info("Incident evidence verification completed", extra={"incident_id": incident.id, "status": status, "confidence_score": confidence_score, "primary_source": primary.publisher_name if primary else None})
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
        return IncidentConfidence(
            incident_id=evidence.incident_id,
            confidence_score=evidence.confidence_score,
            verification_status=evidence.verification_status,
            trust_reasons=evidence.trust_reasons,
            factors={"source_count": float(source_count), "independent_hosts": float(unique_hosts), "single_source": 1.0 if evidence.single_source else 0.0},
        )


def get_incident_evidence(db: Session, incident_id: int) -> IncidentEvidence | None:
    return EvidenceService().get_incident_evidence(db, incident_id)


def get_incident_sources(db: Session, incident_id: int) -> list[EvidenceSource] | None:
    return EvidenceService().get_sources(db, incident_id)


def get_incident_confidence(db: Session, incident_id: int) -> IncidentConfidence | None:
    return EvidenceService().get_confidence(db, incident_id)