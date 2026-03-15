from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentSectionResponse(BaseModel):
    title: str | None
    content: str
    anchor: str | None = None


class RelatedDocumentResponse(BaseModel):
    id: UUID
    title: str
    slug: str | None
    source_type: str
    source_name: str
    summary: str | None = None
    relation_kind: str | None = None
    relation_reason: str | None = None


class DocumentDetailResponse(BaseModel):
    id: UUID
    source_type: str
    source_name: str
    source_identifier: str | None
    canonical_id: str
    title: str
    slug: str | None
    summary: str | None
    raw_content: str | None
    normalized_content: str | None
    plain_text: str | None
    sections: list[DocumentSectionResponse]
    tags: list[str]
    links_out: list[str]
    media_references: list[str]
    path_or_url: str | None
    language: str
    status: str
    indexing_status: str
    embedding_status: str
    document_kind: str
    metadata: dict[str, Any]
    backlinks: list[RelatedDocumentResponse]
    related_documents: list[RelatedDocumentResponse]
    created_at: datetime
    updated_at: datetime
    last_indexed_at: datetime | None


class DocumentConnectionsResponse(BaseModel):
    backlinks: list[RelatedDocumentResponse]
    related_documents: list[RelatedDocumentResponse]


class NoteCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content_markdown: str = Field(default="", max_length=200_000)
    tags: list[str] = Field(default_factory=list)
    linked_document_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class NoteResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    content_markdown: str
    content_html: str | None
    plain_text: str | None
    tags: list[str]
    linked_document_id: UUID | None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CollectionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CollectionItemCreateRequest(BaseModel):
    document_id: UUID | None = None
    note_id: UUID | None = None
    sort_order: int = 0


class CollectionItemResponse(BaseModel):
    id: UUID
    document_id: UUID | None
    note_id: UUID | None
    sort_order: int
    created_at: datetime


class CollectionResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    description: str | None
    metadata: dict[str, Any]
    items: list[CollectionItemResponse]
    created_at: datetime
    updated_at: datetime


class SearchIndexStateResponse(BaseModel):
    key: str
    engine: str
    status: str
    indexed_count: int
    last_cursor: str | None
    last_error: str | None
    metadata: dict[str, Any]
    updated_at: datetime
