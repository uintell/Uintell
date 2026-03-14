from __future__ import annotations

from knowledge_engine.models import ChunkPayload, ParsedDocument
from knowledge_engine.utils import normalize_whitespace


def chunk_document(
    document: ParsedDocument,
    *,
    chunk_size: int = 1_200,
    overlap: int = 160,
) -> list[ChunkPayload]:
    chunks: list[ChunkPayload] = []
    chunk_index = 0

    for section in document.sections:
        title_prefix = f"{section.title}\n" if section.title else ""
        text = normalize_whitespace(section.content)
        if not text:
            continue

        start = 0
        while start < len(text):
            window = text[start : start + chunk_size]
            if start + chunk_size < len(text):
                last_break = max(window.rfind(". "), window.rfind("\n"), window.rfind(" "))
                if last_break > 300:
                    window = window[:last_break].strip()
            if not window:
                break

            chunks.append(
                ChunkPayload(
                    source_type=document.source_type,
                    source_name=document.source_name,
                    canonical_id=document.canonical_id,
                    article_title=document.article_title,
                    section_title=section.title,
                    language=document.language,
                    path_or_url=document.path_or_url,
                    content=f"{title_prefix}{window}".strip(),
                    chunk_index=chunk_index,
                    document_slug=document.slug,
                    metadata=document.metadata.copy(),
                )
            )
            chunk_index += 1

            if start + len(window) >= len(text):
                break
            start += max(1, len(window) - overlap)

    return chunks
