from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.models.entities import UserRole
from app.repositories.admin import AdminRepository
from app.repositories.auth import AuthRepository
from app.services.security import SecurityService
from app.services.settings import SettingsService


async def main() -> None:
    settings = get_settings()
    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)
    security = SecurityService(settings.session_ttl_hours)
    legacy_seed_email = "admin@uintell.local"

    async with session_factory() as db:
        auth = AuthRepository()
        admin = await auth.get_user_by_email(db, settings.seed_admin_email)
        if admin is None and settings.seed_admin_email != legacy_seed_email:
            admin = await auth.get_user_by_email(db, legacy_seed_email)
            if admin is not None:
                admin.email = settings.seed_admin_email
                admin.display_name = "Administrator"
                admin.role = UserRole.ADMIN.value
        if admin is None:
            await auth.create_user(
                db,
                email=settings.seed_admin_email,
                password_hash=security.hash_password(settings.seed_admin_password),
                display_name="Administrator",
                role=UserRole.ADMIN.value,
            )

        app_settings = SettingsService(settings=settings, admin_repository=AdminRepository())
        default_values = await app_settings.get_values(db)
        await app_settings.update_values(
            db,
            values=default_values,
            updated_by_user_id=None,
        )
        await db.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
