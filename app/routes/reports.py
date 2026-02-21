from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.jobs.deterministic import build_report
from app.models import Report
from app.storage import activities_repo, estimates_repo, projects_repo


router = APIRouter(tags=["reports"])


@router.get("/api/projects/{id}/report", response_model=Report)
async def get_report(id: str) -> Report:
    project = projects_repo.get_project(id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    activities = activities_repo.list_activities(id)
    estimates = estimates_repo.list_estimates(id)
    return build_report(project, activities, estimates)
