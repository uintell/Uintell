from __future__ import annotations

from dataclasses import dataclass

from qdrant_client import AsyncQdrantClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from temporalio.client import Client

from app.core.config import Settings
from app.services.answers import AnswerService
from app.services.chat import ChatService
from app.services.ingestion import IngestionService
from app.services.rate_limit import RateLimiter
from app.services.retrieval import RetrievalService
from app.services.security import SecurityService
from app.services.settings import SettingsService
from app.services.storage import FileStorage


@dataclass(slots=True)
class ServiceContainer:
    """The active runtime boundary for the web -> API knowledge product."""

    settings: Settings
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    redis: Redis | None
    rate_limiter: RateLimiter
    qdrant: AsyncQdrantClient
    temporal: Client | None
    security: SecurityService
    storage: FileStorage
    retrieval: RetrievalService
    chat: ChatService
    answers: AnswerService
    ingestion: IngestionService
    app_settings: SettingsService
