from typing import cast

import pytest
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

from corpgraph.api.cache import CacheError, CacheLayer


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str | bytes] = {}
        self.expirations: dict[str, int] = {}
        self.pings = 0
        self.closes = 0
        self.error: Exception | None = None

    def fail_if_needed(self) -> None:
        if self.error:
            error, self.error = self.error, None
            raise error

    async def ping(self) -> bool:
        self.pings += 1
        self.fail_if_needed()
        return True

    async def aclose(self) -> None:
        self.closes += 1

    async def get(self, key: str) -> str | bytes | None:
        self.fail_if_needed()
        return self.values.get(key)

    async def set(self, key: str, value: str, *, ex: int) -> bool:
        self.fail_if_needed()
        self.values[key] = value
        self.expirations[key] = ex
        return True

    async def delete(self, key: str) -> int:
        self.fail_if_needed()
        return int(self.values.pop(key, None) is not None)

    async def eval(self, _script: str, _keys: int, key: str, window: str) -> int:
        self.fail_if_needed()
        value = int(self.values.get(key, "0")) + 1
        self.values[key] = str(value)
        self.expirations.setdefault(key, int(window))
        return value


def layer(fake: FakeRedis) -> CacheLayer:
    return CacheLayer(client=cast(Redis, fake))


@pytest.mark.asyncio
async def test_lifecycle_and_cache_operations() -> None:
    fake = FakeRedis()
    async with layer(fake) as cache:
        await cache.connect()
        assert await cache.health_check() is True
        assert await cache.get("missing") is None
        await cache.set("company:1", "value", ttl_seconds=60)
        assert await cache.get("company:1") == "value"
        fake.values["bytes"] = b"decoded"
        assert await cache.get("bytes") == "decoded"
        await cache.invalidate("company:1")
        assert await cache.get("company:1") is None
        assert await cache.increment("rate:1", 60) == 1
        assert await cache.increment("rate:1", 60) == 2
    assert fake.pings == 2
    assert fake.closes == 1
    assert fake.expirations["company:1"] == 60


@pytest.mark.asyncio
async def test_close_before_connect_is_safe() -> None:
    fake = FakeRedis()
    await layer(fake).close()
    assert fake.closes == 0


@pytest.mark.asyncio
async def test_operations_require_connection() -> None:
    cache = layer(FakeRedis())
    with pytest.raises(CacheError, match="not connected"):
        await cache.health_check()
    with pytest.raises(CacheError, match="not connected"):
        await cache.get("key")
    with pytest.raises(CacheError, match="not connected"):
        await cache.set("key", "value")
    with pytest.raises(CacheError, match="not connected"):
        await cache.invalidate("key")
    with pytest.raises(CacheError, match="not connected"):
        await cache.increment("key", 60)


@pytest.mark.asyncio
async def test_ttl_must_be_positive() -> None:
    cache = layer(FakeRedis())
    await cache.connect()
    with pytest.raises(ValueError, match="positive"):
        await cache.set("key", "value", 0)
    with pytest.raises(ValueError, match="positive"):
        await cache.increment("key", 0)


@pytest.mark.asyncio
async def test_connect_error_is_wrapped() -> None:
    fake = FakeRedis()
    fake.error = RedisConnectionError("down")
    with pytest.raises(CacheError, match="connect"):
        await layer(fake).connect()


@pytest.mark.asyncio
async def test_health_error_is_wrapped() -> None:
    fake = FakeRedis()
    cache = layer(fake)
    await cache.connect()
    fake.error = RedisConnectionError("down")
    with pytest.raises(CacheError, match="health check"):
        await cache.health_check()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["get", "set", "invalidate", "increment"])
async def test_operation_errors_are_wrapped(operation: str) -> None:
    fake = FakeRedis()
    cache = layer(fake)
    await cache.connect()
    fake.error = RedisConnectionError("down")
    with pytest.raises(CacheError, match=f"Redis {operation}"):
        if operation == "get":
            await cache.get("key")
        elif operation == "set":
            await cache.set("key", "value")
        elif operation == "invalidate":
            await cache.invalidate("key")
        else:
            await cache.increment("key", 60)


@pytest.mark.asyncio
async def test_increment_rejects_invalid_counter() -> None:
    fake = FakeRedis()
    cache = layer(fake)
    await cache.connect()
    async def invalid_eval(*_args: object) -> str:
        return "invalid"

    fake.eval = invalid_eval  # type: ignore[method-assign]
    with pytest.raises(CacheError, match="invalid counter"):
        await cache.increment("key", 60)


def test_key_is_deterministic_and_hides_input() -> None:
    first = CacheLayer.key("company", "ent_1")
    assert first == CacheLayer.key("company", "ent_1")
    assert first != CacheLayer.key("company", "ent_2")
    assert "ent_1" not in first
    with pytest.raises(ValueError, match="namespace"):
        CacheLayer.key("bad:namespace", "value")
