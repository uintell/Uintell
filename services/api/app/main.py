from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from qdrant_client import AsyncQdrantClient
from redis.asyncio import Redis
from temporalio.client import Client

from app.api.routes import auth, chat, collections, documents, health, imports, notes, retrieval, settings as settings_routes
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import build_engine, build_session_factory
from app.repositories.conversations import ConversationRepository
from app.repositories.documents import DocumentRepository
from app.repositories.system import SystemRepository
from app.services.answers import AnswerService
from app.services.chat import ChatService
from app.services.container import ServiceContainer
from app.services.ingestion import IngestionService
from app.services.meilisearch import MeiliSearchService
from app.services.providers import build_provider
from app.services.rate_limit import RateLimiter
from app.services.retrieval import RetrievalService
from app.services.security import SecurityService
from app.services.settings import SettingsService
from app.services.storage import build_storage
from app.services.tools import ToolRegistry
from app.telemetry.tracing import configure_tracing, instrument_app
from knowledge_engine.embeddings import HashEmbeddingProvider, OllamaEmbeddingProvider, OpenAIEmbeddingProvider

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    configure_tracing(service_name=settings.otel_service_name, otlp_endpoint=settings.otlp_endpoint)

    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)
    redis = Redis.from_url(settings.redis_url, decode_responses=True) if settings.redis_url else None
    qdrant = AsyncQdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        check_compatibility=False,
    )
    temporal = await _connect_temporal(settings)

    if settings.embedding_provider == "ollama":
        embedding_provider = OllamaEmbeddingProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_embedding_model,
            dimension=settings.ollama_embedding_dimensions,
        )
        embedding_provider_name = "ollama"
        embedding_model_name = settings.ollama_embedding_model
    elif settings.embedding_provider == "openai" and settings.openai_api_key:
        embedding_provider = OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model,
            dimension=settings.openai_embedding_dimensions,
            base_url=settings.openai_base_url,
        )
        embedding_provider_name = "openai"
        embedding_model_name = settings.openai_embedding_model
    else:
        embedding_provider = HashEmbeddingProvider(dimension=settings.openai_embedding_dimensions)
        embedding_provider_name = "hash"
        embedding_model_name = "hash"

    meilisearch = (
        MeiliSearchService(
            url=settings.meilisearch_url,
            index_name=settings.meilisearch_index,
            api_key=settings.meilisearch_api_key,
        )
        if settings.meilisearch_url
        else None
    )
    retrieval = RetrievalService(
        document_repository=DocumentRepository(),
        qdrant=qdrant,
        collection_name=settings.qdrant_collection,
        embedding_provider=embedding_provider,
        meilisearch=meilisearch,
    )
    await retrieval.ensure_collection()

    provider = build_provider(
        generation_provider=settings.generation_provider,
        ollama_base_url=settings.ollama_base_url,
        ollama_model=settings.ollama_model,
        api_key=settings.openai_api_key if settings.enable_openai_generation else None,
        model=settings.openai_model,
        base_url=settings.openai_base_url,
    )
    tool_registry = ToolRegistry(
        retrieval_service=retrieval,
        document_repository=DocumentRepository(),
        system_repository=SystemRepository(),
    )
    container = ServiceContainer(
        settings=settings,
        engine=engine,
        session_factory=session_factory,
        redis=redis,
        rate_limiter=RateLimiter(
            redis,
            limit=settings.rate_limit_requests,
            window_seconds=settings.rate_limit_window_seconds,
        ),
        qdrant=qdrant,
        temporal=temporal,
        security=SecurityService(settings.session_ttl_hours),
        storage=build_storage(settings),
        retrieval=retrieval,
        chat=ChatService(
            settings=settings,
            session_factory=session_factory,
            conversation_repository=ConversationRepository(),
            retrieval_service=retrieval,
            provider=provider,
            tool_registry=tool_registry,
        ),
        answers=AnswerService(
            settings=settings,
            document_repository=DocumentRepository(),
            retrieval_service=retrieval,
            provider=provider,
        ),
        ingestion=IngestionService(
            session_factory=session_factory,
            document_repository=DocumentRepository(),
            system_repository=SystemRepository(),
            retrieval_service=retrieval,
            embedding_provider_name=embedding_provider_name,
            embedding_model_name=embedding_model_name,
        ),
        app_settings=SettingsService(settings=settings, system_repository=SystemRepository()),
    )
    app.state.container = container
    logger.info(
        "api.startup.complete",
        temporal_enabled=temporal is not None,
        redis_enabled=redis is not None,
        meilisearch_enabled=meilisearch is not None,
        qdrant_collection=settings.qdrant_collection,
    )
    yield
    if redis is not None:
        await redis.close()
    await qdrant.close()
    await engine.dispose()


app = FastAPI(title="United Intelligence API", lifespan=lifespan)
instrument_app(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(retrieval.router)
app.include_router(documents.router)
app.include_router(notes.router)
app.include_router(collections.router)
app.include_router(settings_routes.router)
app.include_router(imports.router)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or request.headers.get("cf-ray") or str(uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, path=request.url.path)

    if request.url.path not in {"/health", "/ready"}:
        client_ip = request.client.host if request.client else "unknown"
        key = f"rate:{client_ip}:{request.url.path}"
        if await request.app.state.container.rate_limiter.is_limited(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"x-request-id": request_id},
            )

    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


async def _connect_temporal(settings):
    if not settings.temporal_host:
        return None
    last_error = None
    for attempt in range(1, 6):
        try:
            return await Client.connect(settings.temporal_host, namespace=settings.temporal_namespace)
        except Exception as exc:
            last_error = exc
            logger.warning("temporal.connect.retry", host=settings.temporal_host, attempt=attempt)
            await asyncio.sleep(min(attempt, 3))
    logger.warning("temporal.connect.failed", host=settings.temporal_host, error=str(last_error) if last_error else None)
    return None
