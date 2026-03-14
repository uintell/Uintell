from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Collection, CollectionItem
from knowledge_engine.utils import slugify


class CollectionRepository:
    async def list_collections(self, db: AsyncSession, *, owner_user_id: UUID | None, limit: int = 100) -> list[Collection]:
        statement = select(Collection).options(selectinload(Collection.items)).order_by(Collection.updated_at.desc()).limit(limit)
        if owner_user_id is not None:
            statement = statement.where(Collection.owner_user_id == owner_user_id)
        result = await db.execute(statement)
        return list(result.scalars().all())

    async def get_collection(self, db: AsyncSession, collection_id: UUID) -> Collection | None:
        result = await db.execute(
            select(Collection).options(selectinload(Collection.items)).where(Collection.id == collection_id)
        )
        return result.scalar_one_or_none()

    async def create_collection(
        self,
        db: AsyncSession,
        *,
        owner_user_id: UUID | None,
        title: str,
        description: str | None,
        metadata: dict,
    ) -> Collection:
        collection = Collection(
            owner_user_id=owner_user_id,
            title=title,
            slug=slugify(title),
            description=description,
            metadata_json=metadata,
        )
        db.add(collection)
        await db.flush()
        return collection

    async def update_collection(
        self,
        db: AsyncSession,
        *,
        collection: Collection,
        title: str,
        description: str | None,
        metadata: dict,
    ) -> Collection:
        collection.title = title
        collection.slug = slugify(title)
        collection.description = description
        collection.metadata_json = metadata
        await db.flush()
        return collection

    async def delete_collection(self, db: AsyncSession, collection: Collection) -> None:
        await db.delete(collection)
        await db.flush()

    async def add_item(
        self,
        db: AsyncSession,
        *,
        collection_id: UUID,
        document_id: UUID | None,
        note_id: UUID | None,
        sort_order: int,
    ) -> CollectionItem:
        item = CollectionItem(
            collection_id=collection_id,
            document_id=document_id,
            note_id=note_id,
            sort_order=sort_order,
        )
        db.add(item)
        await db.flush()
        return item

    async def remove_item(self, db: AsyncSession, item: CollectionItem) -> None:
        await db.delete(item)
        await db.flush()

    async def get_item(self, db: AsyncSession, item_id: UUID) -> CollectionItem | None:
        return await db.get(CollectionItem, item_id)
