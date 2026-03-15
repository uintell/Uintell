from __future__ import annotations

import asyncio
import logging

from qdrant_client import AsyncQdrantClient
from temporalio.client import Client
from temporalio.worker import Worker

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.repositories.documents import DocumentRepository
from app.repositories.system import SystemRepository
from app.services.ingestion import IngestionService
from app.services.meilisearch import MeiliSearchService
from app.services.retrieval import RetrievalService
from knowledge_engine.embeddings import HashEmbeddingProvider, OllamaEmbeddingProvider, OpenAIEmbeddingProvider
from worker_app.activities.ingestion import IngestionActivities
from worker_app.workflows.ingestion import (
    ArchWikiIngestionWorkflow,
    FileIngestionWorkflow,
    FilesystemIngestionWorkflow,
    WikipediaIngestionWorkflow,
)

logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()
    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)
    qdrant = AsyncQdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        check_compatibility=False,
    )
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
    meilisearch = MeiliSearchService(
        url=settings.meilisearch_url,
        index_name=settings.meilisearch_index,
        api_key=settings.meilisearch_api_key,
    )
    retrieval = RetrievalService(
        document_repository=DocumentRepository(),
        qdrant=qdrant,
        collection_name=settings.qdrant_collection,
        embedding_provider=embedding_provider,
        meilisearch=meilisearch,
    )
    await retrieval.ensure_collection()

    ingestion = IngestionService(
        session_factory=session_factory,
        document_repository=DocumentRepository(),
        system_repository=SystemRepository(),
        retrieval_service=retrieval,
        embedding_provider_name=embedding_provider_name,
        embedding_model_name=embedding_model_name,
    )
    client = await _connect_temporal(settings.temporal_host, settings.temporal_namespace)
    activities = IngestionActivities(ingestion)
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            ArchWikiIngestionWorkflow,
            WikipediaIngestionWorkflow,
            FilesystemIngestionWorkflow,
            FileIngestionWorkflow,
        ],
        activities=[activities.run_ingestion_job],
    )
    await worker.run()


async def _connect_temporal(host: str, namespace: str) -> Client:
    last_error = None
    for attempt in range(1, 31):
        try:
            return await Client.connect(host, namespace=namespace)
        except Exception as exc:
            last_error = exc
            logger.warning("temporal.connect.retry host=%s attempt=%s error=%s", host, attempt, exc)
            await asyncio.sleep(min(attempt, 5))
    raise RuntimeError(f"Failed to connect to Temporal at {host}: {last_error}")


if __name__ == "__main__":
    asyncio.run(main())
