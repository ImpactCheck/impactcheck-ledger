from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.jobs.deterministic import build_final_strategy_text, build_recommendations, build_report
from app.models import FinalizeStrategyRequest, FinalizeStrategyResponse, Recommendation
from app.storage import activities_repo, estimates_repo, projects_repo, recommendations_repo


router = APIRouter(tags=["recommendations"])


def _get_project_or_404(project_id: str):
    project = projects_repo.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/api/projects/{id}/recommendations", response_model=list[Recommendation])
async def generate_recommendations(id: str) -> list[Recommendation]:
    project = _get_project_or_404(id)

    activities = activities_repo.list_activities(id)
    estimates = estimates_repo.list_estimates(id)
    report = build_report(project, activities, estimates)

    recommendations = build_recommendations(project, report)
    return recommendations_repo.replace_recommendations(id, recommendations)


@router.post("/api/projects/{id}/strategy/finalize", response_model=FinalizeStrategyResponse)
async def finalize_strategy(id: str, payload: FinalizeStrategyRequest) -> FinalizeStrategyResponse:
    project = _get_project_or_404(id)

    selected = recommendations_repo.list_recommendations_by_ids(id, payload.recommendationIds)
    if not selected and not payload.recommendationIds:
        selected = recommendations_repo.list_recommendations(id)

    strategy_text = build_final_strategy_text(project, selected)
    recommendations_repo.save_strategy(id, strategy_text, [item.id for item in selected])

    return FinalizeStrategyResponse(strategyText=strategy_text)
