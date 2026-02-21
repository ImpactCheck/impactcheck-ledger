from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.jobs.runner import get_job_runner
from app.models import Document, JobIdResponse
from app.settings import get_settings
from app.storage import documents_repo, jobs_repo, projects_repo


router = APIRouter(tags=["documents"])


def _assert_project_exists(project_id: str) -> None:
    if projects_repo.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/api/projects/{id}/documents", response_model=Document)
async def upload_document(id: str, file: UploadFile = File(...)) -> Document:
    _assert_project_exists(id)

    filename = Path(file.filename or "upload.bin").name
    file_type = Path(filename).suffix.lstrip(".").lower() or "unknown"

    document_id = documents_repo.next_document_id()
    project_upload_dir = get_settings().uploads_dir / id
    project_upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = project_upload_dir / f"{document_id}_{filename}"

    contents = await file.read()
    stored_path.write_bytes(contents)

    return documents_repo.create_document(
        id,
        document_id=document_id,
        filename=filename,
        stored_path=stored_path,
        file_type=file_type,
        status="pending",
    )


@router.get("/api/projects/{id}/documents", response_model=list[Document])
async def list_documents(id: str) -> list[Document]:
    _assert_project_exists(id)
    return documents_repo.list_documents(id)


@router.post("/api/projects/{id}/extract", response_model=JobIdResponse)
async def start_extract(id: str) -> JobIdResponse:
    _assert_project_exists(id)

    job = jobs_repo.create_job(id, "extract")
    documents_repo.set_documents_processing(id, job.id)

    runner = get_job_runner()
    await runner.enqueue_extract(job.id, id)

    return JobIdResponse(jobId=job.id)
