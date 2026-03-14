from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher


class SecurityService:
    def __init__(self, session_ttl_hours: int) -> None:
        self._password_hasher = PasswordHasher()
        self._session_ttl = timedelta(hours=session_ttl_hours)

    def hash_password(self, password: str) -> str:
        return self._password_hasher.hash(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            return self._password_hasher.verify(password_hash, password)
        except Exception:
            return False

    def issue_session_token(self) -> tuple[str, str, datetime]:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires_at = datetime.now(UTC) + self._session_ttl
        return token, token_hash, expires_at

    def hash_session_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()
