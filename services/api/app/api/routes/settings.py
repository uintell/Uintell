from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_container, get_db, require_admin, require_user
from app.schemas.settings import SettingsResponse, UpdateSettingsRequest
from app.services.container import ServiceContainer

router = APIRouter(prefix="/v1/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    user=Depends(require_user),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> SettingsResponse:
    values = await container.app_settings.get_values(db)
    return SettingsResponse(values=values)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    payload: UpdateSettingsRequest,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> SettingsResponse:
    await container.app_settings.update_values(db, values=payload.values, updated_by_user_id=user.id)
    await db.commit()
    values = await container.app_settings.get_values(db)
    return SettingsResponse(values=values)
