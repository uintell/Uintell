from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_user
from app.core.content_visibility import is_hidden_document
from app.schemas.chat import SearchRequest, SearchResponse, SearchResult
from app.services.container import ServiceContainer
from knowledge_engine.models import RetrievedChunk

router = APIRouter(prefix="/v1/retrieval", tags=["retrieval"])
QUERY_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")
NORMALIZE_TEXT_RE = re.compile(r"[^a-z0-9]+")


@router.post("/search", response_model=SearchResponse)
async def search(
    payload: SearchRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> SearchResponse:
    results = [
        item
        for item in await container.retrieval.search(
            db,
            query=payload.query,
            mode=payload.mode,
            source_types=payload.source_types,
            tags=payload.tags,
            limit=payload.limit,
        )
        if not is_hidden_document(
            source_type=item.source_type.value,
            title=item.article_title,
            path_or_url=item.path_or_url,
        )
    ]
    return SearchResponse(
        mode=payload.mode,
        results=[
            SearchResult(
                chunk_id=item.chunk_id,
                document_id=item.document_id,
                title=item.article_title,
                document_slug=item.document_slug,
                section_title=item.section_title,
                section_anchor=_normalize_anchor(item),
                source_type=item.source_type.value,
                source_name=item.source_name,
                document_kind=item.document_kind,
                summary=item.document_summary,
                tags=item.tags,
                path_or_url=item.path_or_url,
                excerpt=_build_excerpt(item.content, payload.query),
                score=item.score,
                match_reasons=_build_match_reasons(item, payload.query),
            )
            for item in results
        ]
    )


def _build_excerpt(content: str, query: str, *, window: int = 280) -> str:
    compact = " ".join(content.split())
    if len(compact) <= window:
        return compact

    haystack = compact.lower()
    query_terms = [token for token in QUERY_TOKEN_RE.findall(query.lower()) if token]
    ranked_terms = sorted(query_terms, key=len, reverse=True)
    match_index = -1
    for token in ranked_terms:
        candidate = haystack.find(token)
        if candidate >= 0 and (match_index < 0 or candidate < match_index):
            match_index = candidate

    if match_index < 0:
        snippet = compact[: window - 3].rstrip()
        return f"{snippet}..."

    half_window = window // 2
    start = max(0, match_index - half_window + 24)
    end = min(len(compact), start + window)
    start = max(0, end - window)
    snippet = compact[start:end].strip()

    if start > 0:
        snippet = f"...{snippet}"
    if end < len(compact):
        snippet = f"{snippet}..."
    return snippet


def _build_match_reasons(item: RetrievedChunk, query: str) -> list[str]:
    normalized_query = _normalize_text(query)
    reasons: list[str] = []

    if _is_exactish_match(item.article_title, normalized_query):
        reasons.append("Page title")
    if item.section_title and _is_exactish_match(item.section_title, normalized_query):
        reasons.append("Section heading")

    content_text = " ".join(part for part in (item.content, item.document_summary or "") if part)
    content_term_matches = sum(1 for term in QUERY_TOKEN_RE.findall(query.lower()) if term and term in content_text.lower())
    if content_term_matches >= 1:
        reasons.append("Page text")
    if item.score >= 0.45:
        reasons.append("Semantic similarity")

    if not reasons:
        reasons.append("Related wording")

    return reasons[:3]


def _normalize_anchor(item: RetrievedChunk) -> str | None:
    raw_anchor = item.metadata.get("section_anchor") if isinstance(item.metadata, dict) else None
    if isinstance(raw_anchor, str) and raw_anchor.strip():
        return _slugify_text(raw_anchor)
    if item.section_title:
        return _slugify_text(item.section_title)
    return None


def _is_exactish_match(text: str | None, normalized_query: str) -> bool:
    if not text or not normalized_query:
        return False
    normalized_text = _normalize_text(text)
    return (
        normalized_text == normalized_query
        or normalized_text.startswith(normalized_query)
        or f" {normalized_query} " in f" {normalized_text} "
    )


def _normalize_text(value: str) -> str:
    return NORMALIZE_TEXT_RE.sub(" ", value.lower()).strip()


def _slugify_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "section"
