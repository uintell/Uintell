from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: str = "development"
    app_name: str = "United Intelligence API"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    web_origin: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/uintell"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "knowledge_chunks"
    qdrant_api_key: str | None = None
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_api_key: str | None = None
    meilisearch_index: str = "documents"

    temporal_host: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "knowledge-ingestion"

    file_storage_backend: str = "local"
    local_storage_root: Path = Path("/workspace/var/storage")
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_embedding_dimensions: int = 768

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 256
    openai_base_url: str | None = None
    openai_temperature: float = 0.2
    openai_max_output_tokens: int = 900

    generation_provider: str = "ollama"
    embedding_provider: str = "ollama"
    enable_openai_generation: bool = True
    enable_tool_calling: bool = True
    system_prompt: str = (
        "You are United Intelligence, a technical AI assistant grounded in verified offline sources. "
        "Answer in the same language as the user's question unless the user explicitly asks for another language. "
        "Use only the provided context. If evidence is missing or conflicting, say so clearly. "
        "Every important claim must cite one or more source labels like [S1]."
    )

    auth_cookie_name: str = "uintell_session"
    session_ttl_hours: int = 24 * 14
    secure_cookies: bool = False
    password_min_length: int = 12

    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60
    max_upload_bytes: int = 20 * 1024 * 1024

    rag_top_k: int = 6
    rag_context_char_limit: int = 12_000
    retrieval_fusion_limit: int = 12

    archwiki_root: Path = Path("/usr/share/doc/arch-wiki/html/en")
    wikipedia_dump_path: Path = Path("/workspace/enwiki-latest-pages-articles-multistream.xml.bz2")
    local_docs_root: Path = Path("/workspace/data/local-docs")

    otlp_endpoint: str | None = None
    otel_service_name: str = "uintell-api"

    seed_admin_email: str = "admin@uintell.org"
    seed_admin_password: str = "ChangeMeNow123!"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uploads_root(self) -> Path:
        return self.local_storage_root / "uploads"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
