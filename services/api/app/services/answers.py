from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.repositories.documents import DocumentRepository
from app.services.providers import LLMProvider, ProviderRequest
from app.services.retrieval import RetrievalService
from knowledge_engine.models import RetrievedChunk
from knowledge_engine.prompting import build_citation_bundle


@dataclass(slots=True)
class SupportingPassage:
    label: str
    document_id: str
    document_slug: str | None
    title: str
    section_title: str | None
    excerpt: str
    source_type: str
    source_name: str
    path_or_url: str | None
    score: float


@dataclass(slots=True)
class GroundedAnswer:
    text: str
    scope_used: str
    citations: list[dict[str, str]]
    passages: list[SupportingPassage]
    provider_name: str
    model_name: str


class AnswerService:
    def __init__(
        self,
        *,
        settings: Settings,
        document_repository: DocumentRepository,
        retrieval_service: RetrievalService,
        provider: LLMProvider,
    ) -> None:
        self._settings = settings
        self._documents = document_repository
        self._retrieval = retrieval_service
        self._provider = provider

    async def answer_document_question(
        self,
        db: AsyncSession,
        *,
        document_id: UUID,
        question: str,
        mode: str = "hybrid",
    ) -> GroundedAnswer:
        document = await self._documents.get_document(db, document_id)
        if document is None:
            raise ValueError("Document not found")

        page_hits = await self._retrieval.search(
            db,
            query=question,
            mode=mode,
            source_types=[document.source_type],
            source_names=[document.source_name],
            document_ids=[str(document.id)],
            tags=None,
            limit=self._settings.rag_top_k,
        )

        merged_hits = list(page_hits)
        scope_used = "page"

        if len(page_hits) < min(3, self._settings.rag_top_k):
            source_hits = await self._retrieval.search(
                db,
                query=question,
                mode=mode,
                source_types=[document.source_type],
                source_names=[document.source_name],
                tags=None,
                limit=self._settings.rag_top_k,
            )
            merged_hits = _merge_chunks(page_hits, source_hits, limit=self._settings.rag_top_k)
            if source_hits:
                scope_used = "page_then_source"

        if not merged_hits:
            provider_name = getattr(self._provider, "name", "retrieval-only")
            model_name = getattr(self._provider, "model", getattr(self._provider, "_model", "retrieval-only"))
            return GroundedAnswer(
                text="I do not have enough verified evidence from this page or source to answer that yet. Try a narrower question or import more relevant material.",
                scope_used="no_evidence",
                citations=[],
                passages=[],
                provider_name=str(provider_name),
                model_name=str(model_name),
            )

        _, citations = build_citation_bundle(merged_hits)
        request = ProviderRequest(
            question=question,
            system_prompt=self._settings.system_prompt,
            conversation_history=[],
            retrieved_chunks=merged_hits,
            citations=citations,
            max_output_tokens=self._settings.openai_max_output_tokens,
            temperature=self._settings.openai_temperature,
        )
        answer = await self._provider.generate(request)
        return GroundedAnswer(
            text=answer.text,
            scope_used=scope_used,
            citations=citations,
            passages=[
                SupportingPassage(
                    label=citation["label"],
                    document_id=chunk.document_id,
                    document_slug=chunk.document_slug,
                    title=chunk.article_title,
                    section_title=chunk.section_title,
                    excerpt=_clip_excerpt(chunk),
                    source_type=chunk.source_type.value,
                    source_name=chunk.source_name,
                    path_or_url=chunk.path_or_url,
                    score=chunk.score,
                )
                for citation, chunk in zip(citations, merged_hits, strict=False)
            ],
            provider_name=answer.provider_name,
            model_name=answer.model_name,
        )


def _merge_chunks(primary: list[RetrievedChunk], secondary: list[RetrievedChunk], *, limit: int) -> list[RetrievedChunk]:
    merged: list[RetrievedChunk] = []
    seen: set[str] = set()
    for chunk in [*primary, *secondary]:
        if chunk.chunk_id in seen:
            continue
        seen.add(chunk.chunk_id)
        merged.append(chunk)
        if len(merged) >= limit:
            break
    return merged


def _clip_excerpt(chunk: RetrievedChunk) -> str:
    text = chunk.content.strip()
    if len(text) <= 560:
        return text
    return text[:557].rstrip() + "..."
