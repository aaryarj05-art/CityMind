"""Confidence scoring and source ranking for incident evidence."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.schemas.evidence import EvidenceSource

logger = logging.getLogger(__name__)

DEFAULT_CONFIDENCE_WEIGHTS = {
    "independent_confirmations": 0.35,
    "report_consistency": 0.25,
    "official_confirmation": 0.20,
    "publication_freshness": 0.20,
}


def confidence_weights() -> dict[str, float]:
    raw = os.getenv("CITYMIND_EVIDENCE_CONFIDENCE_WEIGHTS_JSON", "")
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                weights = {key: float(parsed.get(key, value)) for key, value in DEFAULT_CONFIDENCE_WEIGHTS.items()}
                total = sum(max(0.0, value) for value in weights.values())
                if total > 0:
                    return {key: max(0.0, value) / total for key, value in weights.items()}
        except (TypeError, ValueError, json.JSONDecodeError):
            logger.warning("Invalid CITYMIND_EVIDENCE_CONFIDENCE_WEIGHTS_JSON; using defaults")
    return dict(DEFAULT_CONFIDENCE_WEIGHTS)


def publisher_key(source: EvidenceSource) -> str:
    host = urlparse(source.url).netloc.lower().removeprefix("www.")
    return f"{source.publisher_name.lower()}|{host}"


def independent_publishers(sources: list[EvidenceSource]) -> set[str]:
    return {publisher_key(source) for source in sources}


def freshness_factor(sources: list[EvidenceSource]) -> float:
    dated = [source.publication_time for source in sources if source.publication_time]
    if not dated:
        return 0.25 if sources else 0.0
    newest = max(value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc) for value in dated)
    age_hours = max(0.0, (datetime.now(timezone.utc) - newest).total_seconds() / 3600)
    if age_hours <= 24:
        return 1.0
    if age_hours <= 72:
        return 0.8
    if age_hours <= 168:
        return 0.55
    return 0.3


class ConfidenceCalculator:
    def calculate(self, sources: list[EvidenceSource]) -> tuple[int, dict[str, float], list[str], str]:
        weights = confidence_weights()
        unique_publishers = independent_publishers(sources)
        independent_factor = min(1.0, len(unique_publishers) / 3)
        consistency_factor = round(sum(source.relevance_score for source in sources) / len(sources), 3) if sources else 0.0
        official_factor = 1.0 if any(source.is_official for source in sources) else 0.0
        fresh_factor = freshness_factor(sources)
        factors = {
            "independent_confirmations": independent_factor,
            "report_consistency": consistency_factor,
            "official_confirmation": official_factor,
            "publication_freshness": fresh_factor,
        }
        score = int(round(sum(factors[key] * weights[key] for key in weights) * 100))
        if len(unique_publishers) == 1 and not official_factor:
            score = min(score, 64)
        if not sources:
            score = 0
        reasons = self.reasons(sources, factors)
        if score >= 75 and len(unique_publishers) >= 2:
            status = "VERIFIED"
        elif sources:
            status = "SINGLE-SOURCE VERIFICATION" if len(unique_publishers) == 1 else "PARTIALLY VERIFIED"
        else:
            status = "UNVERIFIED"
        logger.info("Evidence confidence calculated", extra={"score": score, "factors": factors, "source_count": len(sources), "status": status})
        return score, factors, reasons, status

    def reasons(self, sources: list[EvidenceSource], factors: dict[str, float]) -> list[str]:
        if not sources:
            return ["No live external evidence sources were verified for this incident."]
        unique_count = len(independent_publishers(sources))
        reasons = [f"Reported by {unique_count} independent publisher{'s' if unique_count != 1 else ''}."]
        if factors["report_consistency"] >= 0.7:
            reasons.append("Incident category and location terms are consistent across the verified source set.")
        elif factors["report_consistency"] >= 0.4:
            reasons.append("Some incident details match the CityMind incident record, but consistency is partial.")
        else:
            reasons.append("Source details only weakly match the CityMind incident record, reducing confidence.")
        if factors["official_confirmation"] > 0:
            reasons.append("Official or government-linked confirmation is present.")
        else:
            reasons.append("No official government confirmation was verified from available sources.")
        if factors["publication_freshness"] >= 0.8:
            reasons.append("Publication timestamps are fresh relative to the incident review time.")
        else:
            reasons.append("Publication freshness is limited or unavailable, reducing confidence.")
        reasons.append("Evidence verified from live external source providers; unavailable providers are not substituted with simulated evidence.")
        if unique_count == 1:
            reasons.append("Single-source verification: confidence reduced because no independent second publisher was verified.")
        return reasons


class SourceRankingEngine:
    def rank_score(self, source: EvidenceSource, sources: list[EvidenceSource]) -> float:
        confirmation_bonus = 1.0 if len(independent_publishers(sources)) > 1 else 0.4
        freshness = freshness_factor([source])
        completeness = 1.0 if source.title and source.url and source.publication_time else 0.65
        score = (
            source.credibility_score * 0.35
            + freshness * 0.25
            + completeness * 0.20
            + source.relevance_score * 0.15
            + confirmation_bonus * 0.05
        )
        if source.is_official:
            score += 0.1
        return min(1.0, score)

    def primary_source(self, sources: list[EvidenceSource]) -> EvidenceSource | None:
        if not sources:
            return None
        ranked = sorted(sources, key=lambda source: (-self.rank_score(source, sources), source.publication_time or datetime.min.replace(tzinfo=timezone.utc), source.publisher_name))
        logger.info("Evidence primary source selected", extra={"publisher": ranked[0].publisher_name, "url": ranked[0].url})
        return ranked[0]