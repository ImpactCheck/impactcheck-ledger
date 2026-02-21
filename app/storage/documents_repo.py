from __future__ import annotations

from pathlib import Path

from app.db import get_conn, next_prefixed_id, utc_now_iso
from app.models import Document


def _row_to_document(row) -> Document:
    return Document(
        id=row["id"],
        projectId=row["project_id"],
        filename=row["filename"],
        fileType=row["file_type"],
        status=row["status"],
        uploadedAt=row["uploaded_at"],
        jobId=row["job_id"],
    )


def next_document_id() -> str:
    with get_conn() as conn:
        return next_prefixed_id(conn, "documents", "doc")


def create_document(
    project_id: str,
    *,
    document_id: str,
    filename: str,
    stored_path: Path,
    file_type: str,
    status: str = "pending",
    job_id: str | None = None,
) -> Document:
    uploaded_at = utc_now_iso()

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO documents (id, project_id, filename, stored_path, file_type, status, uploaded_at, job_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                project_id,
                filename,
                str(stored_path),
                file_type,
                status,
                uploaded_at,
                job_id,
            ),
        )
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()

    return _row_to_document(row)


def list_documents(project_id: str) -> list[Document]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE project_id = ? ORDER BY uploaded_at ASC, id ASC",
            (project_id,),
        ).fetchall()

    return [_row_to_document(row) for row in rows]


def set_documents_processing(project_id: str, job_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE documents
            SET status = 'processing', job_id = ?
            WHERE project_id = ?
            """,
            (job_id, project_id),
        )


def set_documents_ready(project_id: str, job_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE documents
            SET status = 'ready', job_id = ?
            WHERE project_id = ?
            """,
            (job_id, project_id),
        )


def set_documents_error(project_id: str, job_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE documents
            SET status = 'error', job_id = ?
            WHERE project_id = ?
            """,
            (job_id, project_id),
        )
