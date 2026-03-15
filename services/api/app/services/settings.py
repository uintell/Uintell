from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.repositories.system import SystemRepository


class SettingsService:
    def __init__(self, *, settings: Settings, system_repository: SystemRepository) -> None:
        self._settings = settings
        self._system = system_repository

    async def get_values(self, db: AsyncSession) -> dict[str, dict]:
        generation_model = self._settings.ollama_model if self._settings.generation_provider == "ollama" else self._settings.openai_model
        embedding_model = (
            self._settings.ollama_embedding_model
            if self._settings.embedding_provider == "ollama"
            else self._settings.openai_embedding_model
        )
        defaults = {
            "provider": {
                "backend": self._settings.generation_provider,
                "model": generation_model,
                "enable_openai_generation": self._settings.enable_openai_generation,
                "enable_tool_calling": self._settings.enable_tool_calling,
                "temperature": self._settings.openai_temperature,
            },
            "embeddings": {
                "backend": self._settings.embedding_provider,
                "model": embedding_model,
                "collection": self._settings.qdrant_collection,
            },
            "rag": {"top_k": self._settings.rag_top_k, "context_char_limit": self._settings.rag_context_char_limit},
            "sources": {"profiles": self._default_source_profiles()},
        }
        stored = await self._system.get_settings(db)
        defaults.update(stored)
        return defaults

    async def update_values(self, db: AsyncSession, *, values: dict[str, dict], updated_by_user_id: UUID | None) -> None:
        await self._system.upsert_settings(db, values=values, updated_by_user_id=updated_by_user_id)

    async def get_source_profiles(self, db: AsyncSession) -> list[dict[str, Any]]:
        values = await self.get_values(db)
        sources = values.get("sources") or {}
        profiles = sources.get("profiles") if isinstance(sources, dict) else None
        if not isinstance(profiles, list):
            return []
        return [profile for profile in profiles if isinstance(profile, dict)]

    async def get_source_profile(self, db: AsyncSession, profile_id: str) -> dict[str, Any] | None:
        for profile in await self.get_source_profiles(db):
            if profile.get("id") == profile_id:
                return profile
        return None

    def _default_source_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "demo-notes",
                "label": "Demo notes",
                "description": "Seed markdown notes bundled with the app for immediate testing.",
                "source_type": "filesystem",
                "source_name": "demo_notes",
                "target_path": "/workspace/data/demo/notes",
                "document_kind": "note",
                "tags": ["demo", "notes"],
                "enabled": True,
            },
            {
                "id": "demo-library",
                "label": "Demo library",
                "description": "Sample long-form documents that behave like book chapters or essays.",
                "source_type": "filesystem",
                "source_name": "demo_library",
                "target_path": "/workspace/data/demo/library",
                "document_kind": "book",
                "tags": ["demo", "library"],
                "enabled": True,
            },
            {
                "id": "local-notes",
                "label": "Local notes folder",
                "description": "Import your own markdown or text notes from a local path.",
                "source_type": "filesystem",
                "source_name": "local_notes",
                "target_path": "/workspace/data/local-docs/notes",
                "document_kind": "note",
                "tags": ["notes"],
                "enabled": False,
            },
            {
                "id": "local-library",
                "label": "Local books folder",
                "description": "Import EPUB, PDF, markdown, and text books from a local path.",
                "source_type": "filesystem",
                "source_name": "local_books",
                "target_path": "/workspace/data/local-docs/library",
                "document_kind": "book",
                "tags": ["books"],
                "enabled": False,
            },
            {
                "id": "wikipedia-dump",
                "label": "Wikipedia dump",
                "description": "Register a local Wikipedia XML dump path when you want to ingest it.",
                "source_type": "wikipedia",
                "source_name": "english_wikipedia",
                "target_path": "/workspace/data/imports/wikipedia/enwiki-latest-pages-articles-multistream.xml.bz2",
                "document_kind": "article",
                "tags": ["wikipedia"],
                "enabled": False,
            },
        ]
