from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from app.settings import get_settings


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    company_type TEXT NOT NULL,
    primary_region TEXT NOT NULL,
    comparison_regions TEXT NOT NULL DEFAULT '[]',
    baseline_kg REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    job_id TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL,
    stage TEXT,
    message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    text TEXT NOT NULL,
    unit_type TEXT,
    region TEXT,
    quantity REAL,
    unit TEXT,
    amount REAL,
    currency TEXT,
    source_document_id TEXT,
    note TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);

CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    region TEXT,
    matched_factor_id TEXT NOT NULL,
    matched_factor_name TEXT NOT NULL,
    matched_factor_source TEXT NOT NULL,
    matched_factor_year INTEGER,
    matched_factor_unit TEXT,
    confidence REAL NOT NULL,
    co2e_kg REAL NOT NULL,
    input_unit_type TEXT,
    input_quantity REAL,
    input_amount REAL,
    input_currency TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project_region ON estimates(project_id, region);

CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    expected_delta_kg REAL NOT NULL,
    constraints_json TEXT NOT NULL,
    strategy_draft_text TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_project_id ON recommendations(project_id);

CREATE TABLE IF NOT EXISTS strategies (
    project_id TEXT PRIMARY KEY,
    strategy_text TEXT NOT NULL,
    recommendation_ids_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS deployments (
    project_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    logs_json TEXT NOT NULL,
    poll_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
"""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def init_db() -> None:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    if settings.db_path.parent != Path("."):
        settings.db_path.parent.mkdir(parents=True, exist_ok=True)

    with get_conn() as conn:
        conn.executescript(SCHEMA_SQL)


@contextmanager
def get_conn() -> sqlite3.Connection:
    settings = get_settings()
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def next_prefixed_id(conn: sqlite3.Connection, table: str, prefix: str) -> str:
    # IDs are zero-padded so lexical max works for monotonic deterministic IDs.
    row = conn.execute(
        f"SELECT id FROM {table} WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
        (f"{prefix}_%",),
    ).fetchone()

    if row is None:
        next_number = 1
    else:
        current = str(row["id"]).split("_")[-1]
        next_number = int(current) + 1

    return f"{prefix}_{next_number:04d}"
