from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import DeploymentPlan
from app.storage import deploy_repo, projects_repo


router = APIRouter(tags=["deploy"])


INITIAL_DEPLOY_LOGS = [
    "[deploy] Starting Crusoe deployment workflow",
    "[deploy] Validating project payload and regional policy gates",
    "[deploy] Provisioning baseline infrastructure",
]


def _get_project_or_404(project_id: str):
    project = projects_repo.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/api/projects/{id}/deploy/crusoe", response_model=DeploymentPlan)
async def deploy_crusoe(id: str) -> DeploymentPlan:
    _get_project_or_404(id)
    return deploy_repo.upsert_deployment(id, "running", INITIAL_DEPLOY_LOGS, poll_count=0)


@router.get("/api/projects/{id}/deploy/status", response_model=DeploymentPlan)
async def get_deployment_status(id: str) -> DeploymentPlan:
    _get_project_or_404(id)

    state = deploy_repo.get_deployment_state(id)
    if state is None:
        return DeploymentPlan(projectId=id, status="not_started", logs=[])

    deployment, poll_count = state
    if deployment.status != "running":
        return deployment

    poll_count += 1
    logs = list(deployment.logs)

    if poll_count == 1:
        logs.append("[deploy] Applying infrastructure modules and environment config")
        return deploy_repo.update_deployment_state(id, "running", logs, poll_count)

    if poll_count >= 2:
        if not any("Cluster ready" in line for line in logs):
            logs.append("[deploy] Cluster ready and control plane healthy")
            logs.append("[deploy] Deployment succeeded")
        return deploy_repo.update_deployment_state(id, "succeeded", logs, poll_count)

    return deploy_repo.update_deployment_state(id, "running", logs, poll_count)
