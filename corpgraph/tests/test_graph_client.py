import asyncio
from collections.abc import Mapping
from typing import Any, cast

import pytest
from neo4j import AsyncDriver, Query
from neo4j.exceptions import ClientError, ServiceUnavailable

from corpgraph.api.graph_client import (
    GraphConnectionError,
    GraphQueryError,
    GraphQueryTimeout,
    Neo4jClient,
)


class FakeResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def data(self) -> list[dict[str, Any]]:
        return self.rows


class FakeSession:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = outcomes
        self.calls: list[tuple[Query, Mapping[str, object]]] = []

    async def __aenter__(self) -> "FakeSession":
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def run(self, query: Query, params: Mapping[str, object]) -> FakeResult:
        self.calls.append((query, params))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        if outcome == "slow":
            await asyncio.sleep(0.05)
            return FakeResult([])
        return FakeResult(cast(list[dict[str, Any]], outcome))


class FakeDriver:
    def __init__(self, outcomes: list[object], verify_error: Exception | None = None) -> None:
        self.session_instance = FakeSession(outcomes)
        self.verify_error = verify_error
        self.verify_calls = 0
        self.close_calls = 0
        self.session_databases: list[str] = []

    async def verify_connectivity(self) -> None:
        self.verify_calls += 1
        if self.verify_error:
            raise self.verify_error

    async def close(self) -> None:
        self.close_calls += 1

    def session(self, *, database: str) -> FakeSession:
        self.session_databases.append(database)
        return self.session_instance


def client_with(driver: FakeDriver, **kwargs: object) -> Neo4jClient:
    return Neo4jClient(
        "bolt://example.test",
        ("neo4j", "password"),
        driver=cast(AsyncDriver, driver),
        retry_backoff_seconds=0,
        **kwargs,
    )


@pytest.mark.asyncio
async def test_context_manager_connects_executes_and_closes() -> None:
    driver = FakeDriver([[{"company": {"entity_id": "ent_1"}}]])
    async with client_with(driver) as client:
        rows = await client.execute_query(
            "MATCH (company:Company {entity_id: $id}) RETURN company",
            {"id": "ent_1"},
        )
        await client.connect()
    assert rows[0]["company"]["entity_id"] == "ent_1"
    assert driver.verify_calls == 1
    assert driver.close_calls == 1
    assert driver.session_databases == ["neo4j"]
    query, params = driver.session_instance.calls[0]
    assert "$id" in query.text
    assert query.timeout == 30
    assert params == {"id": "ent_1"}


@pytest.mark.asyncio
async def test_connect_wraps_driver_error() -> None:
    client = client_with(FakeDriver([], ServiceUnavailable("down")))
    with pytest.raises(GraphConnectionError, match="connect"):
        await client.connect()


@pytest.mark.asyncio
async def test_close_before_connect_is_safe() -> None:
    driver = FakeDriver([])
    await client_with(driver).close()
    assert driver.close_calls == 0


@pytest.mark.asyncio
async def test_execute_requires_connection() -> None:
    with pytest.raises(GraphConnectionError, match="not connected"):
        await client_with(FakeDriver([])).execute_query("RETURN 1")


@pytest.mark.asyncio
async def test_execute_validates_timeout_and_read_only_query() -> None:
    client = client_with(FakeDriver([]))
    await client.connect()
    with pytest.raises(ValueError, match="timeout_ms"):
        await client.execute_query("RETURN 1", timeout_ms=0)
    with pytest.raises(ValueError, match="read-only"):
        await client.execute_query("MATCH (n) DELETE n")


@pytest.mark.asyncio
async def test_transient_failure_is_retried() -> None:
    driver = FakeDriver([ServiceUnavailable("down"), [{"value": 1}]])
    client = client_with(driver, max_retries=1)
    await client.connect()
    assert await client.execute_query("RETURN 1 AS value") == [{"value": 1}]
    assert len(driver.session_instance.calls) == 2


@pytest.mark.asyncio
async def test_retry_exhaustion_becomes_connection_error() -> None:
    driver = FakeDriver([ServiceUnavailable("down"), ServiceUnavailable("still down")])
    client = client_with(driver, max_retries=1)
    await client.connect()
    with pytest.raises(GraphConnectionError, match="after retries"):
        await client.execute_query("RETURN 1")


@pytest.mark.asyncio
async def test_non_retryable_neo4j_error_becomes_query_error() -> None:
    client = client_with(FakeDriver([ClientError("bad query")]))
    await client.connect()
    with pytest.raises(GraphQueryError, match="rejected"):
        await client.execute_query("RETURN 1")


@pytest.mark.asyncio
async def test_wall_clock_timeout_is_enforced() -> None:
    client = client_with(FakeDriver(["slow"]))
    await client.connect()
    with pytest.raises(GraphQueryTimeout, match="exceeded"):
        await client.execute_query("RETURN 1", timeout_ms=1)


@pytest.mark.asyncio
async def test_get_node_count_and_allowlist() -> None:
    driver = FakeDriver([[{"count": 7}], [], [{"count": "invalid"}]])
    client = client_with(driver)
    await client.connect()
    assert await client.get_node_count("Company") == 7
    assert await client.get_node_count("Person") == 0
    assert await client.get_node_count("Address") == 0
    with pytest.raises(ValueError, match="allowlisted"):
        await client.get_node_count("Company`) MATCH (n) DELETE n //")


@pytest.mark.asyncio
async def test_health_check_states() -> None:
    disconnected = client_with(FakeDriver([]))
    assert not await disconnected.health_check()

    healthy = client_with(FakeDriver([[{"healthy": 1}]]))
    await healthy.connect()
    assert await healthy.health_check()

    unhealthy = client_with(FakeDriver([ServiceUnavailable("down")]), max_retries=0)
    await unhealthy.connect()
    assert not await unhealthy.health_check()

    wrong_result = client_with(FakeDriver([[{"healthy": 0}]]))
    await wrong_result.connect()
    assert not await wrong_result.health_check()


def test_constructor_rejects_negative_retries() -> None:
    with pytest.raises(ValueError, match="max_retries"):
        Neo4jClient("bolt://example.test", ("neo4j", "password"), max_retries=-1)
