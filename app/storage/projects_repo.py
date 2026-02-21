from __future__ import annotations

import hashlib
import json

from app.db import get_conn, next_prefixed_id, utc_now_iso
from app.models import CreateProjectRequest, Project


def _baseline_kg_seed(name: str, year: int, primary_region: str) -> float:
    raw = f"{name}|{year}|{primary_region}".encode("utf-8")
    value = int(hashlib.sha256(raw).hexdigest()[:12], 16)
    return float(900_000 + (value % 1_200_000))


def _row_to_project(row) -> Project:
    return Project(
        id=row["id"],
        name=row["name"],
        year=int(row["year"]),
        companyType=row["company_type"],
        primaryRegion=row["primary_region"],
        comparisonRegions=json.loads(row["comparison_regions"]) or None,
        baselineFootprintKgCO2e=float(row["baseline_kg"]) if row["baseline_kg"] is not None else None,
    )


def create_project(payload: CreateProjectRequest) -> Project:
    now = utc_now_iso()

    with get_conn() as conn:
        project_id = next_prefixed_id(conn, "projects", "prj")
        baseline = _baseline_kg_seed(payload.name, payload.year, payload.primaryRegion)

        conn.execute(
            """
            INSERT INTO projects (
                id, name, year, company_type, primary_region, comparison_regions,
                baseline_kg, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                payload.name,
                payload.year,
                payload.companyType,
                payload.primaryRegion,
                json.dumps(payload.comparisonRegions or []),
                baseline,
                now,
                now,
            ),
        )

        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

    return _row_to_project(row)


def get_project(project_id: str) -> Project | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

    if row is None:
        return None

    return _row_to_project(row)
