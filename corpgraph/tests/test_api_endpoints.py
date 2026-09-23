from collections.abc import Mapping
from typing import Any

import pytest
from fastapi.testclient import TestClient

from corpgraph.api.cache import CacheError
from corpgraph.api.config import ApiSettings
from corpgraph.api.graph_client import GraphConnectionError, GraphQueryError, GraphQueryTimeout
from corpgraph.api.main import create_app


class FakeGraphClient:
    def __init__(self) -> None:
        self.connected = 0
        self.closed = 0
        self.healthy = True
        self.next_error: Exception | None = None
        self.invalid_company = False
        self.calls: list[tuple[str, Mapping[str, object], int]] = []

    async def connect(self) -> None:
        self.connected += 1

    async def close(self) -> None:
        self.closed += 1

    async def health_check(self) -> bool:
        if self.next_error:
            error, self.next_error = self.next_error, None
            raise error
        return self.healthy

    async def execute_query(
        self,
        query: str,
        params: Mapping[str, object] | None = None,
        timeout_ms: int = 30_000,
    ) -> list[dict[str, Any]]:
        parameters = params or {}
        self.calls.append((query, parameters, timeout_ms))
        if self.next_error:
            error, self.next_error = self.next_error, None
            raise error
        if "count(company)" in query:
            return [{"companies": 2, "people": 1, "relationships": 1}]
        if "fulltext.queryNodes" in query:
            return [{"company": company("ent_1", "Acme Inc."), "score": 0.9}]
        if "MATCH path" in query:
            return [
                {
                    "related": company("ent_2", "Acme Child LLC"),
                    "nodes": [company("ent_1", "Acme Inc."), company("ent_2", "Acme Child LLC")],
                    "relationships": [
                        {
                            "type": "HAS_SUBSIDIARY",
                            "edge_id": "edge-1",
                            "source": "ent_1",
                            "target": "ent_2",
                            "properties": {
                                "confidence": 1.0,
                                "ownership_percentage": 100.0,
                            },
                        }
                    ],
                    "depth": 1,
                }
            ]
        if parameters.get("entity_id") == "missing":
            return []
        if "RETURN company" in query:
            record = "invalid" if self.invalid_company else company("ent_1", "Acme Inc.")
            return [{"company": record}]
        return []


class FakeCache:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.connected = 0
        self.closed = 0
        self.counters: dict[str, int] = {}

    async def connect(self) -> None:
        self.connected += 1

    async def close(self) -> None:
        self.closed += 1

    async def health_check(self) -> bool:
        return True

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str, ttl_seconds: int = 3600) -> None:
        self.values[key] = value

    async def increment(self, key: str, window_seconds: int) -> int:
        assert window_seconds == 60
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]


class ErrorCache(FakeCache):
    async def get(self, key: str) -> str | None:
        raise CacheError("redis unavailable")


def application(fake: FakeGraphClient, settings: ApiSettings | None = None) -> Any:
    return create_app(settings=settings, graph_client=fake, cache_layer=FakeCache())


def company(entity_id: str, name: str) -> dict[str, object]:
    return {
        "entity_id": entity_id,
        "legal_name": name,
        "jurisdiction": "Delaware",
        "registration_number": "123",
        "aliases": [name],
        "sources": ["sec_edgar"],
        "source_url": "https://www.sec.gov/example",
        "source_license": "public-domain",
        "collected_at": "2026-09-23T00:00:00Z",
        "entity_type": "Operating Subsidiary",
        "deduplication_confidence": 0.98,
        "risk_flags": ["RELATED_PARTY_EXPOSURE"],
    }


def test_all_endpoints_and_lifecycle() -> None:
    fake = FakeGraphClient()
    cache = FakeCache()
    app = create_app(ApiSettings(query_timeout_ms=2500), fake, cache)
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "healthy"}
        assert client.get("/ready").json() == {
            "status": "ready",
            "services": {"neo4j": "healthy", "redis": "healthy"},
        }

        stats = client.get("/api/stats")
        assert stats.status_code == 200
        assert stats.json()["companies"] == 2

        detail = client.get("/api/company/ent_1")
        assert detail.status_code == 200
        assert detail.json()["name"] == "Acme Inc."
        assert detail.json()["registration_num"] == "123"
        assert detail.json()["source_url"] == "https://www.sec.gov/example"
        assert detail.json()["collected_at"] == "2026-09-23T00:00:00Z"

        search = client.get("/api/search", params={"q": "Acme", "limit": 5})
        assert search.status_code == 200
        assert len(search.json()) == 1

        master = client.get("/api/companies", params={"limit": 500})
        assert master.status_code == 200
        assert master.json()[0]["name"] == "Acme Inc."

        network = client.get(
            "/api/company/ent_1/relationships",
            params={"depth": 2, "relationship_type": "HAS_SUBSIDIARY"},
        )
        assert network.status_code == 200
        assert network.json()["total_nodes"] == 2
        assert network.json()["total_relationships"] == 1
        assert len(network.json()["related"][0]["nodes"]) == 2
        assert network.json()["nodes"][1]["category"] == "Subsidiary"
        assert network.json()["links"][0]["ownership_percentage"] == 100.0
        assert network.json()["summary"]["companies"] == 2
    assert fake.connected == 1
    assert fake.closed == 1
    assert cache.connected == 1
    assert cache.closed == 1
    assert all(call[2] == 2500 for call in fake.calls)


