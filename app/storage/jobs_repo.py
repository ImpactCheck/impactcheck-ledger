from __future__ import annotations

from app.db import get_conn, next_prefixed_id, utc_now_iso
from app.models import JobStatus


def _row_to_job(row) -> JobStatus:
    return JobStatus(
        id=row["id"],
        type=row["type"],
        status=row["status"],
        progress=int(row["progress"]),
        stage=row["stage"],
        message=row["message"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


def create_job(project_id: str, job_type: str) -> JobStatus:
    now = utc_now_iso()

    with get_conn() as conn:
        job_id = next_prefixed_id(conn, "jobs", "job")
        conn.execute(
            """
            INSERT INTO jobs (id, project_id, type, status, progress, stage, message, created_at, updated_at)
            VALUES (?, ?, ?, 'queued', 0, 'queued', 'Job queued', ?, ?)
            """,
            (job_id, project_id, job_type, now, now),
        )
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()

    return _row_to_job(row)


def get_job(job_id: str) -> JobStatus | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()

    if row is None:
        return None

    return _row_to_job(row)


def update_job(
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    stage: str | None = None,
    message: str | None = None,
) -> JobStatus | None:
    fields: list[str] = []
    params: list[object] = []

    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if progress is not None:
        fields.append("progress = ?")
        params.append(progress)
    if stage is not None:
        fields.append("stage = ?")
        params.append(stage)
    if message is not None:
        fields.append("message = ?")
        params.append(message)

    fields.append("updated_at = ?")
    params.append(utc_now_iso())
    params.append(job_id)

    with get_conn() as conn:
        conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", tuple(params))
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()

    if row is None:
        return None

    return _row_to_job(row)
