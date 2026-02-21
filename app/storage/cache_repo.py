"""
Emission factor cache: get/set by normalized key. TTL 7 days default.
"""
from __future__ import annotations

from datetime import timedelta, timezone
from datetime import datetime as dt

from app.db import get_conn, utc_now_iso


def normalize_search_query(query: str) -> str:
    """Lowercase, strip, sort words alphabetically."""
    if not query or not isinstance(query, str):
        return ""
    words = query.lower().strip().split()
    return " ".join(sorted(words))


def build_cache_key(
    search_query: str,
    region: str | None,
    unit_type: str | None,
    quantity: float | None,
    unit: str | None,
) -> str:
    return "|".join([
        normalize_search_query(search_query),
        region or "GLOBAL",
        unit_type or "ANY",
        str(quantity if quantity is not None else ""),
        (unit or "").strip(),
    ])


def get_cached(cache_key: str) -> dict | None:
    """
    SELECT from emission_factor_cache where cache_key and expires_at > now.
    Return one row as dict (keys: activity_id, factor_name, factor_source, ...) or None.
    """
    now = utc_now_iso()
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT cache_key, activity_id, factor_name, factor_source, factor_year,
                   factor_region, factor_unit, factor_unit_type, co2e_per_unit, co2e_kg,
                   quantity, unit, confidence, created_at, expires_at
            FROM emission_factor_cache
            WHERE cache_key = ? AND expires_at > ?
            """,
            (cache_key, now),
        ).fetchone()
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def set_cached(
    cache_key: str,
    activity_id: str,
    factor_name: str,
    factor_source: str,
    factor_year: int | None,
    factor_region: str | None,
    factor_unit: str | None,
    factor_unit_type: str | None,
    co2e_per_unit: float | None,
    co2e_kg: float,
    quantity: float | None,
    unit: str | None,
    confidence: str,
    ttl_days: int = 7,
) -> None:
    """INSERT or REPLACE with created_at, expires_at = created_at + ttl_days."""
    now = utc_now_iso()
    expires = (dt.now(timezone.utc) + timedelta(days=ttl_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO emission_factor_cache (
                cache_key, activity_id, factor_name, factor_source, factor_year,
                factor_region, factor_unit, factor_unit_type, co2e_per_unit, co2e_kg,
                quantity, unit, confidence, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cache_key,
                activity_id,
                factor_name,
                factor_source,
                factor_year,
                factor_region,
                factor_unit,
                factor_unit_type,
                co2e_per_unit,
                co2e_kg,
                quantity,
                unit,
                confidence,
                now,
                expires,
            ),
        )
