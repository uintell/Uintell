from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_user
from app.schemas.chat import SearchRequest, SearchResponse, SearchResult
from app.services.container import ServiceContainer

router = APIRouter(prefix="/v1/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse)
async def search(
    payload: SearchRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> SearchResponse:
    results = await container.retrieval.search(
        db,
        query=payload.query,
        mode=payload.mode,
        source_types=payload.source_types,
        tags=payload.tags,
        limit=payload.limit,
    )
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
                document_kind=item.document_kind,
                summary=item.document_summary,
                tags=item.tags,
                path_or_url=item.path_or_url,
                excerpt=item.content[:500],
                score=item.score,
            )
            for item in results
        ]
    )