def test_not_found_and_empty_stats() -> None:
    fake = FakeGraphClient()

    async def empty_execute(
        query: str, params: Mapping[str, object] | None = None, timeout_ms: int = 30_000
    ) -> list[dict[str, Any]]:
        return []

    fake.execute_query = empty_execute  # type: ignore[method-assign]
    with TestClient(application(fake)) as client:
        assert client.get("/api/company/missing").status_code == 404
        assert client.get("/api/company/missing/relationships").status_code == 404
        stats = client.get("/api/stats").json()
        assert stats["companies"] == 0
        assert stats["relationships"] == 0


def test_unhealthy_database_returns_503() -> None:
    fake = FakeGraphClient()
    fake.healthy = False
    with TestClient(application(fake)) as client:
        response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


@pytest.mark.parametrize(
    ("error", "status", "detail"),
    [
        (GraphConnectionError("down"), 503, "Graph database unavailable"),
        (GraphQueryTimeout("slow"), 504, "Graph query timed out"),
        (GraphQueryError("bad"), 500, "Graph query failed"),
    ],
)
def test_graph_errors_are_sanitized(error: Exception, status: int, detail: str) -> None:
    fake = FakeGraphClient()
    fake.next_error = error
    with TestClient(application(fake), raise_server_exceptions=False) as client:
        response = client.get("/api/stats")
    assert response.status_code == status
    assert response.json() == {"detail": detail}


def test_health_connection_error_is_sanitized() -> None:
    fake = FakeGraphClient()
    fake.next_error = GraphConnectionError("secret connection detail")
    with TestClient(application(fake), raise_server_exceptions=False) as client:
        response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"detail": "Graph database unavailable"}


def test_invalid_database_record_becomes_sanitized_query_error() -> None:
    fake = FakeGraphClient()
    fake.invalid_company = True
    with TestClient(application(fake), raise_server_exceptions=False) as client:
        response = client.get("/api/company/ent_1")
    assert response.status_code == 500
    assert response.json() == {"detail": "Graph query failed"}


@pytest.mark.parametrize(
    "path",
    [
        "/api/search?q=A",
        "/api/search?q=Acme&limit=101",
        "/api/company/ent_1/relationships?depth=6",
        "/api/company/ent_1/relationships?limit=1001",
        "/api/company/ent_1/relationships?relationship_type=DELETE",
    ],
)
def test_request_validation(path: str) -> None:
    fake = FakeGraphClient()
    with TestClient(application(fake)) as client:
        response = client.get(path)
    assert response.status_code == 422


def test_openapi_documentation_is_available() -> None:
    fake = FakeGraphClient()
    with TestClient(application(fake)) as client:
        schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "CorpGraph API"
    assert len(schema["paths"]) == 7
    assert "/api/companies" in schema["paths"]


def test_api_key_rate_limit_and_cors() -> None:
    fake = FakeGraphClient()
    settings = ApiSettings(
        api_key="a" * 32,
        rate_limit_per_minute=1,
        cors_origins=("https://app.example",),
    )
    with TestClient(create_app(settings, fake, FakeCache())) as client:
        assert client.get("/api/stats").status_code == 401
        allowed = client.get(
            "/api/stats",
            headers={"Authorization": f"Bearer {'a' * 32}"},
        )
        assert allowed.status_code == 200
        assert allowed.headers["x-ratelimit-limit"] == "1"
        assert allowed.headers["x-ratelimit-remaining"] == "0"
        limited = client.get(
            "/api/stats",
            headers={"X-API-Key": "a" * 32},
        )
        assert limited.status_code == 429
        assert limited.headers["retry-after"] == "60"
        preflight = client.options(
            "/api/stats",
            headers={
                "Origin": "https://app.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == "https://app.example"
        assert client.options("/api/stats").status_code == 405
        assert client.get("/health").status_code == 200


def test_rate_limiter_failure_is_sanitized() -> None:
    class BrokenRateCache(FakeCache):
        async def increment(self, key: str, window_seconds: int) -> int:
            raise CacheError("down")

    with TestClient(
        create_app(graph_client=FakeGraphClient(), cache_layer=BrokenRateCache())
    ) as client:
        response = client.get("/api/stats")
    assert response.status_code == 503
    assert response.json() == {"detail": "Rate limiter unavailable"}


def test_metrics_are_low_cardinality_and_readiness_checks_redis() -> None:
    class UnreadyCache(FakeCache):
        async def health_check(self) -> bool:
            return False

    with TestClient(
        create_app(graph_client=FakeGraphClient(), cache_layer=UnreadyCache())
    ) as client:
        assert client.get("/api/company/secret-company-id").status_code == 200
        readiness = client.get("/ready")
        assert readiness.status_code == 503
        metrics = client.get("/metrics")
    assert "secret-company-id" not in metrics.text
    assert 'route="/api/company/{entity_id}"' in metrics.text
    assert 'status="200"' in metrics.text
    assert 'route="/ready"' in metrics.text


def test_company_search_and_network_cache_hits_skip_graph_queries() -> None:
    fake = FakeGraphClient()
    cache = FakeCache()
    with TestClient(create_app(graph_client=fake, cache_layer=cache)) as client:
        paths = [
            "/api/company/ent_1",
            "/api/search?q=Acme",
            "/api/company/ent_1/relationships",
        ]
        for path in paths:
            assert client.get(path).status_code == 200
        query_count = len(fake.calls)
        for path in paths:
            assert client.get(path).status_code == 200
    assert len(fake.calls) == query_count


def test_cache_errors_are_sanitized() -> None:
    fake = FakeGraphClient()
    with TestClient(
        create_app(graph_client=fake, cache_layer=ErrorCache()),
        raise_server_exceptions=False,
    ) as client:
        response = client.get("/api/company/ent_1")
    assert response.status_code == 503
    assert response.json() == {"detail": "Cache unavailable"}
