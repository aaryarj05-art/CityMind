"""Optional BigQuery analytics exports for historical reporting."""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_ID = "citymind-apac"
DEFAULT_DATASET = "citymind_analytics"
DEFAULT_LOCATION = "asia-south1"
ENABLED_VALUES = {"1", "true", "yes", "on"}

TABLE_SCHEMAS: dict[str, list[tuple[str, str]]] = {
    "incident_events": [
        ("event_id", "STRING"), ("incident_id", "STRING"), ("category", "STRING"),
        ("severity", "STRING"), ("area", "STRING"), ("status", "STRING"),
        ("priority_score", "FLOAT"), ("source", "STRING"), ("is_simulated", "BOOL"),
        ("created_at", "TIMESTAMP"), ("exported_at", "TIMESTAMP"),
    ],
    "dispatch_events": [
        ("event_id", "STRING"), ("dispatch_id", "STRING"), ("incident_id", "STRING"),
        ("resource_id", "STRING"), ("resource_type", "STRING"), ("status", "STRING"),
        ("eta_minutes", "FLOAT"), ("is_simulated", "BOOL"), ("created_at", "TIMESTAMP"),
        ("exported_at", "TIMESTAMP"),
    ],
    "ai_decision_events": [
        ("event_id", "STRING"), ("decision_id", "STRING"), ("user_id", "STRING"),
        ("role", "STRING"), ("prompt", "STRING"), ("response_summary", "STRING"),
        ("agents_used", "STRING"), ("tools_used", "STRING"), ("assurance_level", "STRING"),
        ("grounded", "BOOL"), ("blocked", "BOOL"), ("threat_level", "STRING"),
        ("model_version", "STRING"), ("created_at", "TIMESTAMP"), ("exported_at", "TIMESTAMP"),
    ],
    "risk_snapshots": [
        ("snapshot_id", "STRING"), ("area", "STRING"), ("ward", "STRING"),
        ("risk_score", "FLOAT"), ("risk_level", "STRING"), ("primary_driver", "STRING"),
        ("active_incidents", "INT64"), ("is_simulated", "BOOL"), ("calculated_at", "TIMESTAMP"),
        ("exported_at", "TIMESTAMP"),
    ],
}
EXPECTED_TABLES = tuple(TABLE_SCHEMAS)


def bigquery_enabled() -> bool:
    return os.getenv("CITYMIND_BIGQUERY_ENABLED", "").strip().lower() in ENABLED_VALUES


