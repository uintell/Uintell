from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.admin import AdminRepository
from app.repositories.documents import DocumentRepository
from app.services.providers import ToolDefinition
from app.services.retrieval import RetrievalService


class ToolRegistry:
    def __init__(
        self,
        *,
        retrieval_service: RetrievalService,
        document_repository: DocumentRepository,
        admin_repository: AdminRepository,
    ) -> None:
        self._retrieval = retrieval_service
        self._documents = document_repository
        self._admin = admin_repository

    def definitions(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="search_knowledge",
                description="Search indexed offline knowledge sources for relevant passages.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "source_types": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            ),
            ToolDefinition(
                name="get_document",
                description="Fetch metadata for a specific indexed document by UUID.",
                parameters={
                    "type": "object",
                    "properties": {"document_id": {"type": "string"}},
                    "required": ["document_id"],
                    "additionalProperties": False,
                },
            ),
        ]

    async def execute(
        self,
        db: AsyncSession,
        *,
        conversation_id: UUID | None,
        name: str,
        arguments: dict,
    ) -> dict:
        try:
            if name == "search_knowledge":
                results = await self._retrieval.search(
                    db,
                    query=arguments["query"],
                    source_types=arguments.get("source_types"),
                    limit=5,
                )
                payload = {
                    "results": [
                        {
                            "chunk_id": item.chunk_id,
                            "document_id": item.document_id,
                            "title": item.article_title,
                            "section_title": item.section_title,
                            "excerpt": item.content[:500],
                            "path_or_url": item.path_or_url,
                            "source_type": item.source_type.value,
                        }
                        for item in results
                    ]
                }
            elif name == "get_document":
                document = await self._documents.get_document(db, UUID(arguments["document_id"]))
                payload = {
                    "document": None
                    if document is None
                    else {
                        "id": str(document.id),
                        "title": document.title,
                        "source_type": document.source_type,
                        "path_or_url": document.path_or_url,
                        "status": document.status,
                    }
                }
            else:
                raise ValueError(f"Unknown tool: {name}")
            await self._admin.record_tool_execution(
                db,
                conversation_id=conversation_id,
                tool_name=name,
                status="succeeded",
                tool_input=arguments,
                tool_output=payload,
            )
            return payload
        except Exception as exc:
            await self._admin.record_tool_execution(
                db,
                conversation_id=conversation_id,
                tool_name=name,
                status="failed",
                tool_input=arguments,
                tool_output={},
                error_message=str(exc),
            )
            raise
