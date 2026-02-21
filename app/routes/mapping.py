from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.jobs.runner import get_job_runner
from app.models import ActivityEstimate, JobIdResponse
from app.storage import estimates_repo, jobs_repo, projects_repo


router = APIRouter(tags=["mapping"])


def _get_project_or_404(project_id: str):
    project = projects_repo.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/api/projects/{id}/map-emissions", response_model=JobIdResponse)
async def start_mapping(id: str) -> JobIdResponse:
    _get_project_or_404(id)

    job = jobs_repo.create_job(id, "mapping")
    runner = get_job_runner()
    await runner.enqueue_mapping(job.id, id)

    return JobIdResponse(jobId=job.id)


@router.get("/api/projects/{id}/estimates", response_model=list[ActivityEstimate])
async def get_estimates(id: str) -> list[ActivityEstimate]:
    project = _get_project_or_404(id)
    return estimates_repo.list_estimates(id, region=project.primaryRegion)