def project_id() -> str:
    return os.getenv("CITYMIND_GCP_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or DEFAULT_PROJECT_ID


def dataset_id() -> str:
    return os.getenv("CITYMIND_BIGQUERY_DATASET") or DEFAULT_DATASET


def _bigquery_module():
    from google.cloud import bigquery

    return bigquery


@lru_cache(maxsize=1)
def get_bigquery_client():
    if not bigquery_enabled():
        return None
    try:
        return _bigquery_module().Client(project=project_id())
    except Exception:
        logger.exception("BigQuery client initialization failed")
        return None


def reset_bigquery_client_cache() -> None:
    get_bigquery_client.cache_clear()


def _utc(value: datetime | None = None) -> datetime:
    value = value or datetime.now(timezone.utc)
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _timestamp(value: Any = None) -> str:
    return _utc(value if isinstance(value, datetime) else None).isoformat()


def _get(item: Any, key: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _area_name(area: Any, fallback: str | None = None) -> str | None:
    if isinstance(area, dict):
        return area.get("name") or area.get("area_name") or fallback
    if isinstance(area, str):
        return area
    return getattr(area, "name", fallback)


def ensure_dataset_exists() -> bool:
    if not bigquery_enabled():
        return False
    client = get_bigquery_client()
    if client is None:
        return False
    try:
        bigquery = _bigquery_module()
        dataset_ref = bigquery.Dataset(f"{project_id()}.{dataset_id()}")
        dataset_ref.location = DEFAULT_LOCATION
        client.create_dataset(dataset_ref, exists_ok=True)
        for table_name, schema in TABLE_SCHEMAS.items():
            table = bigquery.Table(
                f"{project_id()}.{dataset_id()}.{table_name}",
                schema=[bigquery.SchemaField(name, field_type, mode="NULLABLE") for name, field_type in schema],
            )
            client.create_table(table, exists_ok=True)
        return True
    except Exception:
        logger.exception("BigQuery dataset/table bootstrap failed")
        return False


def bigquery_status() -> dict[str, Any]:
    enabled = bigquery_enabled()
    base = {
        "enabled": enabled,
        "project_id": project_id(),
        "dataset": dataset_id(),
        "tables_expected": list(EXPECTED_TABLES),
    }
    if not enabled:
        return {**base, "status": "disabled", "note": "BigQuery exports are disabled; SQLite remains the primary operational store."}
    client = get_bigquery_client()
    if client is None:
        return {**base, "status": "error", "note": "BigQuery is enabled but the client could not initialize. Check ADC/service account permissions."}
    return {**base, "status": "configured", "note": "BigQuery analytics export is configured for best-effort historical reporting."}


def safe_insert_rows(table_name: str, rows: list[dict[str, Any]]) -> bool:
    if not bigquery_enabled() or not rows:
        return False
    if table_name not in TABLE_SCHEMAS:
        logger.warning("Skipping BigQuery export for unknown table %s", table_name)
        return False
    client = get_bigquery_client()
    if client is None:
        return False
    try:
        ensure_dataset_exists()
        errors = client.insert_rows_json(f"{project_id()}.{dataset_id()}.{table_name}", rows)
        if errors:
            logger.warning("BigQuery insert errors for %s: %s", table_name, errors)
            return False
        return True
    except Exception:
        logger.exception("BigQuery export failed for %s", table_name)
        return False


def export_incident_event(incident: Any, *, area: Any = None, priority_score: float | None = None, source: str = "api") -> bool:
    row = {
        "event_id": f"INC-{uuid.uuid4().hex.upper()}",
        "incident_id": str(_get(incident, "id", "")),
        "category": _get(incident, "category"),
        "severity": _get(incident, "severity"),
        "area": _area_name(area),
        "status": _get(incident, "status"),
        "priority_score": priority_score,
        "source": source,
        "is_simulated": True,
        "created_at": _timestamp(_get(incident, "reported_at")),
        "exported_at": _timestamp(),
    }
    return safe_insert_rows("incident_events", [row])


def export_dispatch_event(dispatch: Any, *, source: str = "api") -> bool:
    assignments = _get(dispatch, "assignments", []) or [None]
    rows = []
    for assignment in assignments:
        rows.append({
            "event_id": f"DSP-{uuid.uuid4().hex.upper()}",
            "dispatch_id": str(_get(dispatch, "id", "")),
            "incident_id": str(_get(dispatch, "incident_id", "")),
            "resource_id": str(_get(assignment, "resource_id", "")) if assignment else None,
            "resource_type": _get(assignment, "role") if assignment else None,
            "status": _get(dispatch, "status"),
            "eta_minutes": _get(assignment, "estimated_arrival_minutes", _get(dispatch, "estimated_arrival_minutes")) if assignment else _get(dispatch, "estimated_arrival_minutes"),
            "is_simulated": True,
            "created_at": _timestamp(_get(dispatch, "created_at")),
            "exported_at": _timestamp(),
        })
    return safe_insert_rows("dispatch_events", rows)


def export_ai_decision_event(event: Any) -> bool:
    row = {
        "event_id": _get(event, "event_id") or f"AID-{uuid.uuid4().hex.upper()}",
        "decision_id": _get(event, "decision_id") or _get(event, "event_id"),
        "user_id": str(_get(event, "user_id", "")) if _get(event, "user_id") is not None else None,
        "role": _get(event, "role"),
        "prompt": _get(event, "prompt_excerpt"),
        "response_summary": _get(event, "action"),
        "agents_used": _get(event, "agent_chain_json") or "[]",
        "tools_used": _get(event, "tools_used_json") or "[]",
        "assurance_level": _get(event, "assurance_level"),
        "grounded": _get(event, "grounded"),
        "blocked": _get(event, "blocked"),
        "threat_level": _get(event, "threat_level"),
        "model_version": _get(event, "model_version"),
        "created_at": _timestamp(_get(event, "created_at")),
        "exported_at": _timestamp(),
    }
    return safe_insert_rows("ai_decision_events", [row])


def export_audit_event(event: Any) -> bool:
    if _get(event, "event_type") == "ai_response_decision":
        return export_ai_decision_event(event)
    row = {
        "event_id": _get(event, "event_id") or f"AUD-{uuid.uuid4().hex.upper()}",
        "decision_id": _get(event, "decision_id") or _get(event, "event_id"),
        "user_id": str(_get(event, "user_id", "")) if _get(event, "user_id") is not None else None,
        "role": _get(event, "role"),
        "prompt": _get(event, "prompt_excerpt"),
        "response_summary": _get(event, "action"),
        "agents_used": _get(event, "agent_chain_json") or "[]",
        "tools_used": _get(event, "tools_used_json") or "[]",
        "assurance_level": _get(event, "assurance_level"),
        "grounded": _get(event, "grounded"),
        "blocked": _get(event, "blocked"),
        "threat_level": _get(event, "threat_level"),
        "model_version": _get(event, "model_version"),
        "created_at": _timestamp(_get(event, "created_at")),
        "exported_at": _timestamp(),
    }
    return safe_insert_rows("ai_decision_events", [row])


def export_risk_snapshot(area_risks: list[dict[str, Any]], *, calculated_at: datetime | None = None) -> bool:
    exported_at = _timestamp()
    rows = []
    for risk in area_risks:
        top_factors = risk.get("top_contributing_factors") or []
        primary_driver = top_factors[0].get("factor") if top_factors else None
        rows.append({
            "snapshot_id": f"RSK-{uuid.uuid4().hex.upper()}",
            "area": risk.get("area_name"),
            "ward": risk.get("ward_number"),
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
            "primary_driver": primary_driver,
            "active_incidents": risk.get("active_incidents", 0),
            "is_simulated": True,
            "calculated_at": _timestamp(calculated_at or risk.get("last_calculated")),
            "exported_at": exported_at,
        })
    return safe_insert_rows("risk_snapshots", rows)
