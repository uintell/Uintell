from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Document, DocumentChunk, DocumentLink, DocumentStatus, EmbeddingStatus
from knowledge_engine.models import ChunkPayload, ParsedDocument, RetrievedChunk, SourceType
from knowledge_engine.utils import sha256_text, slugify


class DocumentRepository:
    async def list_documents(
        self,
        db: AsyncSession,
        *,
        query: str | None = None,
        source_type: str | None = None,
        source_types: Sequence[str] | None = None,
        document_kind: str | None = None,
        tag: str | None = None,
        sort: str = "updated_desc",
        limit: int = 100,
    ) -> list[Document]:
        statement: Select[tuple[Document]] = select(Document)
        if source_types:
            statement = statement.where(Document.source_type.in_(list(source_types)))
        elif source_type:
            statement = statement.where(Document.source_type == source_type)
        if document_kind:
            statement = statement.where(Document.document_kind == document_kind)
        if tag:
            statement = statement.where(Document.tags_json.contains([tag]))
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    Document.title.ilike(pattern),
                    Document.summary.ilike(pattern),
                    Document.plain_text.ilike(pattern),
                )
            )
        if sort == "title_asc":
            statement = statement.order_by(Document.title.asc(), Document.updated_at.desc())
        elif sort == "title_desc":
            statement = statement.order_by(Document.title.desc(), Document.updated_at.desc())
        else:
            statement = statement.order_by(Document.updated_at.desc(), Document.title.asc())
        statement = statement.limit(limit)
        result = await db.execute(statement)
        return list(result.scalars().all())

    async def get_document(self, db: AsyncSession, document_id: UUID) -> Document | None:
        return await db.get(Document, document_id)

    async def get_document_by_slug(self, db: AsyncSession, slug: str) -> Document | None:
        result = await db.execute(select(Document).where(Document.slug == slug))
        return result.scalar_one_or_none()

    async def create_uploaded_document(
        self,
        db: AsyncSession,
        *,
        title: str,
        canonical_id: str,
        storage_key: str,
        source_name: str,
        metadata: dict,
    ) -> Document:
        document = Document(
            source_type=SourceType.FILESYSTEM.value,
            source_name=source_name,
            canonical_id=canonical_id,
            source_identifier=canonical_id,
            title=title,
            slug=slugify(title),
            path_or_url=storage_key,
            language="en",
            sha256=sha256_text(storage_key),
            status=DocumentStatus.PENDING.value,
            indexing_status=DocumentStatus.PENDING.value,
            embedding_status=EmbeddingStatus.PENDING.value,
            storage_key=storage_key,
            plain_text=title,
            normalized_content=title,
            raw_content=title,
            sections_json=[],
            tags_json=[],
            links_out_json=[],
            media_references_json=[],
            metadata_json=metadata,
        )
        db.add(document)
        await db.flush()
        return document

    async def upsert_document(
        self,
        db: AsyncSession,
        *,
        parsed_document: ParsedDocument,
        sha256: str,
        storage_key: str | None = None,
    ) -> tuple[Document, bool]:
        result = await db.execute(
            select(Document).where(
                Document.source_name == parsed_document.source_name,
                Document.canonical_id == parsed_document.canonical_id,
            )
        )
        document = result.scalar_one_or_none()
        changed = document is None or document.sha256 != sha256
        if document is None:
            document = Document(
                source_type=parsed_document.source_type.value,
                source_name=parsed_document.source_name,
                canonical_id=parsed_document.canonical_id,
                source_identifier=parsed_document.source_identifier or parsed_document.canonical_id,
                title=parsed_document.article_title,
                slug=parsed_document.slug or slugify(parsed_document.article_title),
                summary=parsed_document.summary,
                raw_content=parsed_document.raw_content,
                normalized_content=parsed_document.normalized_content or parsed_document.full_text,
                plain_text=parsed_document.full_text,
                sections_json=_serialize_sections(parsed_document),
                tags_json=list(parsed_document.tags),
                links_out_json=list(parsed_document.links_out),
                media_references_json=list(parsed_document.media_references),
                path_or_url=parsed_document.path_or_url,
                language=parsed_document.language,
                sha256=sha256,
                status=DocumentStatus.INDEXING.value,
                indexing_status=DocumentStatus.INDEXING.value,
                embedding_status=EmbeddingStatus.INDEXING.value,
                document_kind=parsed_document.document_kind,
                storage_key=storage_key,
                metadata_json=parsed_document.metadata,
            )
            db.add(document)
        else:
            document.source_type = parsed_document.source_type.value
            document.source_identifier = parsed_document.source_identifier or parsed_document.canonical_id
            document.title = parsed_document.article_title
            document.slug = parsed_document.slug or slugify(parsed_document.article_title)
            document.summary = parsed_document.summary
            document.raw_content = parsed_document.raw_content
            document.normalized_content = parsed_document.normalized_content or parsed_document.full_text
            document.plain_text = parsed_document.full_text
            document.sections_json = _serialize_sections(parsed_document)
            document.tags_json = list(parsed_document.tags)
            document.links_out_json = list(parsed_document.links_out)
            document.media_references_json = list(parsed_document.media_references)
            document.path_or_url = parsed_document.path_or_url
            document.language = parsed_document.language
            document.sha256 = sha256
            document.status = DocumentStatus.INDEXING.value
            document.indexing_status = DocumentStatus.INDEXING.value
            document.embedding_status = EmbeddingStatus.INDEXING.value
            document.document_kind = parsed_document.document_kind
            document.storage_key = storage_key or document.storage_key
            document.metadata_json = parsed_document.metadata
        await db.flush()
        return document, changed

    async def replace_chunks(
        self,
        db: AsyncSession,
        *,
        document: Document,
        chunks: Sequence[ChunkPayload],
        embedding_provider: str,
        embedding_model: str,
    ) -> list[DocumentChunk]:
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        chunk_rows: list[DocumentChunk] = []
        for chunk in chunks:
            row = DocumentChunk(
                document_id=document.id,
                chunk_index=chunk.chunk_index,
                section_title=chunk.section_title,
                content=chunk.content,
                content_hash=sha256_text(chunk.content),
                token_count=max(1, len(chunk.content.split())),
                metadata_json=chunk.metadata,
                embedding_provider=embedding_provider,
                embedding_model=embedding_model,
            )
            db.add(row)
            chunk_rows.append(row)
        await db.flush()
        return chunk_rows

    async def replace_links(
        self,
        db: AsyncSession,
        *,
        document: Document,
        links_out: Sequence[str],
    ) -> None:
        await db.execute(delete(DocumentLink).where(DocumentLink.source_document_id == document.id))
        seen: set[str] = set()
        for raw_link in links_out:
            target_slug = slugify(raw_link)
            if not target_slug or target_slug in seen:
                continue
            seen.add(target_slug)
            db.add(
                DocumentLink(
                    source_document_id=document.id,
                    target_slug=target_slug,
                    link_text=raw_link[:255],
                    link_type="reference",
                )
            )
        await db.flush()
        await self.resolve_links(db, document=document)

    async def resolve_links(self, db: AsyncSession, *, document: Document) -> None:
        result = await db.execute(select(DocumentLink).where(DocumentLink.source_document_id == document.id))
        links = list(result.scalars().all())
        if not links:
            return
        target_slugs = [link.target_slug for link in links]
        documents = (
            await db.execute(
                select(Document).where(
                    or_(
                        Document.slug.in_(target_slugs),
                        Document.canonical_id.in_(target_slugs),
                        Document.source_identifier.in_(target_slugs),
                    )
                )
            )
        ).scalars().all()
        by_slug = {candidate.slug or candidate.canonical_id: candidate for candidate in documents}
        by_source_identifier = {candidate.source_identifier or candidate.canonical_id: candidate for candidate in documents}
        by_canonical_id = {candidate.canonical_id: candidate for candidate in documents}
        for link in links:
            target = by_slug.get(link.target_slug) or by_source_identifier.get(link.target_slug) or by_canonical_id.get(link.target_slug)
            link.target_document_id = target.id if target else None
        await db.flush()

    async def fetch_retrieved_chunks(
        self,
        db: AsyncSession,
        chunk_ids: Sequence[str],
        *,
        source_types: Sequence[str] | None = None,
        tags: Sequence[str] | None = None,
    ) -> list[RetrievedChunk]:
        if not chunk_ids:
            return []
        statement = (
            select(DocumentChunk, Document)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.id.in_([UUID(chunk_id) for chunk_id in chunk_ids]))
        )
        if source_types:
            statement = statement.where(Document.source_type.in_(list(source_types)))
        if tags:
            statement = statement.where(or_(*[Document.tags_json.contains([tag]) for tag in tags]))
        rows = await db.execute(statement)
        index = {chunk_id: position for position, chunk_id in enumerate(chunk_ids)}
        retrieved: list[RetrievedChunk] = []
        for chunk, document in rows.all():
            retrieved.append(
                RetrievedChunk(
                    chunk_id=str(chunk.id),
                    document_id=str(document.id),
                    source_type=SourceType(document.source_type),
                    source_name=document.source_name,
                    article_title=document.title,
                    section_title=chunk.section_title,
                    path_or_url=document.path_or_url,
                    content=chunk.content,
                    score=chunk.semantic_score or 0.0,
                    document_slug=document.slug,
                    document_summary=document.summary,
                    document_kind=document.document_kind,
                    tags=list(document.tags_json or []),
                    metadata=chunk.metadata_json,
                )
            )
        return sorted(retrieved, key=lambda item: index.get(item.chunk_id, 10_000))

    async def keyword_search(
        self,
        db: AsyncSession,
        *,
        query: str,
        source_types: Sequence[str] | None = None,
        document_ids: Sequence[str] | None = None,
        limit: int = 10,
    ) -> list[str]:
        sql = """
        SELECT dc.id::text AS chunk_id
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE to_tsvector('english', coalesce(dc.section_title, '') || ' ' || dc.content)
              @@ websearch_to_tsquery('english', :query)
        """
        params: dict[str, object] = {"query": query, "limit": limit}
        if source_types:
            sql += " AND d.source_type = ANY(:source_types)"
            params["source_types"] = list(source_types)
        if document_ids:
            sql += " AND d.id::text = ANY(:document_ids)"
            params["document_ids"] = list(document_ids)
        sql += """
        ORDER BY ts_rank_cd(
            to_tsvector('english', coalesce(dc.section_title, '') || ' ' || dc.content),
            websearch_to_tsquery('english', :query)
        ) DESC
        LIMIT :limit
        """
        result = await db.execute(text(sql), params)
        return [row.chunk_id for row in result]

    async def count_by_source(self, db: AsyncSession) -> list[dict[str, int]]:
        result = await db.execute(
            select(Document.source_type, func.count(Document.id))
            .group_by(Document.source_type)
            .order_by(Document.source_type)
        )
        return [{"source_type": row[0], "count": row[1]} for row in result.all()]

    async def count_by_indexing_status(self, db: AsyncSession) -> list[dict[str, int]]:
        result = await db.execute(
            select(Document.indexing_status, func.count(Document.id))
            .group_by(Document.indexing_status)
            .order_by(Document.indexing_status)
        )
        return [{"status": row[0], "count": row[1]} for row in result.all()]

    async def list_backlinks(self, db: AsyncSession, *, document_id: UUID, limit: int = 20) -> list[Document]:
        result = await db.execute(
            select(Document)
            .join(DocumentLink, Document.id == DocumentLink.source_document_id)
            .where(DocumentLink.target_document_id == document_id)
            .order_by(Document.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_related(self, db: AsyncSession, *, document: Document, limit: int = 8) -> list[Document]:
        candidates: dict[UUID, tuple[int, Document]] = {}

        linked = (
            await db.execute(
                select(Document)
                .join(DocumentLink, Document.id == DocumentLink.target_document_id)
                .where(DocumentLink.source_document_id == document.id, Document.id != document.id)
                .limit(limit * 2)
            )
        ).scalars().all()
        for item in linked:
            candidates[item.id] = (candidates.get(item.id, (0, item))[0] + 5, item)

        backlinks = await self.list_backlinks(db, document_id=document.id, limit=limit * 2)
        for item in backlinks:
            candidates[item.id] = (candidates.get(item.id, (0, item))[0] + 4, item)

        tag_set = set(document.tags_json or [])
        nearby = (
            await db.execute(
                select(Document)
                .where(Document.id != document.id)
                .order_by(Document.updated_at.desc())
                .limit(100)
            )
        ).scalars().all()
        for item in nearby:
            score = 0
            if item.source_type == document.source_type:
                score += 1
            shared_tags = len(tag_set.intersection(item.tags_json or []))
            score += shared_tags * 2
            if score > 0:
                candidates[item.id] = (candidates.get(item.id, (0, item))[0] + score, item)

        ranked = sorted(candidates.values(), key=lambda row: (row[0], row[1].updated_at), reverse=True)
        return [document_row for _, document_row in ranked[:limit]]


def _serialize_sections(parsed_document: ParsedDocument) -> list[dict[str, str | None]]:
    return [
        {
            "title": section.title,
            "content": section.content,
            "anchor": section.anchor,
        }
        for section in parsed_document.sections
    ]
