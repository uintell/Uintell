from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.repositories.conversations import ConversationRepository
from app.services.providers import GeneratedAnswer, LLMProvider, ProviderRequest, StreamEvent
from app.services.tools import ToolRegistry
from app.services.retrieval import RetrievalService
from knowledge_engine.prompting import build_citation_bundle


class ChatService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        conversation_repository: ConversationRepository,
        retrieval_service: RetrievalService,
        provider: LLMProvider,
        tool_registry: ToolRegistry,
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory
        self._conversations = conversation_repository
        self._retrieval = retrieval_service
        self._provider = provider
        self._tools = tool_registry

    async def list_conversations(self, db: AsyncSession, user_id: UUID) -> list[dict]:
        rows = await self._conversations.list_for_user(db, user_id)
        return [
            {
                "id": conversation.id,
                "title": conversation.title,
                "updated_at": conversation.updated_at,
                "message_count": message_count,
            }
            for conversation, message_count in rows
        ]

    async def get_conversation(self, db: AsyncSession, *, conversation_id: UUID, user_id: UUID):
        return await self._conversations.get_for_user(db, conversation_id, user_id)

    async def send_message(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        conversation_id: UUID | None,
        message: str,
        source_types: list[str] | None,
        use_tools: bool,
    ) -> tuple[object, object, list[dict]]:
        conversation = await self._ensure_conversation(db, user_id=user_id, conversation_id=conversation_id, message=message)
        await self._conversations.add_message(db, conversation_id=conversation.id, role="user", content=message, citations={})
        loaded_conversation = await self._conversations.get_for_user(db, conversation.id, user_id)

        chunks = await self._retrieval.search(db, query=message, source_types=source_types, limit=self._settings.rag_top_k)
        _, citations = build_citation_bundle(chunks)
        history = self._history_from_conversation(loaded_conversation)
        request = ProviderRequest(
            question=message,
            system_prompt=self._settings.system_prompt,
            conversation_history=history,
            retrieved_chunks=chunks,
            citations=citations,
            tools=self._tools.definitions() if use_tools and self._settings.enable_tool_calling else [],
            max_output_tokens=self._settings.openai_max_output_tokens,
            temperature=self._settings.openai_temperature,
        )
        answer = await self._provider.generate(
            request,
            tool_executor=lambda name, arguments: self._tools.execute(
                db,
                conversation_id=conversation.id,
                name=name,
                arguments=arguments,
            ),
        )
        assistant = await self._conversations.add_message(
            db,
            conversation_id=conversation.id,
            role="assistant",
            content=answer.text,
            citations={"items": citations},
            provider_name=answer.provider_name,
            model_name=answer.model_name,
            metadata={"tool_calls": answer.tool_calls},
        )
        await db.commit()
        return conversation, assistant, citations

    async def stream_message(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        conversation_id: UUID | None,
        message: str,
        source_types: list[str] | None,
    ) -> tuple[object, AsyncIterator[str]]:
        conversation = await self._ensure_conversation(db, user_id=user_id, conversation_id=conversation_id, message=message)
        await self._conversations.add_message(db, conversation_id=conversation.id, role="user", content=message, citations={})
        await db.commit()
        loaded_conversation = await self._conversations.get_for_user(db, conversation.id, user_id)

        chunks = await self._retrieval.search(db, query=message, source_types=source_types, limit=self._settings.rag_top_k)
        _, citations = build_citation_bundle(chunks)
        history = self._history_from_conversation(loaded_conversation)
        request = ProviderRequest(
            question=message,
            system_prompt=self._settings.system_prompt,
            conversation_history=history,
            retrieved_chunks=chunks,
            citations=citations,
            max_output_tokens=self._settings.openai_max_output_tokens,
            temperature=self._settings.openai_temperature,
        )

        async def iterator() -> AsyncIterator[str]:
            full_text_parts: list[str] = []
            yield _sse("metadata", {"conversation_id": str(conversation.id)})
            try:
                async for event in self._provider.stream(request):
                    if event.event == "delta":
                        text = event.data["text"]
                        full_text_parts.append(text)
                        yield _sse("delta", {"text": text})
                full_text = "".join(full_text_parts).strip()
                async with self._session_factory() as stream_db:
                    assistant = await self._conversations.add_message(
                        stream_db,
                        conversation_id=conversation.id,
                        role="assistant",
                        content=full_text or "I do not have enough verified offline evidence to answer this question.",
                        citations={"items": citations},
                        provider_name=getattr(self._provider, "name", "provider"),
                        model_name=getattr(self._provider, "model", self._settings.openai_model),
                    )
                    await stream_db.commit()
                yield _sse("citations", {"items": citations, "message_id": str(assistant.id)})
                yield _sse("done", {"conversation_id": str(conversation.id), "message_id": str(assistant.id)})
            except Exception as exc:
                yield _sse("error", {"message": str(exc)})

        return conversation, iterator()

    async def _ensure_conversation(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        conversation_id: UUID | None,
        message: str,
    ):
        if conversation_id:
            conversation = await self._conversations.get_for_user(db, conversation_id, user_id)
            if conversation is not None:
                return conversation
        return await self._conversations.create(db, user_id=user_id, title=message[:80])

    @staticmethod
    def _history_from_conversation(conversation) -> list[dict[str, str]]:
        if conversation is None:
            return []
        return [{"role": item.role, "content": item.content} for item in conversation.messages[-8:]]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
