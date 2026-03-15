from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.entities import Document, DocumentStatus, EmbeddingStatus, JobStatus
from app.repositories.documents import DocumentRepository
from app.repositories.system import SystemRepository
from app.services.retrieval import RetrievalService
from knowledge_engine import (
    chunk_document,
    iter_archwiki_documents,
    iter_filesystem_documents,
    iter_wikipedia_documents,
    parse_filesystem_document,
)
from knowledge_engine.models import ParsedDocument, SourceType
from knowledge_engine.utils import sha256_text, slugify


@dataclass(slots=True)
class IngestionSummary:
    processed: int = 0
    indexed: int = 0
    skipped: int = 0
    failed: int = 0

    def to_progress(self) -> dict[str, int]:
        return asdict(self)


class IngestionService:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        document_repository: DocumentRepository,
        system_repository: SystemRepository,
        retrieval_service: RetrievalService,
        embedding_provider_name: str,
        embedding_model_name: str,
    ) -> None:
        self._session_factory = session_factory
        self._documents = document_repository
        self._system = system_repository
        self._retrieval = retrieval_service
        self._embedding_provider_name = embedding_provider_name
        self._embedding_model_name = embedding_model_name

    async def process_job(self, job_id: UUID) -> IngestionSummary:
        """Run one ingestion job from queued source path to indexed knowledge."""

        async with self._session_factory() as db:
            job = await self._system.get_job(db, job_id)
            if job is None:
                raise ValueError(f"Job {job_id} not found")
            await self._system.update_job(db, job=job, status=JobStatus.RUNNING.value)
            await db.commit()

        try:
            limit = int(job.metadata_json.get("limit", 0) or 0)
            document_overrides = job.metadata_json.get("document_overrides") or {}
            if job.source_type == SourceType.ARCH_WIKI.value:
                summary = await self.ingest_archwiki(
                    job_id,
                    Path(job.target_path or "."),
                    limit=limit,
                    overrides=document_overrides,
                )
            elif job.source_type == SourceType.WIKIPEDIA.value:
                summary = await self.ingest_wikipedia(
                    job_id,
                    Path(job.target_path or "."),
                    limit=limit,
                    overrides=document_overrides,
                )
            elif job.source_type == SourceType.FILESYSTEM.value:
                summary = await self.ingest_filesystem(
                    job_id,
                    Path(job.target_path or "."),
                    limit=limit,
                    overrides=document_overrides,
                )
            else:
                raise ValueError(f"Unsupported source type: {job.source_type}")
            async with self._session_factory() as db:
                job = await self._system.get_job(db, job_id)
                if job is not None:
                    await self._system.update_job(
                        db,
                        job=job,
                        status=JobStatus.SUCCEEDED.value,
                        progress=summary.to_progress(),
                    )
                    await db.commit()
            return summary
        except Exception as exc:
            async with self._session_factory() as db:
                job = await self._system.get_job(db, job_id)
                if job is not None:
                    await self._system.update_job(
                        db,
                        job=job,
                        status=JobStatus.FAILED.value,
                        error_message=str(exc),
                    )
                    await db.commit()
            raise

    async def ingest_archwiki(
        self,
        job_id: UUID,
        root: Path,
        *,
        limit: int = 0,
        overrides: dict | None = None,
    ) -> IngestionSummary:
        return await self._ingest_iterator(job_id, iter_archwiki_documents(root, limit=limit or None), overrides=overrides)

    async def ingest_wikipedia(
        self,
        job_id: UUID,
        dump_path: Path,
        *,
        limit: int = 0,
        overrides: dict | None = None,
    ) -> IngestionSummary:
        return await self._ingest_iterator(job_id, iter_wikipedia_documents(dump_path, limit=limit or None), overrides=overrides)

    async def ingest_filesystem(
        self,
        job_id: UUID,
        root: Path,
        *,
        limit: int = 0,
        overrides: dict | None = None,
    ) -> IngestionSummary:
        if root.is_file():
            parsed = parse_filesystem_document(root.parent, root)
            iterator = [] if parsed is None else [parsed]
        else:
            iterator = iter_filesystem_documents(root, limit=limit or None)
        return await self._ingest_iterator(job_id, iterator, overrides=overrides)

    async def _ingest_iterator(self, job_id: UUID, documents, *, overrides: dict | None = None) -> IngestionSummary:
        summary = IngestionSummary()
        async with self._session_factory() as db:
            for parsed_document in documents:
                summary.processed += 1
                try:
                    changed = await self._upsert_parsed_document(db, parsed_document, overrides=overrides)
                    if changed:
                        summary.indexed += 1
                    else:
                        summary.skipped += 1
                except Exception:
                    summary.failed += 1
                if summary.processed % 10 == 0:
                    job = await self._system.get_job(db, job_id)
                    if job is not None:
                        await self._system.update_job(db, job=job, progress=summary.to_progress())
                    await db.commit()
            job = await self._system.get_job(db, job_id)
            if job is not None:
                await self._system.update_job(db, job=job, progress=summary.to_progress())
            await db.commit()
        return summary

    async def _upsert_parsed_document(
        self,
        db: AsyncSession,
        parsed_document: ParsedDocument,
        *,
        overrides: dict | None = None,
    ) -> bool:
        # Every importer feeds the same normalization path: parsed document ->
        # canonical document row -> chunk rows -> vector/index refresh.
        parsed_document = _apply_document_overrides(parsed_document, overrides)
        full_text = parsed_document.full_text or parsed_document.article_title
        document, changed = await self._documents.upsert_document(
            db,
            parsed_document=parsed_document,
            sha256=sha256_text(full_text),
        )
        if not changed:
            document.status = DocumentStatus.SKIPPED.value
            await db.flush()
            return False

        chunk_payloads = chunk_document(parsed_document)
        await self._documents.replace_links(db, document=document, links_out=parsed_document.links_out)
        chunk_rows = await self._documents.replace_chunks(
            db,
            document=document,
            chunks=chunk_payloads,
            embedding_provider=self._embedding_provider_name,
            embedding_model=self._embedding_model_name,
        )
        await db.commit()
        try:
            await self._retrieval.index_chunks(chunk_rows)
            await self._retrieval.index_document(document)
            document.status = DocumentStatus.INDEXED.value
            document.indexing_status = DocumentStatus.INDEXED.value
            document.embedding_status = EmbeddingStatus.INDEXED.value
            document.last_indexed_at = datetime.now(UTC)
            await db.commit()
        except Exception:
            document.status = DocumentStatus.FAILED.value
            document.indexing_status = DocumentStatus.FAILED.value
            document.embedding_status = EmbeddingStatus.FAILED.value
            await db.commit()
            raise
        return True

    async def prepare_upload(
        self,
        db: AsyncSession,
        *,
        title: str,
        storage_key: str,
        metadata: dict,
    ) -> Document:
        return await self._documents.create_uploaded_document(
            db,
            title=title,
            canonical_id=slugify(storage_key),
            storage_key=storage_key,
            source_name="local_uploads",
            metadata=metadata,
        )


