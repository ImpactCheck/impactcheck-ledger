from __future__ import annotations

import csv
import io

from fastapi import APIRouter, HTTPException

from app.models import CsvResponse, ExtractedActivity
from app.storage import activities_repo, projects_repo


router = APIRouter(tags=["activities"])


def _assert_project_exists(project_id: str) -> None:
    if projects_repo.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/api/projects/{id}/activities", response_model=list[ExtractedActivity])
async def get_activities(id: str) -> list[ExtractedActivity]:
    _assert_project_exists(id)
    return activities_repo.list_activities(id)


@router.put("/api/projects/{id}/activities", response_model=list[ExtractedActivity])
async def update_activities(id: str, activities: list[ExtractedActivity]) -> list[ExtractedActivity]:
    _assert_project_exists(id)

    normalized = [activity.model_copy(update={"projectId": id}) for activity in activities]
    return activities_repo.replace_activities(id, normalized)


@router.post("/api/projects/{id}/export-csv", response_model=CsvResponse)
async def export_csv(id: str) -> CsvResponse:
    _assert_project_exists(id)
    activities = activities_repo.list_activities(id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "text",
        "unit_type",
        "region",
        "quantity",
        "unit",
        "amount",
        "currency",
        "sourceDocumentId",
        "note",
    ])
    for activity in activities:
        writer.writerow(
            [
                activity.id,
                activity.text,
                activity.unit_type,
                activity.region,
                activity.quantity,
                activity.unit,
                activity.amount,
                activity.currency,
                activity.sourceDocumentId,
                activity.note,
            ]
        )

    return CsvResponse(csvText=output.getvalue())
