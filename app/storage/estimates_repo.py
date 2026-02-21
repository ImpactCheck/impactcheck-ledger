from __future__ import annotations

from app.db import get_conn
from app.models import ActivityEstimate, EstimateInputUsed, MatchedFactor


def _row_to_estimate(row) -> ActivityEstimate:
    return ActivityEstimate(
        activityId=row["activity_id"],
        region=row["region"],
        matchedFactor=MatchedFactor(
            id=row["matched_factor_id"],
            name=row["matched_factor_name"],
            source=row["matched_factor_source"],
            year=row["matched_factor_year"],
            unit=row["matched_factor_unit"],
        ),
        confidence=float(row["confidence"]),
        co2eKg=float(row["co2e_kg"]),
        inputUsed=EstimateInputUsed(
            unit_type=row["input_unit_type"],
            quantity=float(row["input_quantity"]) if row["input_quantity"] is not None else None,
            amount=float(row["input_amount"]) if row["input_amount"] is not None else None,
            currency=row["input_currency"],
        ),
    )


def replace_estimates(project_id: str, estimates: list[ActivityEstimate]) -> list[ActivityEstimate]:
    with get_conn() as conn:
        conn.execute("DELETE FROM estimates WHERE project_id = ?", (project_id,))
        conn.executemany(
            """
            INSERT INTO estimates (
                project_id, activity_id, region, matched_factor_id, matched_factor_name,
                matched_factor_source, matched_factor_year, matched_factor_unit,
                confidence, co2e_kg, input_unit_type, input_quantity, input_amount, input_currency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    project_id,
                    estimate.activityId,
                    estimate.region,
                    estimate.matchedFactor.id,
                    estimate.matchedFactor.name,
                    estimate.matchedFactor.source,
                    estimate.matchedFactor.year,
                    estimate.matchedFactor.unit,
                    estimate.confidence,
                    estimate.co2eKg,
                    estimate.inputUsed.unit_type,
                    estimate.inputUsed.quantity,
                    estimate.inputUsed.amount,
                    estimate.inputUsed.currency,
                )
                for estimate in estimates
            ],
        )

    return list_estimates(project_id)


def list_estimates(project_id: str, region: str | None = None) -> list[ActivityEstimate]:
    query = "SELECT * FROM estimates WHERE project_id = ?"
    params: tuple[object, ...] = (project_id,)

    if region is not None:
        query += " AND region = ?"
        params = (project_id, region)

    query += " ORDER BY co2e_kg DESC, activity_id ASC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    return [_row_to_estimate(row) for row in rows]
