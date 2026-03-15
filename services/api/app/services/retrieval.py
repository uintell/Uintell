from __future__ import annotations

import logging
import re
from collections import defaultdict
from collections.abc import Sequence
from uuid import UUID

from qdrant_client import AsyncQdrantClient, models as qm
from qdrant_client.http.exceptions import UnexpectedResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.documents import DocumentRepository
from app.services.meilisearch import MeiliSearchService
from knowledge_engine.embeddings import EmbeddingProvider
from knowledge_engine.models import RetrievedChunk

QUERY_TOKEN_RE = re.compile(r"[a-z0-9]{2,}")
NORMALIZE_TEXT_RE = re.compile(r"[^a-z0-9]+")
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

logger = logging.getLogger(__name__)


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
        self._semantic_available = True

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
        source_names: Sequence[str] | None = None,
        document_ids: Sequence[str] | None = None,
        tags: Sequence[str] | None,
        limit: int,
    ) -> list[RetrievedChunk]:
        """Return reader-ready chunks using the single active retrieval path."""

        # Retrieval stays on one path: exact PostgreSQL search plus semantic
        # Qdrant search, then merge back onto authoritative Postgres rows.
        semantic_hits: list[tuple[str, float]] = []
        semantic_failed = False
        semantic_limit = limit * 2
        if source_names and not document_ids:
            semantic_limit = limit * 6
        if mode in {"hybrid", "semantic"} and self._semantic_available:
            try:
                semantic_hits = await self._semantic_search(query=query, limit=semantic_limit, document_ids=document_ids)
            except Exception as exc:
                semantic_failed = True
                if _is_qdrant_dimension_mismatch(exc):
                    self._semantic_available = False
                    logger.warning(
                        "retrieval.semantic_disabled_dimension_mismatch collection=%s expected_dimension=%s error=%s",
                        self._collection,
                        self._embeddings.dimension,
                        exc,
                    )
                else:
                    logger.warning(
                        "retrieval.semantic_search_failed collection=%s error=%s",
                        self._collection,
                        exc,
                    )
        semantic_ids = [chunk_id for chunk_id, _ in semantic_hits]
        semantic_scores = {chunk_id: score for chunk_id, score in semantic_hits}
        keyword_document_ids: list[str] = []
        keyword_ids: list[str] = []
        if mode in {"hybrid", "exact"} or semantic_failed:
            keyword_document_ids = []
            if self._meilisearch is not None and not source_names and not document_ids:
                keyword_document_ids = await self._meilisearch.search(query=query, source_types=source_types, limit=limit * 2)
            keyword_ids = await self._documents.keyword_search(
                db,
                query=query,
                source_types=source_types,
                source_names=source_names,
                document_ids=document_ids or keyword_document_ids or None,
                limit=limit * 2,
            )
            if not keyword_ids and not keyword_document_ids:
                keyword_ids = await self._documents.keyword_search(
                    db,
                    query=query,
                    source_types=source_types,
                    source_names=source_names,
                    document_ids=document_ids,
                    limit=limit * 2,
                )

        if mode == "semantic" and semantic_hits:
            merged_ids = semantic_ids[:limit]
        elif mode == "semantic":
            merged_ids = keyword_ids[:limit]
        elif mode == "exact":
            merged_ids = keyword_ids[:limit]
        else:
            merged_ids = _reciprocal_rank_fusion([semantic_ids, keyword_ids], limit=limit)

        chunks = await self._documents.fetch_retrieved_chunks(
            db,
            merged_ids,
            source_types=source_types,
            source_names=source_names,
            document_ids=document_ids,
            tags=tags,
        )
        supported = _filter_supported_chunks(
            chunks,
            query=query,
            keyword_ids=set(keyword_ids),
            semantic_scores=semantic_scores,
        )
        return _rerank_chunks(
            supported,
            query=query,
            keyword_ids=set(keyword_ids),
            diversify=document_ids is None,
            limit=limit,
        )

    async def _semantic_search(
        self,
        *,
        query: str,
        limit: int,
        document_ids: Sequence[str] | None = None,
    ) -> list[tuple[str, float]]:
        vector = await self._embeddings.embed_query(query)
        query_filter = None
        if document_ids:
            query_filter = qm.Filter(
                should=[
                    qm.FieldCondition(key="document_id", match=qm.MatchValue(value=document_id))
                    for document_id in document_ids
                ]
            )
        points = await self._qdrant.search(
            collection_name=self._collection,
            query_vector=vector,
            limit=limit,
            query_filter=query_filter,
        )
        return [(str(point.id), float(getattr(point, "score", 0.0) or 0.0)) for point in points]


def _is_qdrant_dimension_mismatch(exc: Exception) -> bool:
    if not isinstance(exc, UnexpectedResponse):
        return False
    return "Vector dimension error" in str(exc)


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


def _rerank_chunks(
    chunks: Sequence[RetrievedChunk],
    *,
    query: str,
    keyword_ids: set[str],
    diversify: bool,
    limit: int,
) -> list[RetrievedChunk]:
    # Bias toward the document/page entry points a reader expects first: title
    # matches, then section matches, then chunk content, then semantic score.
    normalized_query = _normalize_text(query)
    query_terms = _query_terms(query)
    ranked: list[tuple[float, int, RetrievedChunk]] = []

    for position, chunk in enumerate(chunks):
        score = 0.0
        score += _field_match_score(chunk.article_title, normalized_query=normalized_query, query_terms=query_terms) * 6.0
        score += _field_match_score(chunk.section_title or "", normalized_query=normalized_query, query_terms=query_terms) * 3.0
        score += _field_match_score(chunk.document_summary or "", normalized_query=normalized_query, query_terms=query_terms) * 1.4
        score += _field_match_score(chunk.content[:900], normalized_query=normalized_query, query_terms=query_terms)
        if chunk.chunk_id in keyword_ids:
            score += 42.0
        score += min(max(chunk.score, 0.0), 1.0) * 28.0
        ranked.append((score, -position, chunk))

    ranked.sort(reverse=True)

    ordered: list[RetrievedChunk] = []
    seen_chunks: set[str] = set()
    per_document: defaultdict[str, int] = defaultdict(int)

    for _, _, chunk in ranked:
        if chunk.chunk_id in seen_chunks:
            continue
        if diversify and per_document[chunk.document_id] >= 2:
            continue
        seen_chunks.add(chunk.chunk_id)
        per_document[chunk.document_id] += 1
        ordered.append(chunk)
        if len(ordered) >= limit:
            return ordered

    for _, _, chunk in ranked:
        if chunk.chunk_id in seen_chunks:
            continue
        seen_chunks.add(chunk.chunk_id)
        ordered.append(chunk)
        if len(ordered) >= limit:
            break

    return ordered


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


def _field_match_score(text: str, *, normalized_query: str, query_terms: Sequence[str]) -> float:
    if not text:
        return 0.0

    normalized_text = _normalize_text(text)
    if not normalized_text:
        return 0.0

    score = 0.0
    if normalized_query:
        if normalized_text == normalized_query:
            score += 120.0
        elif normalized_text.startswith(normalized_query):
            score += 84.0
        elif f" {normalized_query} " in f" {normalized_text} ":
            score += 62.0

    matched_terms = sum(1 for term in query_terms if _haystack_mentions_term(normalized_text, term))
    score += matched_terms * 12.0
    return score


def _normalize_text(value: str) -> str:
    return NORMALIZE_TEXT_RE.sub(" ", value.lower()).strip()
