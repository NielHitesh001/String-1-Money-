"""Asynchronous Redis cache with deterministic, namespaced keys."""

from __future__ import annotations

from collections.abc import Awaitable
from hashlib import sha256
from typing import Any, Self, cast

from redis.asyncio import Redis
from redis.exceptions import RedisError

_INCREMENT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
"""


class CacheError(RuntimeError):
    """Raised when Redis cannot complete a cache operation."""


class CacheLayer:
    """Manage Redis lifecycle and UTF-8 string cache operations."""

    def __init__(self, redis_url: str = "redis://localhost:6379", *, client: Redis | None = None):
        self._client = client or Redis.from_url(redis_url, decode_responses=True)
        self._connected = False

    async def __aenter__(self) -> Self:
        await self.connect()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()

    async def connect(self) -> None:
        """Verify Redis connectivity; repeated calls are idempotent."""
        if self._connected:
            return
        try:
            await self._client.ping()
        except RedisError as exc:
            raise CacheError("Unable to connect to Redis") from exc
        self._connected = True

    async def close(self) -> None:
        """Close the Redis pool; repeated calls are safe."""
        if not self._connected:
            return
        await self._client.aclose()
        self._connected = False

    async def health_check(self) -> bool:
        """Return Redis readiness without leaking connection details."""
        self._require_connection()
        try:
            return bool(await self._client.ping())
        except RedisError as exc:
            raise CacheError("Redis health check failed") from exc

    async def get(self, key: str) -> str | None:
        """Return a cached string or ``None`` for a miss."""
        self._require_connection()
        try:
            value = await self._client.get(key)
        except RedisError as exc:
            raise CacheError("Redis get failed") from exc
        if value is None:
            return None
        return value.decode() if isinstance(value, bytes) else str(value)

    async def set(self, key: str, value: str, ttl_seconds: int = 3600) -> None:
        """Cache a string with a positive expiration time."""
        self._require_connection()
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        try:
            await self._client.set(key, value, ex=ttl_seconds)
        except RedisError as exc:
            raise CacheError("Redis set failed") from exc

    async def invalidate(self, key: str) -> None:
        """Delete a cache entry if present."""
        self._require_connection()
        try:
            await self._client.delete(key)
        except RedisError as exc:
            raise CacheError("Redis invalidate failed") from exc

    async def increment(self, key: str, window_seconds: int) -> int:
        """Atomically increment a fixed-window counter and assign its first TTL."""
        self._require_connection()
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        try:
            operation = cast(
                Awaitable[Any],
                self._client.eval(_INCREMENT_SCRIPT, 1, key, str(window_seconds)),
            )
            result = await operation
        except RedisError as exc:
            raise CacheError("Redis increment failed") from exc
        if not isinstance(result, int):
            raise CacheError("Redis increment returned an invalid counter")
        return result

    @staticmethod
    def key(namespace: str, *parts: object) -> str:
        """Build a compact key without exposing raw user input to Redis keyspace."""
        if not namespace or not namespace.replace("_", "").isalnum():
            raise ValueError("namespace must be alphanumeric")
        canonical = "\x1f".join(str(part) for part in parts)
        return f"corpgraph:{namespace}:{sha256(canonical.encode()).hexdigest()[:24]}"

    def _require_connection(self) -> None:
        if not self._connected:
            raise CacheError("Redis cache is not connected")
