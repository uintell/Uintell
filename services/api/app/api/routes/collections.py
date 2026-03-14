from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, require_user
from app.repositories.collections import CollectionRepository
from app.schemas.knowledge import (
    CollectionCreateRequest,
    CollectionItemCreateRequest,
    CollectionItemResponse,
    CollectionResponse,
)

router = APIRouter(prefix="/v1/collections", tags=["collections"])


@router.get("", response_model=list[CollectionResponse])
async def list_collections(
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> list[CollectionResponse]:
    collections = await CollectionRepository().list_collections(db, owner_user_id=user.id)
    return [_to_collection_response(collection) for collection in collections]


@router.post("", response_model=CollectionResponse)
async def create_collection(
    payload: CollectionCreateRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionResponse:
    collection = await CollectionRepository().create_collection(
        db,
        owner_user_id=user.id,
        title=payload.title,
        description=payload.description,
        metadata=payload.metadata,
    )
    await db.commit()
    return _to_collection_response(collection)


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionResponse:
    collection = await CollectionRepository().get_collection(db, collection_id)
    if collection is None or collection.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return _to_collection_response(collection)


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: UUID,
    payload: CollectionCreateRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionResponse:
    collection = await CollectionRepository().get_collection(db, collection_id)
    if collection is None or collection.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    collection = await CollectionRepository().update_collection(
        db,
        collection=collection,
        title=payload.title,
        description=payload.description,
        metadata=payload.metadata,
    )
    await db.commit()
    return _to_collection_response(collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    collection = await CollectionRepository().get_collection(db, collection_id)
    if collection is None or collection.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    await CollectionRepository().delete_collection(db, collection)
    await db.commit()


@router.post("/{collection_id}/items", response_model=CollectionItemResponse)
async def add_collection_item(
    collection_id: UUID,
    payload: CollectionItemCreateRequest,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> CollectionItemResponse:
    if payload.document_id is None and payload.note_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A document_id or note_id is required")
    collection = await CollectionRepository().get_collection(db, collection_id)
    if collection is None or collection.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    item = await CollectionRepository().add_item(
        db,
        collection_id=collection_id,
        document_id=payload.document_id,
        note_id=payload.note_id,
        sort_order=payload.sort_order,
    )
    await db.commit()
    return _to_collection_item_response(item)


@router.delete("/{collection_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collection_item(
    collection_id: UUID,
    item_id: UUID,
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    collection = await CollectionRepository().get_collection(db, collection_id)
    if collection is None or collection.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    item = await CollectionRepository().get_item(db, item_id)
    if item is None or item.collection_id != collection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection item not found")
    await CollectionRepository().remove_item(db, item)
    await db.commit()


def _to_collection_response(collection) -> CollectionResponse:
    return CollectionResponse(
        id=collection.id,
        title=collection.title,
        slug=collection.slug,
        description=collection.description,
        metadata=collection.metadata_json,
        items=[_to_collection_item_response(item) for item in sorted(collection.items, key=lambda row: (row.sort_order, row.created_at))],
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


def _to_collection_item_response(item) -> CollectionItemResponse:
    return CollectionItemResponse(
        id=item.id,
        document_id=item.document_id,
        note_id=item.note_id,
        sort_order=item.sort_order,
        created_at=item.created_at,
    )