def _apply_document_overrides(parsed_document: ParsedDocument, overrides: dict | None) -> ParsedDocument:
    if not overrides:
        return parsed_document

    source_type = parsed_document.source_type
    raw_source_type = overrides.get("source_type")
    if isinstance(raw_source_type, str):
        try:
            source_type = SourceType(raw_source_type)
        except ValueError:
            source_type = parsed_document.source_type

    metadata = dict(parsed_document.metadata)
    extra_metadata = overrides.get("metadata")
    if isinstance(extra_metadata, dict):
        metadata.update(extra_metadata)
    if overrides.get("source_profile_id"):
        metadata["source_profile_id"] = overrides["source_profile_id"]

    tags = _merge_unique_strings(parsed_document.tags, overrides.get("tags") or [])

    return replace(
        parsed_document,
        source_type=source_type,
        source_name=str(overrides.get("source_name") or parsed_document.source_name),
        document_kind=str(overrides.get("document_kind") or parsed_document.document_kind),
        tags=tags,
        metadata=metadata,
    )


def _merge_unique_strings(existing: list[str], incoming: list[str]) -> list[str]:
    merged: list[str] = []
    for value in [*existing, *incoming]:
        normalized = value.strip()
        if normalized and normalized not in merged:
            merged.append(normalized)
    return merged
