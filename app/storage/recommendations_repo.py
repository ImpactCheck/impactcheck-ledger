from __future__ import annotations

import json

from app.db import get_conn, utc_now_iso
from app.models import Recommendation


def _row_to_recommendation(row) -> Recommendation:
    constraints = json.loads(row["constraints_json"]) if row["constraints_json"] else []
    return Recommendation(
        id=row["id"],
        projectId=row["project_id"],
        title=row["title"],
        summary=row["summary"],
        expectedDeltaKg=float(row["expected_delta_kg"]),
        constraints=constraints or None,
        strategyDraftText=row["strategy_draft_text"],
    )


def replace_recommendations(project_id: str, recommendations: list[Recommendation]) -> list[Recommendation]:
    with get_conn() as conn:
        conn.execute("DELETE FROM recommendations WHERE project_id = ?", (project_id,))
        conn.executemany(
            """
            INSERT INTO recommendations (
                id, project_id, title, summary, expected_delta_kg,
                constraints_json, strategy_draft_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    recommendation.id,
                    project_id,
                    recommendation.title,
                    recommendation.summary,
                    recommendation.expectedDeltaKg,
                    json.dumps(recommendation.constraints or []),
                    recommendation.strategyDraftText,
                )
                for recommendation in recommendations
            ],
        )

    return list_recommendations(project_id)


def list_recommendations(project_id: str) -> list[Recommendation]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM recommendations WHERE project_id = ? ORDER BY id ASC",
            (project_id,),
        ).fetchall()

    return [_row_to_recommendation(row) for row in rows]


def list_recommendations_by_ids(project_id: str, recommendation_ids: list[str]) -> list[Recommendation]:
    if not recommendation_ids:
        return []

    placeholders = ",".join(["?" for _ in recommendation_ids])
    query = (
        "SELECT * FROM recommendations "
        f"WHERE project_id = ? AND id IN ({placeholders}) ORDER BY id ASC"
    )

    with get_conn() as conn:
        rows = conn.execute(query, [project_id, *recommendation_ids]).fetchall()

    return [_row_to_recommendation(row) for row in rows]


def save_strategy(project_id: str, strategy_text: str, recommendation_ids: list[str]) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO strategies (project_id, strategy_text, recommendation_ids_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id)
            DO UPDATE SET
                strategy_text = excluded.strategy_text,
                recommendation_ids_json = excluded.recommendation_ids_json,
                updated_at = excluded.updated_at
            """,
            (project_id, strategy_text, json.dumps(recommendation_ids), utc_now_iso()),
        )
