"""Pooled asynchronous Neo4j client for read-only API queries."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any, Self

from neo4j import AsyncDriver, AsyncGraphDatabase, Query
from neo4j.exceptions import Neo4jError, ServiceUnavailable, SessionExpired, TransientError

from corpgraph.api.query_builder import SafeQueryBuilder

RETRYABLE_ERRORS = (ServiceUnavailable, SessionExpired, TransientError)
ALLOWED_NODE_LABELS = frozenset({"Address", "Company", "Person"})


class GraphClientError(RuntimeError):
    """Base exception for controlled graph-client failures."""


class GraphConnectionError(GraphClientError):
    """Raised when Neo4j connectivity cannot be established or recovered."""


class GraphQueryError(GraphClientError):
    """Raised when Neo4j rejects a query."""


class GraphQueryTimeout(TimeoutError, GraphClientError):
    """Raised when a query exceeds its configured wall-clock deadline."""


class Neo4jClient:
    """Manage a pooled Neo4j driver and execute bounded read-only queries."""

    def __init__(
        self,
        uri: str,
        auth: tuple[str, str],
        *,
        database: str = "neo4j",
        max_connection_pool_size: int = 50,
        connection_timeout_seconds: float = 10,
        max_retries: int = 2,
        retry_backoff_seconds: float = 0.1,
        driver: AsyncDriver | None = None,
    ) -> None:
        if max_retries < 0:
            raise ValueError("max_retries must not be negative")
        self._database = database
        self._max_retries = max_retries
        self._retry_backoff_seconds = retry_backoff_seconds
        self._driver = driver or AsyncGraphDatabase.driver(
            uri,
            auth=auth,
            max_connection_pool_size=max_connection_pool_size,
            connection_timeout=connection_timeout_seconds,
        )
        self._connected = False

    async def __aenter__(self) -> Self:
        await self.connect()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()

    async def connect(self) -> None:
        """Verify database connectivity; repeated calls are idempotent."""
        if self._connected:
            return
        try:
            await self._driver.verify_connectivity()
        except (Neo4jError, *RETRYABLE_ERRORS) as exc:
            raise GraphConnectionError("Unable to connect to Neo4j") from exc
        self._connected = True

    async def close(self) -> None:
        """Close the pooled driver; repeated calls are safe."""
        if not self._connected:
            return
        await self._driver.close()
        self._connected = False

    async def execute_query(
        self,
        query: str,
        params: Mapping[str, object] | None = None,
        timeout_ms: int = 30_000,
    ) -> list[dict[str, Any]]:
        """Execute a parameterized read query with retry and timeout boundaries."""
        if not self._connected:
            raise GraphConnectionError("Neo4j client is not connected")
        if not 1 <= timeout_ms <= 30_000:
            raise ValueError("timeout_ms must be between 1 and 30000")
        if not SafeQueryBuilder.validate_query(query):
            raise ValueError("query must be a single read-only Cypher statement")

        for attempt in range(self._max_retries + 1):
            try:
                async with asyncio.timeout(timeout_ms / 1000):
                    async with self._driver.session(database=self._database) as session:
                        result = await session.run(
                            Query(query, timeout=timeout_ms / 1000), dict(params or {})
                        )
                        return list(await result.data())
            except TimeoutError as exc:
                raise GraphQueryTimeout(f"Neo4j query exceeded {timeout_ms}ms") from exc
            except RETRYABLE_ERRORS as exc:
                if attempt == self._max_retries:
                    raise GraphConnectionError("Neo4j query failed after retries") from exc
                await asyncio.sleep(self._retry_backoff_seconds * (2**attempt))
            except Neo4jError as exc:
                raise GraphQueryError("Neo4j rejected the query") from exc
        raise GraphConnectionError("Neo4j query failed")  # pragma: no cover

    async def get_node_count(self, label: str) -> int:
        """Count nodes for one allowlisted schema label."""
        if label not in ALLOWED_NODE_LABELS:
            raise ValueError("label is not allowlisted")
        rows = await self.execute_query(f"MATCH (node:{label}) RETURN count(node) AS count")
        if not rows:
            return 0
        value = rows[0].get("count", 0)
        return int(value) if isinstance(value, int | float) else 0

    async def health_check(self) -> bool:
        """Return database readiness without leaking driver exceptions."""
        if not self._connected:
            return False
        try:
            rows = await self.execute_query("RETURN 1 AS healthy", timeout_ms=1_000)
        except GraphClientError:
            return False
        return bool(rows and rows[0].get("healthy") == 1)
