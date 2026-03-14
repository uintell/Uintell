from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_admin
from app.repositories.admin import AdminRepository
from app.repositories.documents import DocumentRepository
from app.schemas.documents import IngestSourceRequest, IngestionJobResponse
from app.services.container import ServiceContainer

router = APIRouter(prefix="/v1/imports", tags=["imports"])


@router.get("/jobs", response_model=list[IngestionJobResponse])
async def list_jobs(
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[IngestionJobResponse]:
    jobs = await AdminRepository().list_jobs(db)
    return [IngestionJobResponse.model_validate(job, from_attributes=True) for job in jobs]


@router.get("/stats")
async def stats(
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    repository = DocumentRepository()
    counts = await repository.count_by_source(db)
    indexing = await repository.count_by_indexing_status(db)
    return {"documents_by_source": counts, "documents_by_indexing_status": indexing}


@router.post("/ingest", response_model=IngestionJobResponse)
async def ingest_source(
    payload: IngestSourceRequest,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> IngestionJobResponse:
    profile = None
    if payload.profile_id:
        profile = await container.app_settings.get_source_profile(db, payload.profile_id)
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source profile not found")

    source_type = payload.source_type or (str(profile.get("source_type")) if profile else None)
    if source_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_type is required")

    target_path = payload.target_path or (str(profile.get("target_path")) if profile and profile.get("target_path") else None)
    if target_path is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_path is required")

    source_name = payload.source_name or (str(profile.get("source_name")) if profile and profile.get("source_name") else None)
    if source_name is None:
        source_name = {
            "arch_wiki": "arch_linux_wiki",
            "wikipedia": "english_wikipedia",
            "filesystem": "local_filesystem",
        }.get(source_type, "knowledge_source")

    effective_limit = payload.limit or int(profile.get("limit", 0) or 0) if profile else payload.limit
    profile_tags = profile.get("tags", []) if profile else []
    tags = _merge_tags(profile_tags, payload.tags)
    document_kind = payload.document_kind or (str(profile.get("document_kind")) if profile and profile.get("document_kind") else None)
    extra_metadata = dict(profile.get("metadata") or {}) if profile else {}
    extra_metadata.update(payload.metadata)

    override_source_type = None
    if source_type == "filesystem" and document_kind in {"book", "note"}:
        override_source_type = document_kind

    admin = AdminRepository()
    job = await admin.create_job(
        db,
        source_type=source_type,
        source_name=source_name,
        target_path=target_path,
        submitted_by_user_id=user.id,
        metadata={
            "limit": effective_limit,
            "profile_id": payload.profile_id or (profile.get("id") if profile else None),
            "document_overrides": {
                "source_type": override_source_type,
                "source_name": source_name,
                "document_kind": document_kind,
                "tags": tags,
                "metadata": extra_metadata,
                "source_profile_id": payload.profile_id or (profile.get("id") if profile else None),
            },
        },
    )
    await db.commit()

    if container.temporal is not None:
        workflow = {
            "arch_wiki": "ArchWikiIngestionWorkflow",
            "wikipedia": "WikipediaIngestionWorkflow",
            "filesystem": "FilesystemIngestionWorkflow",
        }[source_type]
        handle = await container.temporal.start_workflow(
            workflow,
            str(job.id),
            id=f"{source_type}-ingest-{job.id}",
            task_queue=container.settings.temporal_task_queue,
        )
        async with container.session_factory() as inner_db:
            fresh_job = await admin.get_job(inner_db, job.id)
            if fresh_job is not None:
                await admin.update_job(inner_db, job=fresh_job, workflow_id=handle.id)
                await inner_db.commit()
    else:
        asyncio.create_task(container.ingestion.process_job(job.id))

    return IngestionJobResponse.model_validate(job, from_attributes=True)


def _merge_tags(profile_tags: object, request_tags: list[str]) -> list[str]:
    merged: list[str] = []
    if isinstance(profile_tags, list):
        for value in profile_tags:
            if isinstance(value, str) and value.strip() and value.strip() not in merged:
                merged.append(value.strip())
    for value in request_tags:
        normalized = value.strip()
        if normalized and normalized not in merged:
            merged.append(normalized)
    return merged
