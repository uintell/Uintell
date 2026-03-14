from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

import httpx


class MeiliSearchService:
    def __init__(
        self,
        *,
        url: str,
        index_name: str,
        api_key: str | None = None,
    ) -> None:
        self._url = url.rstrip("/")
        self._index = index_name
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async def ensure_index(self) -> None:
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers) as client:
            response = await client.get(f"{self._url}/indexes/{self._index}")
            if response.status_code == 404:
                create = await client.post(
                    f"{self._url}/indexes",
                    json={"uid": self._index, "primaryKey": "id"},
                )
                create.raise_for_status()
            elif response.is_error:
                response.raise_for_status()

            settings = {
                "searchableAttributes": ["title", "summary", "plain_text", "tags", "source_type", "source_name"],
                "filterableAttributes": ["source_type", "source_name", "document_kind", "tags"],
                "sortableAttributes": ["updated_at", "title"],
                "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
            }
            update = await client.patch(f"{self._url}/indexes/{self._index}/settings", json=settings)
            update.raise_for_status()

    async def upsert_documents(self, documents: Sequence[object]) -> None:
        if not documents:
            return
        payload = [self._serialize_document(document) for document in documents]
        async with httpx.AsyncClient(timeout=60.0, headers=self._headers) as client:
            response = await client.post(f"{self._url}/indexes/{self._index}/documents", json=payload)
            response.raise_for_status()

    async def search(
        self,
        *,
        query: str,
        source_types: Sequence[str] | None,
        limit: int,
    ) -> list[str]:
        filters: list[str] = []
        if source_types:
            quoted = ", ".join(f'"{value}"' for value in source_types)
            filters.append(f"source_type IN [{quoted}]")
        async with httpx.AsyncClient(timeout=30.0, headers=self._headers) as client:
            response = await client.post(
                f"{self._url}/indexes/{self._index}/search",
                json={
                    "q": query,
                    "limit": limit,
                    "filter": filters or None,
                    "attributesToRetrieve": ["id"],
                },
            )
            response.raise_for_status()
            payload = response.json()
        return [str(hit["id"]) for hit in payload.get("hits", []) if hit.get("id")]

    @staticmethod
    def _serialize_document(document: object) -> dict[str, object]:
        return {
            "id": str(document.id),
            "title": document.title,
            "summary": document.summary or "",
            "plain_text": document.plain_text or "",
            "tags": list(document.tags_json or []),
            "source_type": document.source_type,
            "source_name": document.source_name,
            "document_kind": document.document_kind,
            "slug": document.slug,
            "updated_at": _isoformat(document.updated_at),
        }


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
