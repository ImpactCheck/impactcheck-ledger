from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import CreateProjectRequest, Project
from app.storage import projects_repo


router = APIRouter(tags=["projects"])


@router.post("/api/projects", response_model=Project)
async def create_project(payload: CreateProjectRequest) -> Project:
    return projects_repo.create_project(payload)


@router.get("/api/projects/{id}", response_model=Project)
async def get_project(id: str) -> Project:
    project = projects_repo.get_project(id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
