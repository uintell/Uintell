from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Citation(BaseModel):
    label: str
    title: str
    section_title: str
    source_type: str
    document_slug: str = ""
    path_or_url: str = ""


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: str
    citations: dict[str, Any]
    provider_name: str | None
    model_name: str | None
    created_at: datetime


class ConversationSummary(BaseModel):
    id: UUID
    title: str
    updated_at: datetime
    message_count: int


class ConversationDetail(BaseModel):
    id: UUID
    title: str
    updated_at: datetime
    messages: list[MessageResponse]


class ChatRequest(BaseModel):
    conversation_id: UUID | None = None
    message: str = Field(min_length=1, max_length=8_000)
    source_types: list[str] | None = None
    use_tools: bool = True


class ChatResponse(BaseModel):
    conversation_id: UUID
    message: MessageResponse
    citations: list[Citation]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    mode: Literal["hybrid", "semantic", "exact"] = "hybrid"
    source_types: list[str] | None = None
    tags: list[str] | None = None
    limit: int = Field(default=8, ge=1, le=20)


class SearchResult(BaseModel):
    chunk_id: UUID
    document_id: UUID
    title: str
    document_slug: str | None = None
    section_title: str | None
    source_type: str
    document_kind: str | None = None
    summary: str | None = None
    tags: list[str] = Field(default_factory=list)
    path_or_url: str | None
    excerpt: str
    score: float


class SearchResponse(BaseModel):
    mode: str
    results: list[SearchResult]


class StreamEnvelope(BaseModel):
    event: Literal["metadata", "delta", "citations", "done", "error"]
    data: dict[str, Any]
