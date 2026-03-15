from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_user
from app.core.content_visibility import is_hidden_document
from app.schemas.chat import SearchRequest, SearchResponse, SearchResult
from app.services.container import ServiceContainer

router = APIRouter(prefix="/v1/retrieval", tags=["retrieval"])
QUERY_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")


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
                source_type=item.source_type.value,
                source_name=item.source_name,
                document_kind=item.document_kind,
                summary=item.document_summary,
                tags=item.tags,
                path_or_url=item.path_or_url,
                excerpt=_build_excerpt(item.content, payload.query),
                score=item.score,
            )
            for item in results
        ]
    )


def _build_excerpt(content: str, query: str, *, window: int = 280) -> str:
    compact = " ".join(content.split())
    if len(compact) <= window:
        return compact

    haystack = compact.lower()
    match_index = -1
    for token in QUERY_TOKEN_RE.findall(query.lower()):
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
