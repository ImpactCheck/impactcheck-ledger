from __future__ import annotations

import json

from app.db import get_conn, utc_now_iso
from app.models import DeploymentPlan


def _row_to_plan(row) -> DeploymentPlan:
    return DeploymentPlan(
        projectId=row["project_id"],
        status=row["status"],
        logs=json.loads(row["logs_json"]),
    )


def upsert_deployment(project_id: str, status: str, logs: list[str], poll_count: int = 0) -> DeploymentPlan:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO deployments (project_id, status, logs_json, poll_count, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id)
            DO UPDATE SET
                status = excluded.status,
                logs_json = excluded.logs_json,
                poll_count = excluded.poll_count,
                updated_at = excluded.updated_at
            """,
            (project_id, status, json.dumps(logs), poll_count, utc_now_iso()),
        )

    return get_deployment(project_id)


def get_deployment(project_id: str) -> DeploymentPlan | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM deployments WHERE project_id = ?", (project_id,)).fetchone()

    if row is None:
        return None

    return _row_to_plan(row)


def get_deployment_state(project_id: str) -> tuple[DeploymentPlan, int] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM deployments WHERE project_id = ?", (project_id,)).fetchone()

    if row is None:
        return None

    return _row_to_plan(row), int(row["poll_count"])


def update_deployment_state(project_id: str, status: str, logs: list[str], poll_count: int) -> DeploymentPlan:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE deployments
            SET status = ?, logs_json = ?, poll_count = ?, updated_at = ?
            WHERE project_id = ?
            """,
            (status, json.dumps(logs), poll_count, utc_now_iso(), project_id),
        )

    deployment = get_deployment(project_id)
    if deployment is None:
        raise RuntimeError("Failed to update deployment state")

    return deployment
