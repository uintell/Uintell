from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Note
from knowledge_engine.utils import slugify


class NoteRepository:
    async def list_notes(self, db: AsyncSession, *, owner_user_id: UUID | None, limit: int = 100) -> list[Note]:
        statement = select(Note).order_by(Note.updated_at.desc()).limit(limit)
        if owner_user_id is not None:
            statement = statement.where(Note.owner_user_id == owner_user_id)
        result = await db.execute(statement)
        return list(result.scalars().all())

    async def get_note(self, db: AsyncSession, note_id: UUID) -> Note | None:
        return await db.get(Note, note_id)

    async def get_note_by_slug(self, db: AsyncSession, slug: str, *, owner_user_id: UUID | None) -> Note | None:
        statement = select(Note).where(Note.slug == slug)
        if owner_user_id is not None:
            statement = statement.where(Note.owner_user_id == owner_user_id)
        result = await db.execute(statement.limit(1))
        return result.scalars().first()

    async def create_note(
        self,
        db: AsyncSession,
        *,
        owner_user_id: UUID | None,
        title: str,
        content_markdown: str,
        content_html: str,
        plain_text: str,
        tags: list[str],
        linked_document_id: UUID | None,
        metadata: dict,
    ) -> Note:
        note = Note(
            owner_user_id=owner_user_id,
            linked_document_id=linked_document_id,
            title=title,
            slug=self._unique_slug(title),
            content_markdown=content_markdown,
            content_html=content_html,
            plain_text=plain_text,
            tags_json=tags,
            metadata_json=metadata,
        )
        db.add(note)
        await db.flush()
        return note

    async def update_note(
        self,
        db: AsyncSession,
        *,
        note: Note,
        title: str,
        content_markdown: str,
        content_html: str,
        plain_text: str,
        tags: list[str],
        linked_document_id: UUID | None,
        metadata: dict,
    ) -> Note:
        note.title = title
        note.slug = self._unique_slug(title, note.id)
        note.content_markdown = content_markdown
        note.content_html = content_html
        note.plain_text = plain_text
        note.tags_json = tags
        note.linked_document_id = linked_document_id
        note.metadata_json = metadata
        await db.flush()
        return note

    async def delete_note(self, db: AsyncSession, note: Note) -> None:
        await db.delete(note)
        await db.flush()

    def _unique_slug(self, title: str, note_id: UUID | None = None) -> str:
        suffix = str(note_id)[:8] if note_id else ""
        base = slugify(title)
        return f"{base}-{suffix}" if suffix else base
