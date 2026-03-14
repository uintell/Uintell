from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import Conversation, Message


class ConversationRepository:
    async def list_for_user(self, db: AsyncSession, user_id: UUID) -> list[tuple[Conversation, int]]:
        result = await db.execute(
            select(Conversation, func.count(Message.id))
            .outerjoin(Message, Message.conversation_id == Conversation.id)
            .where(Conversation.user_id == user_id, Conversation.archived_at.is_(None))
            .group_by(Conversation.id)
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.all())

    async def create(self, db: AsyncSession, *, user_id: UUID, title: str) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title[:255])
        db.add(conversation)
        await db.flush()
        return conversation

    async def get_for_user(self, db: AsyncSession, conversation_id: UUID, user_id: UUID) -> Conversation | None:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
        )
        return result.scalar_one_or_none()

    async def add_message(
        self,
        db: AsyncSession,
        *,
        conversation_id: UUID,
        role: str,
        content: str,
        citations: dict,
        provider_name: str | None = None,
        model_name: str | None = None,
        metadata: dict | None = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            citations=citations,
            provider_name=provider_name,
            model_name=model_name,
            metadata_json=metadata or {},
        )
        db.add(message)
        await db.flush()
        conversation = await db.get(Conversation, conversation_id)
        if conversation is not None:
            conversation.updated_at = message.created_at
        return message
