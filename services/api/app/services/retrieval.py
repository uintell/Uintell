from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Sequence
from uuid import UUID

from qdrant_client import AsyncQdrantClient, models as qm
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.documents import DocumentRepository
from app.services.meilisearch import MeiliSearchService
from knowledge_engine.embeddings import EmbeddingProvider
from knowledge_engine.models import RetrievedChunk

QUERY_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")
QUERY_STOPWORDS = {
    "a",
    "about",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "for",
    "from",
    "how",
    "i",
    "if",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "please",
    "tell",
    "that",
    "the",
    "this",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "using",
}


class RetrievalService:
    def __init__(
        self,
        *,
        document_repository: DocumentRepository,
        qdrant: AsyncQdrantClient,
        collection_name: str,
        embedding_provider: EmbeddingProvider,
        meilisearch: MeiliSearchService | None = None,
    ) -> None:
        self._documents = document_repository
        self._qdrant = qdrant
        self._collection = collection_name
        self._embeddings = embedding_provider
        self._meilisearch = meilisearch

    async def ensure_collection(self) -> None:
        exists = await self._qdrant.collection_exists(collection_name=self._collection)
        if not exists:
            await self._qdrant.create_collection(
                collection_name=self._collection,
                vectors_config=qm.VectorParams(size=self._embeddings.dimension, distance=qm.Distance.COSINE),
            )
        if self._meilisearch is not None:
            try:
                await self._meilisearch.ensure_index()
            except Exception:
                self._meilisearch = None

    async def index_chunks(self, chunks: Sequence[object]) -> None:
        if not chunks:
            return
        vectors = await self._embeddings.embed_texts([chunk.content for chunk in chunks])
        points = []
        for chunk, vector in zip(chunks, vectors, strict=False):
            points.append(
                qm.PointStruct(
                    id=str(chunk.id),
                    vector=vector,
                    payload={
                        "document_id": str(chunk.document_id),
                        "section_title": chunk.section_title or "",
                    },
                )
            )
        await self._qdrant.upsert(collection_name=self._collection, points=points, wait=True)

    async def index_document(self, document: object) -> None:
        if self._meilisearch is None:
            return
        await self._meilisearch.upsert_documents([document])

    async def search(
        self,
        db: AsyncSession,
        *,
        query: str,
        mode: str,
        source_types: Sequence[str] | None,
        tags: Sequence[str] | None,
        limit: int,
    ) -> list[RetrievedChunk]:
        semantic_hits: list[tuple[str, float]] = []
        if mode in {"hybrid", "semantic"}:
            semantic_hits = await self._semantic_search(query=query, limit=limit * 2)
        semantic_ids = [chunk_id for chunk_id, _ in semantic_hits]
        semantic_scores = {chunk_id: score for chunk_id, score in semantic_hits}
        keyword_document_ids: list[str] = []
        keyword_ids: list[str] = []
        if mode in {"hybrid", "exact"}:
            keyword_document_ids = (
                await self._meilisearch.search(query=query, source_types=source_types, limit=limit * 2)
                if self._meilisearch is not None
                else []
            )
            keyword_ids = await self._documents.keyword_search(
                db,
                query=query,
                source_types=source_types,
                document_ids=keyword_document_ids or None,
                limit=limit * 2,
            )
            if not keyword_ids and not keyword_document_ids:
                keyword_ids = await self._documents.keyword_search(db, query=query, source_types=source_types, limit=limit * 2)

        if mode == "semantic":
            merged_ids = semantic_ids[:limit]
        elif mode == "exact":
            merged_ids = keyword_ids[:limit]
        else:
            merged_ids = _reciprocal_rank_fusion([semantic_ids, keyword_ids], limit=limit)

        chunks = await self._documents.fetch_retrieved_chunks(
            db,
            merged_ids,
            source_types=source_types,
            tags=tags,
        )
        return _filter_supported_chunks(
            chunks,
            query=query,
            keyword_ids=set(keyword_ids),
            semantic_scores=semantic_scores,
        )

    async def _semantic_search(self, *, query: str, limit: int) -> list[tuple[str, float]]:
        vector = await self._embeddings.embed_query(query)
        points = await self._qdrant.search(collection_name=self._collection, query_vector=vector, limit=limit)
        return [(str(point.id), float(getattr(point, "score", 0.0) or 0.0)) for point in points]


def _reciprocal_rank_fusion(rankings: Sequence[Sequence[str]], *, limit: int, k: int = 60) -> list[str]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for position, item_id in enumerate(ranking, start=1):
            scores[item_id] += 1.0 / (k + position)
    return [item_id for item_id, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]]


def _filter_supported_chunks(
    chunks: Sequence[RetrievedChunk],
    *,
    query: str,
    keyword_ids: set[str],
    semantic_scores: dict[str, float],
) -> list[RetrievedChunk]:
    query_terms = _query_terms(query)
    if not query_terms:
        return list(chunks)

    supported: list[RetrievedChunk] = []
    for chunk in chunks:
        chunk.score = semantic_scores.get(chunk.chunk_id, 0.0)
        if _chunk_supports_query(chunk, query_terms=query_terms, keyword_matched=chunk.chunk_id in keyword_ids):
            supported.append(chunk)
    return supported


def _chunk_supports_query(chunk: RetrievedChunk, *, query_terms: Sequence[str], keyword_matched: bool) -> bool:
    if keyword_matched:
        return True

    haystack = " ".join(
        part
        for part in (
            chunk.article_title,
            chunk.section_title or "",
            chunk.path_or_url or "",
            chunk.content,
        )
        if part
    ).lower()

    matched_terms = sum(1 for term in query_terms if _haystack_mentions_term(haystack, term))
    minimum_matches = 1 if len(query_terms) <= 3 else 2
    return matched_terms >= minimum_matches


def _query_terms(query: str) -> list[str]:
    return [token for token in QUERY_TOKEN_RE.findall(query.lower()) if token not in QUERY_STOPWORDS]


def _haystack_mentions_term(haystack: str, term: str) -> bool:
    if re.search(rf"\b{re.escape(term)}[a-z0-9_-]*\b", haystack):
        return True
    if len(term) < 5:
        return False
    prefix = term[:4]
    return re.search(rf"\b{re.escape(prefix)}[a-z0-9_-]*\b", haystack) is not None
