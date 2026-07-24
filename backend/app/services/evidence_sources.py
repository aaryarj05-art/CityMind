"""Pluggable live evidence source providers for incident verification."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import quote_plus
from xml.etree import ElementTree

import httpx

from app.models import Area, Incident
from app.schemas.evidence import EvidenceSource

logger = logging.getLogger(__name__)

OFFICIAL_HINTS = ("police", "gov", "government", "district", "traffic", "fire", "disaster", "administration")
HIGH_CREDIBILITY_PUBLISHERS = {
    "reuters", "associated press", "ap", "bbc", "the hindu", "times of india", "deccan herald",
    "indian express", "pti", "press trust of india", "mysuru city police", "karnataka state police",
}


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if re.match(r"^\d{8}T\d{6}Z$", value):
            return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return _utc(datetime.fromisoformat(value))
    except ValueError:
        try:
            return _utc(parsedate_to_datetime(value))
        except (TypeError, ValueError):
            return None


def publisher_from_url(url: str) -> str:
    host = re.sub(r"^https?://", "", url).split("/")[0].lower()
    host = host.removeprefix("www.")
    parts = host.split(".")
    if len(parts) >= 2:
        return parts[-2].replace("-", " ").title()
    return host.title() or "Unknown Publisher"


def credibility_score(publisher: str, url: str) -> float:
    text = f"{publisher} {url}".lower()
    if any(hint in text for hint in OFFICIAL_HINTS):
        return 1.0
    if any(name in text for name in HIGH_CREDIBILITY_PUBLISHERS):
        return 0.9
    if url.startswith("https://"):
        return 0.72
    return 0.6


def is_official_source(publisher: str, url: str) -> bool:
    text = f"{publisher} {url}".lower()
    return any(hint in text for hint in OFFICIAL_HINTS)


def relevance_score(incident: Incident, area: Area | None, title: str, body: str = "") -> float:
    haystack = f"{title} {body}".lower()
    tokens = [incident.category, incident.title, area.name if area else "", "mysuru", "mysore"]
    matches = 0
    possible = 0
    for value in tokens:
        words = [word for word in re.split(r"\W+", str(value).lower()) if len(word) >= 4]
        if not words:
            continue
        possible += 1
        if any(word in haystack for word in words):
            matches += 1
    return min(1.0, matches / max(1, possible))


def incident_query(incident: Incident, area: Area | None) -> str:
    parts = [incident.category, area.name if area else None, "Mysuru"]
    return " ".join(part for part in parts if part)


class EvidenceProvider:
    name = "base"

    def fetch(self, incident: Incident, area: Area | None, client: httpx.Client) -> list[EvidenceSource]:
        raise NotImplementedError


class GDELTProvider(EvidenceProvider):
    name = "GDELT"

    def fetch(self, incident: Incident, area: Area | None, client: httpx.Client) -> list[EvidenceSource]:
        query = quote_plus(incident_query(incident, area))
        url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={query}&mode=artlist&format=json&maxrecords=10&sort=hybridrel"
        response = client.get(url)
        response.raise_for_status()
        data = response.json()
        articles = data.get("articles") if isinstance(data, dict) else []
        sources: list[EvidenceSource] = []
        for article in articles or []:
            article_url = article.get("url")
            title = article.get("title") or "Untitled report"
            if not article_url:
                continue
            publisher = article.get("sourceCommonName") or publisher_from_url(article_url)
            published_at = parse_datetime(article.get("seendate") or article.get("publishedAt"))
            rel = relevance_score(incident, area, title, article.get("description") or "")
            if rel < 0.25:
                continue
            official = is_official_source(publisher, article_url)
            sources.append(EvidenceSource(
                publisher_name=publisher,
                title=title,
                url=article_url,
                publication_time=published_at,
                provider=self.name,
                source_type="government" if official else "news",
                credibility_score=credibility_score(publisher, article_url),
                relevance_score=rel,
                is_official=official,
            ))
        return sources


class GoogleNewsRSSProvider(EvidenceProvider):
    name = "Google News RSS"

    def fetch(self, incident: Incident, area: Area | None, client: httpx.Client) -> list[EvidenceSource]:
        query = quote_plus(incident_query(incident, area))
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        response = client.get(url)
        response.raise_for_status()
        root = ElementTree.fromstring(response.text)
        sources: list[EvidenceSource] = []
        for item in root.findall("./channel/item")[:10]:
            title = item.findtext("title") or "Untitled report"
            article_url = item.findtext("link")
            if not article_url:
                continue
            source_node = item.find("source")
            publisher = source_node.text if source_node is not None and source_node.text else publisher_from_url(article_url)
            published_at = parse_datetime(item.findtext("pubDate"))
            rel = relevance_score(incident, area, title)
            if rel < 0.25:
                continue
            official = is_official_source(publisher, article_url)
            sources.append(EvidenceSource(
                publisher_name=publisher,
                title=title,
                url=article_url,
                publication_time=published_at,
                provider=self.name,
                source_type="government" if official else "rss",
                credibility_score=credibility_score(publisher, article_url),
                relevance_score=rel,
                is_official=official,
            ))
        return sources


def default_evidence_providers() -> list[EvidenceProvider]:
    return [GDELTProvider(), GoogleNewsRSSProvider()]