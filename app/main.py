from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.jobs.runner import get_job_runner
from app.routes import activities, deploy, documents, jobs, mapping, projects, recommendations, reports
from app.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    runner = get_job_runner()
    yield
    await runner.shutdown()


settings = get_settings()
app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(activities.router)
app.include_router(mapping.router)
app.include_router(reports.router)
app.include_router(recommendations.router)
app.include_router(deploy.router)
app.include_router(jobs.router)


@app.get("/healthz")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
