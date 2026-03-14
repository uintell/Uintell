from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from app.services.chat import ChatService
from app.services.providers import DeterministicRagProvider
from knowledge_engine.models import RetrievedChunk, SourceType


@dataclass
class FakeConversation:
    id: str
    title: str
    messages: list = field(default_factory=list)
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class FakeMessage:
    id: str
    role: str
    content: str
    citations: dict
    provider_name: str | None = None
    model_name: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class FakeConversationRepository:
    def __init__(self) -> None:
        self.conversation = FakeConversation(id=str(uuid4()), title="Test")

    async def list_for_user(self, db, user_id):
        return [(self.conversation, len(self.conversation.messages))]

    async def get_for_user(self, db, conversation_id, user_id):
        return self.conversation

    async def create(self, db, *, user_id, title):
        self.conversation = FakeConversation(id=str(uuid4()), title=title)
        return self.conversation

    async def add_message(self, db, *, conversation_id, role, content, citations, provider_name=None, model_name=None, metadata=None):
        message = FakeMessage(
            id=str(uuid4()),
            role=role,
            content=content,
            citations=citations,
            provider_name=provider_name,
            model_name=model_name,
        )
        self.conversation.messages.append(message)
        return message


class FakeRetrievalService:
    async def search(self, db, *, query, source_types, limit):
        return [
            RetrievedChunk(
                chunk_id=str(uuid4()),
                document_id=str(uuid4()),
                source_type=SourceType.FILESYSTEM,
                source_name="local_filesystem",
                article_title="Offline Principles",
                section_title="Overview",
                path_or_url="/tmp/offline-principles.txt",
                content="Offline systems should preserve source attribution and prefer local retrieval.",
                score=0.9,
                metadata={},
            )
        ]


class FakeToolRegistry:
    def definitions(self):
        return []

    async def execute(self, db, *, conversation_id, name, arguments):
        return {}


class FakeDB:
    async def commit(self):
        return None


async def test_chat_service_generates_grounded_answer() -> None:
    service = ChatService(
        settings=SimpleNamespace(
            rag_top_k=4,
            system_prompt="Use only context.",
            openai_max_output_tokens=800,
            openai_temperature=0.2,
            enable_tool_calling=False,
        ),
        session_factory=None,
        conversation_repository=FakeConversationRepository(),
        retrieval_service=FakeRetrievalService(),
        provider=DeterministicRagProvider(),
        tool_registry=FakeToolRegistry(),
    )

    conversation, assistant_message, citations = await service.send_message(
        FakeDB(),
        user_id=uuid4(),
        conversation_id=None,
        message="How should an offline system behave?",
        source_types=None,
        use_tools=False,
    )

    assert conversation.title
    assert "offline sources" in assistant_message.content.lower() or "offline systems" in assistant_message.content.lower()
    assert citations[0]["label"] == "S1"
