from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class SourceType(StrEnum):
    ARCH_WIKI = "arch_wiki"
    WIKIPEDIA = "wikipedia"
    FILESYSTEM = "filesystem"
    BOOK = "book"
    NOTE = "note"


@dataclass(slots=True)
class Section:
    title: str | None
    content: str
    anchor: str | None = None


@dataclass(slots=True)
class ParsedDocument:
    source_type: SourceType
    source_name: str
    canonical_id: str
    article_title: str
    slug: str | None = None
    source_identifier: str | None = None
    summary: str | None = None
    raw_content: str | None = None
    normalized_content: str | None = None
    language: str = "en"
    path_or_url: str | None = None
    document_kind: str = "article"
    tags: list[str] = field(default_factory=list)
    links_out: list[str] = field(default_factory=list)
    media_references: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    sections: list[Section] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        if self.normalized_content:
            return self.normalized_content
        return "\n\n".join(section.content for section in self.sections if section.content.strip())


@dataclass(slots=True)
class ChunkPayload:
    source_type: SourceType
    source_name: str
    canonical_id: str
    article_title: str
    section_title: str | None
    language: str
    path_or_url: str | None
    content: str
    chunk_index: int
    document_slug: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    source_type: SourceType
    source_name: str
    article_title: str
    section_title: str | None
    path_or_url: str | None
    content: str
    score: float
    document_slug: str | None = None
    document_summary: str | None = None
    document_kind: str | None = None
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
