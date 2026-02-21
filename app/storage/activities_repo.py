from __future__ import annotations

from app.db import get_conn
from app.models import ExtractedActivity


def _row_to_activity(row) -> ExtractedActivity:
    return ExtractedActivity(
        id=row["id"],
        projectId=row["project_id"],
        text=row["text"],
        search_query=row["search_query"] if "search_query" in row.keys() else None,
        unit_type=row["unit_type"],
        region=row["region"],
        quantity=float(row["quantity"]) if row["quantity"] is not None else None,
        unit=row["unit"],
        amount=float(row["amount"]) if row["amount"] is not None else None,
        currency=row["currency"],
        sourceDocumentId=row["source_document_id"],
        note=row["note"],
    )


def list_activities(project_id: str) -> list[ExtractedActivity]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM activities WHERE project_id = ? ORDER BY id ASC",
            (project_id,),
        ).fetchall()

    return [_row_to_activity(row) for row in rows]


def replace_activities(project_id: str, activities: list[ExtractedActivity]) -> list[ExtractedActivity]:
    with get_conn() as conn:
        conn.execute("DELETE FROM activities WHERE project_id = ?", (project_id,))

        conn.executemany(
            """
            INSERT INTO activities (
                id, project_id, text, search_query, unit_type, region, quantity, unit, amount,
                currency, source_document_id, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    activity.id,
                    project_id,
                    activity.text,
                    activity.search_query,
                    activity.unit_type,
                    activity.region,
                    activity.quantity,
                    activity.unit,
                    activity.amount,
                    activity.currency,
                    activity.sourceDocumentId,
                    activity.note,
                )
                for activity in activities
            ],
        )

    return list_activities(project_id)
