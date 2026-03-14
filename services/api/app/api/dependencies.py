from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import User
from app.repositories.auth import AuthRepository
from app.services.container import ServiceContainer


def get_container(request: Request) -> ServiceContainer:
    return request.app.state.container


async def get_db(container: Annotated[ServiceContainer, Depends(get_container)]):
    async with container.session_factory() as session:
        yield session


async def require_user(
    request: Request,
    container: Annotated[ServiceContainer, Depends(get_container)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = request.cookies.get(container.settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    token_hash = container.security.hash_session_token(token)
    repository = AuthRepository()
    session_row = await repository.get_session_by_token_hash(db, token_hash)
    if session_row is None or session_row.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = await repository.get_user_by_id(db, session_row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    session_row.last_seen_at = datetime.now(UTC)
    return user


async def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
