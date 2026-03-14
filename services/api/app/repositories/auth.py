from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Session, User


class AuthRepository:
    async def get_user_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, db: AsyncSession, user_id: UUID) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create_user(
        self,
        db: AsyncSession,
        *,
        email: str,
        password_hash: str,
        display_name: str,
        role: str,
    ) -> User:
        user = User(email=email.lower(), password_hash=password_hash, display_name=display_name, role=role)
        db.add(user)
        await db.flush()
        return user

    async def create_session(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> Session:
        session = Session(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(session)
        await db.flush()
        return session

    async def get_session_by_token_hash(self, db: AsyncSession, token_hash: str) -> Session | None:
        result = await db.execute(select(Session).where(Session.token_hash == token_hash))
        return result.scalar_one_or_none()

    async def delete_session(self, db: AsyncSession, token_hash: str) -> None:
        await db.execute(delete(Session).where(Session.token_hash == token_hash))
