from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, require_user
from app.schemas.chat import ChatRequest, ChatResponse, ConversationDetail, ConversationSummary, MessageResponse
from app.services.container import ServiceContainer
from app.api.dependencies import get_container

router = APIRouter(prefix="/v1", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> list[ConversationSummary]:
    rows = await container.chat.list_conversations(db, user.id)
    return [ConversationSummary(**row) for row in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> ConversationDetail:
    conversation = await container.chat.get_conversation(db, conversation_id=conversation_id, user_id=user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        updated_at=conversation.updated_at,
        messages=[MessageResponse.model_validate(message) for message in conversation.messages],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> ChatResponse:
    conversation, message, citations = await container.chat.send_message(
        db,
        user_id=user.id,
        conversation_id=payload.conversation_id,
        message=payload.message,
        source_types=payload.source_types,
        use_tools=payload.use_tools,
    )
    return ChatResponse(
        conversation_id=conversation.id,
        message=MessageResponse.model_validate(message),
        citations=citations,
    )


@router.post("/chat/stream")
async def stream_chat(
    payload: ChatRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> StreamingResponse:
    _, iterator = await container.chat.stream_message(
        db,
        user_id=user.id,
        conversation_id=payload.conversation_id,
        message=payload.message,
        source_types=payload.source_types,
    )
    return StreamingResponse(iterator, media_type="text/event-stream")
