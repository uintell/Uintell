from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from markdown import markdown
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.dependencies import get_db, require_user
from app.repositories.notes import NoteRepository
from app.schemas.knowledge import NoteCreateRequest, NoteResponse

router = APIRouter(prefix="/v1/notes", tags=["notes"])


@router.get("", response_model=list[NoteResponse])
async def list_notes(
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteResponse]:
    notes = await NoteRepository().list_notes(db, owner_user_id=user.id)
    return [_to_note_response(note) for note in notes]


@router.post("", response_model=NoteResponse)
async def create_note(
    payload: NoteCreateRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteRepository().create_note(
        db,
        owner_user_id=user.id,
        title=payload.title,
        content_markdown=payload.content_markdown,
        content_html=markdown(payload.content_markdown),
        plain_text=_markdown_to_text(payload.content_markdown),
        tags=payload.tags,
        linked_document_id=payload.linked_document_id,
        metadata=payload.metadata,
    )
    await db.commit()
    return _to_note_response(note)


@router.get("/slug/{slug}", response_model=NoteResponse)
async def get_note_by_slug(
    slug: str,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteRepository().get_note_by_slug(db, slug, owner_user_id=user.id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return _to_note_response(note)


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteRepository().get_note(db, note_id)
    if note is None or note.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return _to_note_response(note)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    payload: NoteCreateRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    note = await NoteRepository().get_note(db, note_id)
    if note is None or note.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note = await NoteRepository().update_note(
        db,
        note=note,
        title=payload.title,
        content_markdown=payload.content_markdown,
        content_html=markdown(payload.content_markdown),
        plain_text=_markdown_to_text(payload.content_markdown),
        tags=payload.tags,
        linked_document_id=payload.linked_document_id,
        metadata=payload.metadata,
    )
    await db.commit()
    return _to_note_response(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await NoteRepository().get_note(db, note_id)
    if note is None or note.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    await NoteRepository().delete_note(db, note)
    await db.commit()


def _to_note_response(note) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        title=note.title,
        slug=note.slug,
        content_markdown=note.content_markdown,
        content_html=note.content_html,
        plain_text=note.plain_text,
        tags=list(note.tags_json or []),
        linked_document_id=note.linked_document_id,
        metadata=note.metadata_json,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def _markdown_to_text(value: str) -> str:
    return " ".join(line.strip() for line in value.splitlines() if line.strip())
