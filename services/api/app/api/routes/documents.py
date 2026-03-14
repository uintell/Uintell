from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_user
from app.repositories.admin import AdminRepository
from app.repositories.documents import DocumentRepository
from app.schemas.documents import (
    DocumentListResponse,
    DocumentResponse,
    PageAnswerRequest,
    PageAnswerResponse,
    SourceDetailResponse,
    SourceListResponse,
    SourceSummaryResponse,
    SupportingPassageResponse,
    UploadResponse,
)
from app.schemas.knowledge import (
    DocumentConnectionsResponse,
    DocumentDetailResponse,
    DocumentSectionResponse,
    RelatedDocumentResponse,
)
from app.services.container import ServiceContainer

router = APIRouter(prefix="/v1/documents", tags=["documents"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    query: str | None = None,
    source_type: str | None = None,
    source_name: str | None = None,
    source_types: list[str] | None = Query(default=None),
    document_kind: str | None = None,
    tag: str | None = None,
    sort: str = "updated_desc",
    limit: int = 100,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    documents = await DocumentRepository().list_documents(
        db,
        query=query,
        source_type=source_type,
        source_name=source_name,
        source_types=source_types,
        document_kind=document_kind,
        tag=tag,
        sort=sort,
        limit=limit,
    )
    return DocumentListResponse(
        documents=[_serialize_document(document) for document in documents]
    )


@router.get("/sources", response_model=SourceListResponse)
async def list_sources(
    query: str | None = None,
    source_type: str | None = None,
    limit: int = 60,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> SourceListResponse:
    sources = await DocumentRepository().list_sources(
        db,
        query=query,
        source_type=source_type,
        limit=limit,
    )
    return SourceListResponse(
        sources=[
            SourceSummaryResponse(
                source_type=item["source_type"],
                source_name=item["source_name"],
                document_count=item["document_count"],
                indexed_count=item["indexed_count"],
                latest_updated_at=item["latest_updated_at"],
                document_kinds=list(item["document_kinds"]),
            )
            for item in sources
        ]
    )


@router.get("/sources/{source_type}/{source_name}", response_model=SourceDetailResponse)
async def get_source_detail(
    source_type: str,
    source_name: str,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> SourceDetailResponse:
    repository = DocumentRepository()
    sources = await repository.list_sources(db, source_type=source_type, limit=500)
    source = next((item for item in sources if item["source_name"] == source_name), None)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    documents = await repository.list_documents(
        db,
        source_type=source_type,
        source_name=source_name,
        sort="updated_desc",
        limit=200,
    )
    return SourceDetailResponse(
        source_type=source["source_type"],
        source_name=source["source_name"],
        document_count=source["document_count"],
        indexed_count=source["indexed_count"],
        latest_updated_at=source["latest_updated_at"],
        document_kinds=list(source["document_kinds"]),
        documents=[_serialize_document(document) for document in documents],
    )


@router.get("/{document_id}/connections", response_model=DocumentConnectionsResponse)
async def get_document_connections(
    document_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentConnectionsResponse:
    document = await DocumentRepository().get_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return await _build_connections(db, document)


@router.post("/{document_id}/answer", response_model=PageAnswerResponse)
async def answer_about_document(
    document_id: UUID,
    payload: PageAnswerRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> PageAnswerResponse:
    try:
        answer = await container.answers.answer_document_question(
            db,
            document_id=document_id,
            question=payload.question,
            mode=payload.mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PageAnswerResponse(
        answer=answer.text,
        scope_used=answer.scope_used,
        citations=answer.citations,
        supporting_passages=[
            SupportingPassageResponse(
                label=passage.label,
                document_id=UUID(passage.document_id),
                document_slug=passage.document_slug,
                title=passage.title,
                section_title=passage.section_title,
                excerpt=passage.excerpt,
                source_type=passage.source_type,
                path_or_url=passage.path_or_url,
                score=passage.score,
            )
            for passage in answer.passages
        ],
        provider_name=answer.provider_name,
        model_name=answer.model_name,
    )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentDetailResponse:
    document = await DocumentRepository().get_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return await _build_detail(db, document)


@router.get("/slug/{slug}", response_model=DocumentDetailResponse)
async def get_document_by_slug(
    slug: str,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentDetailResponse:
    document = await DocumentRepository().get_document_by_slug(db, slug)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return await _build_detail(db, document)


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> UploadResponse:
    content = await file.read()
    if len(content) > container.settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
    stored = await container.storage.save_bytes(
        filename=file.filename or "upload.bin",
        content=content,
        content_type=file.content_type,
    )
    document = await container.ingestion.prepare_upload(
        db,
        title=file.filename or "Upload",
        storage_key=stored.uri,
        metadata={"content_type": file.content_type or "application/octet-stream"},
    )
    admin = AdminRepository()
    job = await admin.create_job(
        db,
        source_type="filesystem",
        source_name="local_uploads",
        target_path=stored.uri,
        submitted_by_user_id=user.id,
        metadata={"document_id": str(document.id), "storage_key": stored.uri},
    )
    await db.commit()
    if container.temporal is not None:
        await container.temporal.start_workflow(
            "FileIngestionWorkflow",
            str(job.id),
            id=f"file-ingest-{job.id}",
            task_queue=container.settings.temporal_task_queue,
        )
    else:
        asyncio.create_task(container.ingestion.process_job(job.id))
    return UploadResponse(document_id=document.id, job_id=job.id, storage_key=stored.uri)


async def _build_detail(db: AsyncSession, document) -> DocumentDetailResponse:
    repository = DocumentRepository()
    connections = await _build_connections(db, document)
    return DocumentDetailResponse(
        id=document.id,
        source_type=document.source_type,
        source_name=document.source_name,
        source_identifier=document.source_identifier,
        canonical_id=document.canonical_id,
        title=document.title,
        slug=document.slug,
        summary=document.summary,
        raw_content=document.raw_content,
        normalized_content=document.normalized_content,
        plain_text=document.plain_text,
        sections=[
            DocumentSectionResponse(
                title=section.get("title"),
                content=section.get("content", ""),
                anchor=section.get("anchor"),
            )
            for section in document.sections_json
        ],
        tags=list(document.tags_json or []),
        links_out=list(document.links_out_json or []),
        media_references=list(document.media_references_json or []),
        path_or_url=document.path_or_url,
        language=document.language,
        status=document.status,
        indexing_status=document.indexing_status,
        embedding_status=document.embedding_status,
        document_kind=document.document_kind,
        metadata=document.metadata_json,
        backlinks=connections.backlinks,
        related_documents=connections.related_documents,
        created_at=document.created_at,
        updated_at=document.updated_at,
        last_indexed_at=document.last_indexed_at,
    )


def _serialize_document(document) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        source_type=document.source_type,
        source_name=document.source_name,
        source_identifier=document.source_identifier,
        canonical_id=document.canonical_id,
        title=document.title,
        slug=document.slug,
        summary=document.summary,
        tags=list(document.tags_json or []),
        path_or_url=document.path_or_url,
        language=document.language,
        status=document.status,
        indexing_status=document.indexing_status,
        embedding_status=document.embedding_status,
        document_kind=document.document_kind,
        metadata=document.metadata_json,
        created_at=document.created_at,
        updated_at=document.updated_at,
        last_indexed_at=document.last_indexed_at,
    )


async def _build_connections(db: AsyncSession, document) -> DocumentConnectionsResponse:
    repository = DocumentRepository()
    backlinks = await repository.list_backlinks(db, document_id=document.id)
    related = await repository.list_related(db, document=document)
    return DocumentConnectionsResponse(
        backlinks=[
            RelatedDocumentResponse(
                id=item.id,
                title=item.title,
                slug=item.slug,
                source_type=item.source_type,
                summary=item.summary,
            )
            for item in backlinks
        ],
        related_documents=[
            RelatedDocumentResponse(
                id=item.id,
                title=item.title,
                slug=item.slug,
                source_type=item.source_type,
                summary=item.summary,
            )
            for item in related
        ],
    )
