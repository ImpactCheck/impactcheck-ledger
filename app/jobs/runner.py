from __future__ import annotations

import asyncio
from collections.abc import Awaitable

from app.jobs.deterministic import build_extracted_activities
from app.jobs.gemini_extraction import _build_parts, extract_with_gemini
from app.jobs.mapping_pipeline import run_mapping_pipeline
from app.settings import get_settings
from app.storage import activities_repo, documents_repo, estimates_repo, jobs_repo, projects_repo


class JobRunner:
    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

    async def shutdown(self) -> None:
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def enqueue_extract(self, job_id: str, project_id: str) -> None:
        await self._enqueue(job_id, self._run_extract(job_id, project_id))

    async def enqueue_mapping(self, job_id: str, project_id: str) -> None:
        await self._enqueue(job_id, self._run_mapping(job_id, project_id))

    async def _enqueue(self, job_id: str, coroutine: Awaitable[None]) -> None:
        async with self._lock:
            task = asyncio.create_task(coroutine)
            self._tasks[job_id] = task
            task.add_done_callback(lambda _: self._tasks.pop(job_id, None))

    async def _run_extract(self, job_id: str, project_id: str) -> None:
        settings = get_settings()
        step_delay = settings.job_step_delay_seconds

        try:
            jobs_repo.update_job(
                job_id,
                status="running",
                progress=10,
                stage="reading_files",
                message="Loading project documents",
            )
            await asyncio.sleep(step_delay)

            project = projects_repo.get_project(project_id)
            if project is None:
                raise RuntimeError("Project not found")

            docs = documents_repo.list_documents(project_id)

            gemini_key = settings.gemini_api_key
            if gemini_key:
                stored_paths = [documents_repo.get_stored_path(doc.id) for doc in docs]
                jobs_repo.update_job(
                    job_id,
                    progress=30,
                    stage="extracting",
                    message=f"Sending {len(docs)} document(s) to Gemini for extraction",
                )
                await asyncio.sleep(step_delay)

                jobs_repo.update_job(
                    job_id,
                    progress=50,
                    stage="parsing",
                    message="Gemini processing documents…",
                )
                activities = await extract_with_gemini(gemini_key, project, docs, stored_paths)

                jobs_repo.update_job(
                    job_id,
                    progress=80,
                    stage="normalizing_queries",
                    message=f"Extracted {len(activities)} activities, normalizing…",
                )
                await asyncio.sleep(step_delay)
            else:
                jobs_repo.update_job(
                    job_id,
                    progress=40,
                    stage="extracting_activities",
                    message=f"No GEMINI_API_KEY — using deterministic extraction for {len(docs)} document(s)",
                )
                await asyncio.sleep(step_delay)
                activities = build_extracted_activities(project, docs)

            activities_repo.replace_activities(project_id, activities)

            jobs_repo.update_job(
                job_id,
                progress=90,
                stage="writing_activities",
                message="Persisting extracted activities",
            )
            await asyncio.sleep(step_delay)

            documents_repo.set_documents_ready(project_id, job_id)
            jobs_repo.update_job(
                job_id,
                status="succeeded",
                progress=100,
                stage="done",
                message=f"Extraction completed: {len(activities)} activities",
            )
        except Exception as exc:
            documents_repo.set_documents_error(project_id, job_id)
            jobs_repo.update_job(
                job_id,
                status="failed",
                progress=100,
                stage="failed",
                message=f"Extraction failed: {exc}",
            )

    async def _run_mapping(self, job_id: str, project_id: str) -> None:
        step_delay = get_settings().job_step_delay_seconds

        try:
            jobs_repo.update_job(
                job_id,
                status="running",
                progress=10,
                stage="loading_activities",
                message="Loading extracted activities",
            )
            await asyncio.sleep(step_delay)

            project = projects_repo.get_project(project_id)
            if project is None:
                raise RuntimeError("Project not found")

            activities = activities_repo.list_activities(project_id)
            if not activities:
                jobs_repo.update_job(
                    job_id,
                    status="succeeded",
                    progress=100,
                    stage="completed",
                    message="No activities to map",
                )
                return

            settings = get_settings()

            # Build document context parts for Gemini estimation fallbacks
            doc_parts: list[dict] | None = None
            if settings.gemini_api_key:
                docs = documents_repo.list_documents(project_id)
                stored_paths = [documents_repo.get_stored_path(doc.id) for doc in docs]
                parts = _build_parts(docs, stored_paths)
                doc_parts = parts if parts else None

            def progress_cb(progress: int, stage: str, message: str) -> None:
                jobs_repo.update_job(job_id, progress=progress, stage=stage, message=message)

            estimates = run_mapping_pipeline(
                project, activities,
                progress_cb=progress_cb,
                gemini_api_key=settings.gemini_api_key,
                doc_parts=doc_parts,
            )
            await asyncio.sleep(step_delay)

            estimates_repo.replace_estimates(project_id, estimates)
            jobs_repo.update_job(
                job_id,
                status="succeeded",
                progress=100,
                stage="completed",
                message=f"Mapping completed: {len(estimates)} estimate rows",
            )
        except Exception as exc:
            jobs_repo.update_job(
                job_id,
                status="failed",
                progress=100,
                stage="failed",
                message=f"Mapping failed: {exc}",
            )


_runner: JobRunner | None = None


def get_job_runner() -> JobRunner:
    global _runner
    if _runner is None:
        _runner = JobRunner()
    return _runner
