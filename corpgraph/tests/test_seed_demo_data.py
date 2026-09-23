"""Product-level guarantees for the deterministic rich demo graph."""

from collections.abc import AsyncIterator
from typing import Any

import pytest

from corpgraph import seed_demo_data
from corpgraph.api.config import ApiSettings
from corpgraph.seed_demo_data import build_demo_dataset, chunks, relationship_query


def test_demo_dataset_is_large_dense_and_rich() -> None:
    companies, people, relationships = build_demo_dataset()
    assert len(companies) == 510
    assert len(people) == 60
    assert sum(map(len, relationships.values())) == 740
    assert set(relationships) == {
        "OWNS",
        "HAS_SUBSIDIARY",
        "DIRECTOR_OF",
        "SUPPLIER_TO",
        "CO_PATENT_HOLDER",
    }
    assert all(company["demo_seed"] is True for company in companies)
    assert all(company["sources"] == ["demo_seed"] for company in companies)
    assert all("deduplication_confidence" in company for company in companies)
    assert all(person["board_seats"] == 3 for person in people)
    assert all(person["risk_flags"] == ["INTERLOCKING_DIRECTOR"] for person in people)
    assert len({str(company["entity_id"]) for company in companies}) == 510


def test_chunking_is_bounded_and_complete() -> None:
    records: list[dict[str, object]] = [{"value": value} for value in range(5)]
    assert list(chunks(records, 2)) == [records[:2], records[2:4], records[4:]]


@pytest.mark.parametrize(
    "relationship_type",
    ["OWNS", "HAS_SUBSIDIARY", "DIRECTOR_OF", "SUPPLIER_TO", "CO_PATENT_HOLDER"],
)
def test_relationship_queries_are_allowlisted(relationship_type: str) -> None:
    query = relationship_query(relationship_type)
    assert f"edge:{relationship_type}" in query
    assert "$rows" in query


def test_relationship_query_rejects_dynamic_type() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        relationship_query("DELETE")


@pytest.mark.parametrize("invalid", [0, -1])
def test_chunks_with_invalid_size_do_not_loop(invalid: int) -> None:
    with pytest.raises(ValueError, match="positive"):
        list(chunks([{"value": 1}], invalid))


@pytest.mark.asyncio
@pytest.mark.parametrize(("replace_demo", "cache_keys"), [(True, ["corpgraph:one"]), (False, [])])
async def test_seed_batches_graph_and_invalidates_cache(
    monkeypatch: pytest.MonkeyPatch, replace_demo: bool, cache_keys: list[str]
) -> None:
    statements: list[tuple[str, dict[str, Any]]] = []

    class Session:
        async def __aenter__(self) -> "Session":
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def run(self, query: str, **parameters: Any) -> None:
            statements.append((query, parameters))

    class Driver:
        verified = False
        closed = False

        async def verify_connectivity(self) -> None:
            self.verified = True

        def session(self, **_: object) -> Session:
            return Session()

        async def close(self) -> None:
            self.closed = True

    class Cache:
        deleted: tuple[str, ...] = ()
        closed = False

        async def scan_iter(self, **_: object) -> AsyncIterator[str]:
            for key in cache_keys:
                yield key

        async def delete(self, *keys: str) -> None:
            self.deleted = keys

        async def aclose(self) -> None:
            self.closed = True

    driver = Driver()
    cache = Cache()
    monkeypatch.setattr(
        seed_demo_data.AsyncGraphDatabase, "driver", lambda *_args, **_kwargs: driver
    )
    monkeypatch.setattr(seed_demo_data.Redis, "from_url", lambda *_args, **_kwargs: cache)
    result = await seed_demo_data.seed(ApiSettings(), replace_demo=replace_demo, batch_size=200)
    assert result == {"companies": 510, "people": 60, "relationships": 740}
    assert driver.verified and driver.closed and cache.closed
    assert cache.deleted == tuple(cache_keys)
    assert any("MERGE (node:Company" in query for query, _ in statements)
    assert any("edge:DIRECTOR_OF" in query for query, _ in statements)
    assert any("DETACH DELETE" in query for query, _ in statements) is replace_demo


def test_cli_reports_seed_counts(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def fake_seed(
        _settings: ApiSettings, *, replace_demo: bool, batch_size: int
    ) -> dict[str, int]:
        assert replace_demo and batch_size == 50
        return {"companies": 510, "people": 60, "relationships": 740}

    monkeypatch.setattr(seed_demo_data, "seed", fake_seed)
    monkeypatch.setattr("sys.argv", ["corpgraph-seed-demo", "--replace-demo", "--batch-size", "50"])
    seed_demo_data.main()
    assert "Seeded 510 companies, 60 people, and 740 relationships." in capsys.readouterr().out


def test_cli_rejects_invalid_batch_size(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("sys.argv", ["corpgraph-seed-demo", "--batch-size", "0"])
    with pytest.raises(SystemExit, match="must be positive"):
        seed_demo_data.main()
