from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, require_user
from app.models.entities import UserRole
from app.repositories.auth import AuthRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.container import ServiceContainer
from app.api.dependencies import get_container

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> UserResponse:
    repository = AuthRepository()
    existing = await repository.get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")
    user = await repository.create_user(
        db,
        email=payload.email,
        password_hash=container.security.hash_password(payload.password),
        display_name=payload.display_name,
        role=UserRole.MEMBER.value,
    )
    await db.commit()
    return UserResponse.model_validate(user)


@router.post("/login", response_model=UserResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> UserResponse:
    repository = AuthRepository()
    user = await repository.get_user_by_email(db, payload.email)
    if user is None or not container.security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token, token_hash, expires_at = container.security.issue_session_token()
    await repository.create_session(
        db,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    response.set_cookie(
        key=container.settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=container.settings.secure_cookies,
        samesite="lax",
        expires=int(expires_at.timestamp()),
    )
    return UserResponse.model_validate(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    container: ServiceContainer = Depends(get_container),
) -> dict[str, bool]:
    token = request.cookies.get(container.settings.auth_cookie_name)
    if token:
        repository = AuthRepository()
        await repository.delete_session(db, container.security.hash_session_token(token))
        await db.commit()
    response.delete_cookie(container.settings.auth_cookie_name)
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(require_user)) -> UserResponse:
    return UserResponse.model_validate(user)
