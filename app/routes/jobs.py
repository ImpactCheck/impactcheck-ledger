from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import JobStatus
from app.storage import jobs_repo


router = APIRouter(tags=["jobs"])


@router.get("/api/jobs/{jobId}", response_model=JobStatus)
async def get_job(jobId: str) -> JobStatus:
    job = jobs_repo.get_job(jobId)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
