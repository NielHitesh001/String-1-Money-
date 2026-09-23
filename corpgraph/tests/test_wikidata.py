"""Tests for source-attributed Wikidata corporate collection and loading."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
import pytest

from corpgraph.api.config import ApiSettings
from corpgraph.common.base_scraper import ScraperError
from corpgraph.scrapers import wikidata
from corpgraph.scrapers.wikidata import WikidataCollector


def item_claim(entity_id: str) -> dict[str, object]:
    return {
        "rank": "normal",
        "mainsnak": {
            "snaktype": "value",
            "datavalue": {"value": {"id": entity_id}},
        },
    }


def value_claim(value: object, *, rank: str = "normal") -> dict[str, object]:
    return {
        "rank": rank,
        "mainsnak": {"snaktype": "value", "datavalue": {"value": value}},
    }


def entity(
    label: str, claims: dict[str, list[dict[str, object]]] | None = None
) -> dict[str, object]:
    return {
        "labels": {"en": {"value": label}},
        "descriptions": {"en": {"value": f"Description for {label}"}},
        "aliases": {"en": [{"value": f"{label} alias"}]},
        "claims": claims or {},
    }


@pytest.fixture
def wikidata_entities() -> dict[str, dict[str, object]]:
    root_claims = {
        wikidata.SUBSIDIARY: [
            item_claim("Q2"),
            item_claim("Q2"),
            value_claim({"id": "Q999"}, rank="deprecated"),
        ],
        wikidata.COUNTRY: [item_claim("Q30")],
        wikidata.INDUSTRY: [item_claim("Q100")],
        wikidata.HEADQUARTERS: [item_claim("Q200")],
        wikidata.LEGAL_FORM: [item_claim("Q300")],
        wikidata.CEO: [item_claim("Q400")],
        wikidata.CHAIRPERSON: [item_claim("Q401")],
        wikidata.WEBSITE: [value_claim("https://acme.example")],
        wikidata.LEI: [value_claim("LEI-ACME")],
        wikidata.EMPLOYEES: [value_claim({"amount": "+1234"})],
        wikidata.INCEPTION: [value_claim({"time": "+1999-06-15T00:00:00Z", "precision": 11})],
    }
    return {
        "Q1": entity("Acme Corporation", root_claims),
        "Q2": entity("Acme Subsidiary"),
        "Q30": entity("United States"),
        "Q100": entity("Technology"),
        "Q200": entity("New York City"),
        "Q300": entity("public company"),
        "Q400": entity("Ada Executive"),
        "Q401": entity("Grace Chair"),
    }


@pytest.mark.asyncio
async def test_collects_rich_companies_officers_and_relationships(
    wikidata_entities: dict[str, dict[str, object]],
) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        ids = request.url.params["ids"].split("|")
        return httpx.Response(
            200,
            json={"entities": {entity_id: wikidata_entities[entity_id] for entity_id in ids}},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        async with WikidataCollector(
            "CorpGraph/Test (https://example.test)", client=client
        ) as collector:
            companies, people, relationships = await collector.collect(["Q1"], depth=2)
    assert len(companies) == 2
    assert len(people) == 2
    assert companies[0]["jurisdiction"] == "United States"
    assert companies[0]["industry"] == "Technology"
    assert companies[0]["employee_count"] == 1234
    assert companies[0]["incorporation_date"] == "1999-06-15"
    assert companies[0]["source_license"] == "CC0-1.0"
    assert len(relationships["HAS_SUBSIDIARY"]) == 1
    assert len(relationships["OFFICER_AT"]) == 2
    assert relationships["OFFICER_AT"][0]["officer_title"] in {
        "Chief Executive Officer",
        "Chairperson",
    }
    assert len(
        {edge["relationship_id"] for edge in relationships["OFFICER_AT"]}
    ) == 2


@pytest.mark.asyncio
async def test_fetch_validation_and_api_errors() -> None:
    async def error_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": {"code": "maxlag"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(error_handler)) as client:
        collector = WikidataCollector("CorpGraph/Test (https://example.test)", client=client)
        with pytest.raises(ValueError, match="Invalid Wikidata"):
            await collector.fetch_entities(["not-a-qid"])
        with pytest.raises(ScraperError, match="error response"):
            await collector.fetch_entities(["Q1"])


@pytest.mark.asyncio
async def test_fetch_rejects_invalid_entity_map() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"entities": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        collector = WikidataCollector("CorpGraph/Test (https://example.test)", client=client)
        with pytest.raises(ScraperError, match="invalid"):
            await collector.fetch_entities(["Q1"])


def test_claim_helpers_handle_invalid_and_partial_values() -> None:
    malformed: dict[str, Any] = {
        "claims": {
            "P": [
                None,
                {"mainsnak": {}},
                value_claim("not-a-quantity"),
                value_claim({"amount": "bad"}),
                value_claim({"amount": "-2"}),
            ],
            wikidata.INCEPTION: [
                value_claim("not-a-date"),
                value_claim({"time": 123, "precision": 11}),
                value_claim({"time": "malformed", "precision": 11}),
                value_claim({"time": "+2001-09-00T00:00:00Z", "precision": 10}),
                value_claim({"time": "+2001-00-00T00:00:00Z", "precision": 9}),
            ],
        }
    }
    assert wikidata.claim_values({"claims": []}, "P") == []
    assert wikidata.claim_values({"claims": {"P": "bad"}}, "P") == []
    assert wikidata.linked_ids(malformed, "P") == []
    assert wikidata.quantity_integer(malformed, "P") is None
    assert wikidata.claim_date(malformed, wikidata.INCEPTION) == "2001-09-01"
    malformed["claims"][wikidata.INCEPTION] = [
        value_claim({"time": "+2001-00-00T00:00:00Z", "precision": 9})
    ]
    assert wikidata.claim_date(malformed, wikidata.INCEPTION) == "2001-01-01"
    assert wikidata.claim_date({}, wikidata.INCEPTION) is None
    assert wikidata.english_value({}, "labels", "fallback") == "fallback"
    assert wikidata.scalar_string({}, wikidata.LEI) is None


@pytest.mark.parametrize(("depth", "maximum"), [(-1, 10), (4, 10), (1, 0), (1, 2001)])
@pytest.mark.asyncio
async def test_collection_bounds(depth: int, maximum: int) -> None:
    collector = WikidataCollector("CorpGraph/Test (https://example.test)")
    with pytest.raises(ValueError):
        await collector.collect([], depth=depth, max_entities=maximum)
    await collector.__aexit__()


@pytest.mark.parametrize("size", [0, 51])
def test_batch_bounds(size: int) -> None:
    with pytest.raises(ValueError, match="between 1 and 50"):
        list(wikidata.batches(["Q1"], size))


def test_public_relationship_query_allowlist() -> None:
    assert "source:Person" in wikidata.public_relationship_query("OFFICER_AT")
    assert "source:Company" in wikidata.public_relationship_query("HAS_SUBSIDIARY")
    with pytest.raises(ValueError, match="Unsupported"):
        wikidata.public_relationship_query("DELETE")


def test_snapshot_is_auditable(tmp_path: Path) -> None:
    output = tmp_path / "snapshot.json"
    wikidata.write_snapshot(output, [{"entity_id": "wikidata_Q1"}], [], {})
    payload = json.loads(output.read_text())
    assert payload["schema_version"] == "2.0"
    assert payload["source_license"] == "CC0-1.0"


@pytest.mark.asyncio
@pytest.mark.parametrize(("replace", "keys"), [(True, ["corpgraph:key"]), (False, [])])
async def test_public_loader_is_idempotent_and_cache_aware(
    monkeypatch: pytest.MonkeyPatch, replace: bool, keys: list[str]
) -> None:
    statements: list[str] = []

    class Session:
        async def __aenter__(self) -> Session:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def run(self, query: str, **_parameters: Any) -> None:
            statements.append(query)

    class Driver:
        async def verify_connectivity(self) -> None:
            return None

        def session(self, **_: object) -> Session:
            return Session()

        async def close(self) -> None:
            return None

    class Cache:
        deleted: tuple[str, ...] = ()

        async def scan_iter(self, **_: object) -> AsyncIterator[str]:
            for key in keys:
                yield key

        async def delete(self, *found: str) -> None:
            self.deleted = found

        async def aclose(self) -> None:
            return None

    cache = Cache()
    monkeypatch.setattr(wikidata.AsyncGraphDatabase, "driver", lambda *_args, **_kwargs: Driver())
    monkeypatch.setattr(wikidata.Redis, "from_url", lambda *_args, **_kwargs: cache)
    result = await wikidata.load_public_data(
        ApiSettings(),
        [{"entity_id": "wikidata_Q1"}],
        [{"entity_id": "wikidata_Q2"}],
        {"HAS_SUBSIDIARY": [{"relationship_id": "one"}]},
        replace_wikidata=replace,
    )
    assert result == {"companies": 1, "people": 1, "relationships": 1}
    assert cache.deleted == tuple(keys)
    assert any("DETACH DELETE" in statement for statement in statements) is replace


@pytest.mark.asyncio
async def test_run_uses_overrides_and_loads(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class Collector:
        def __init__(self, user_agent: str) -> None:
            assert "CorpGraph" in user_agent

        async def __aenter__(self) -> Collector:
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def collect(
            self, roots: object, *, depth: int, max_entities: int
        ) -> tuple[Any, Any, Any]:
            assert list(roots) == ["Q1"] and depth == 1 and max_entities == 10
            return ([{"entity_id": "wikidata_Q1"}], [], {})

    async def loader(*_args: object, **kwargs: object) -> dict[str, int]:
        assert kwargs["replace_wikidata"] is True
        return {"companies": 1, "people": 0, "relationships": 0}

    monkeypatch.setattr(wikidata, "WikidataCollector", Collector)
    monkeypatch.setattr(wikidata, "load_public_data", loader)
    args = argparse.Namespace(
        roots=["Q1"],
        depth=1,
        max_entities=10,
        replace_wikidata=True,
        output=tmp_path / "public.json",
    )
    assert await wikidata.run(args) == {"companies": 1, "people": 0, "relationships": 0}
    assert args.output.exists()


def test_parse_args_exposes_collection_controls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "corpgraph-wikidata",
            "--root",
            "Q1",
            "--depth",
            "1",
            "--max-entities",
            "25",
            "--replace-wikidata",
            "--output",
            "public.json",
        ],
    )
    args = wikidata.parse_args()
    assert args.roots == ["Q1"]
    assert args.depth == 1
    assert args.max_entities == 25
    assert args.replace_wikidata is True
    assert args.output == Path("public.json")


def test_main_reports_loaded_counts(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    args = argparse.Namespace()

    async def fake_run(received: argparse.Namespace) -> dict[str, int]:
        assert received is args
        return {"companies": 3, "people": 2, "relationships": 4}

    monkeypatch.setattr(wikidata, "parse_args", lambda: args)
    monkeypatch.setattr(wikidata, "run", fake_run)
    wikidata.main()
    assert capsys.readouterr().out == (
        "Loaded 3 public companies, 2 public officers, "
        "and 4 attributed relationships.\n"
    )
