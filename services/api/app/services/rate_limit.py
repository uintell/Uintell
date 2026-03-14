from __future__ import annotations

import asyncio
from collections import deque
from time import monotonic

from redis.asyncio import Redis


class RateLimiter:
    def __init__(self, redis: Redis | None, *, limit: int, window_seconds: int) -> None:
        self._redis = redis
        self._limit = limit
        self._window_seconds = window_seconds
        self._lock = asyncio.Lock()
        self._local_buckets: dict[str, deque[float]] = {}

    async def is_limited(self, key: str) -> bool:
        if self._redis is not None:
            return await self._is_limited_redis(key)
        return await self._is_limited_local(key)

    async def _is_limited_redis(self, key: str) -> bool:
        current = await self._redis.incr(key)
        if current == 1:
            await self._redis.expire(key, self._window_seconds)
        return current > self._limit

    async def _is_limited_local(self, key: str) -> bool:
        now = monotonic()
        async with self._lock:
            bucket = self._local_buckets.setdefault(key, deque())
            while bucket and (now - bucket[0]) >= self._window_seconds:
                bucket.popleft()
            if len(bucket) >= self._limit:
                return True
            bucket.append(now)
            return False
