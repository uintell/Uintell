from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.api.dependencies import get_container
from app.services.container import ServiceContainer

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(container: ServiceContainer = Depends(get_container)) -> dict[str, str]:
    async with container.session_factory() as db:
        await db.execute(text("select 1"))
    await container.redis.ping()
    await container.qdrant.get_collections()
    return {"status": "ready"}
