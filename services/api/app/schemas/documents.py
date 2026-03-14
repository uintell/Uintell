from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: UUID
    source_type: str
    source_name: str
    source_identifier: str | None = None
    canonical_id: str
    title: str
    slug: str | None = None
    summary: str | None = None
    tags: list[str]
    path_or_url: str | None
    language: str
    status: str
    indexing_status: str | None = None
    embedding_status: str | None = None
    document_kind: str | None = None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_indexed_at: datetime | None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class SourceSummaryResponse(BaseModel):
    source_type: str
    source_name: str
    document_count: int
    indexed_count: int
    latest_updated_at: datetime | None
    document_kinds: list[str]


class SourceListResponse(BaseModel):
    sources: list[SourceSummaryResponse]


class SourceDetailResponse(BaseModel):
    source_type: str
    source_name: str
    document_count: int
    indexed_count: int
    latest_updated_at: datetime | None
    document_kinds: list[str]
    documents: list[DocumentResponse]


class IngestSourceRequest(BaseModel):
    profile_id: str | None = None
    source_type: str | None = None
    source_name: str | None = None
    target_path: str | None = None
    document_kind: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=0, ge=0)


class UploadResponse(BaseModel):
    document_id: UUID
    job_id: UUID
    storage_key: str


class IngestionJobResponse(BaseModel):
    id: UUID
    workflow_id: str | None
    source_type: str
    source_name: str
    target_path: str | None
    status: str
    progress: dict[str, Any]
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class PageAnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4_000)
    mode: str = "hybrid"


class SupportingPassageResponse(BaseModel):
    label: str
    document_id: UUID
    document_slug: str | None = None
    title: str
    section_title: str | None = None
    excerpt: str
    source_type: str
    path_or_url: str | None = None
    score: float


class PageAnswerResponse(BaseModel):
    answer: str
    scope_used: str
    citations: list[dict[str, str]]
    supporting_passages: list[SupportingPassageResponse]
    provider_name: str
    model_name: str
