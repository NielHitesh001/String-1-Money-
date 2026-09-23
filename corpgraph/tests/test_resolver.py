import json
import time
from pathlib import Path

import pytest

from corpgraph.entity_resolution.resolver import (
    EntityResolutionPipeline,
    _run,
    assign_entity_id,
    assign_entity_ids,
    load_entities,
    resolve_entities,
    resolve_extraction_document,
)
from corpgraph.models import Company, ExtractionResult, Provenance, Relationship


def sample_entities() -> list[dict[str, object]]:
    return [
        {
            "name": "Tesla, Inc.",
            "jurisdiction": "Delaware",
            "registration_number": "1318605",
            "source": "sec_edgar",
        },
        {
            "name": "Tesla Motors",
            "jurisdiction": "DE",
            "registration_num": "001318605",
            "source": "opencorporates",
        },
        {"name": "Apple Inc.", "jurisdiction": "California", "source": "sec_edgar"},
    ]


def test_resolve_entities_merges_duplicates_with_audit_trail() -> None:
    resolved, audit = resolve_entities(sample_entities())
    assert len(resolved) == 2
    tesla = next(entity for entity in resolved if "Tesla, Inc." in entity["aliases"])
    assert tesla["entity_id"].startswith("ent_")
    assert tesla["sources"] == ["opencorporates", "sec_edgar"]
    assert len(audit) == 3
    assert min(entry[2] for entry in audit) >= 0.85


def test_resolution_is_deterministic_across_input_order() -> None:
    forward, _ = resolve_entities(sample_entities())
    reverse, _ = resolve_entities(list(reversed(sample_entities())))
    assert sorted(item["entity_id"] for item in forward) == sorted(
        item["entity_id"] for item in reverse
    )


def test_assign_entity_id_prefers_registration_number() -> None:
    first = {"name": "Old Name", "registration_number": "00123"}
    second = {"name": "New Name", "registration_number": "123"}
    assert assign_entity_id(first) == assign_entity_id(second)


def test_assign_entity_ids_merges_missing_fields() -> None:
    merged = assign_entity_ids(
        [{"name": "Acme Inc."}, {"name": "Acme", "jurisdiction": "Delaware"}], [[0, 1]]
    )
    assert merged[0]["jurisdiction"] == "Delaware"
    assert merged[0]["aliases"] == ["Acme", "Acme Inc."]


def test_resolver_rejects_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="threshold"):
        resolve_entities([], 1.1)
    with pytest.raises(ValueError, match="requires"):
        resolve_entities([{"jurisdiction": "Delaware"}])


def test_empty_resolution() -> None:
    assert resolve_entities([]) == ([], [])


@pytest.mark.asyncio
async def test_pipeline_yields_results_and_reports_metrics() -> None:
    pipeline = EntityResolutionPipeline()
    result = [item async for item in pipeline.resolve_batch(sample_entities(), batch_size=1)]
    report = pipeline.get_resolution_report()
    assert len(result) == 2
    assert report["total_entities"] == 3
    assert report["unique_entities"] == 2
    assert report["deduplication_rate"] == pytest.approx(1 / 3, abs=1e-6)


@pytest.mark.asyncio
async def test_pipeline_rejects_invalid_batch_size() -> None:
    pipeline = EntityResolutionPipeline()
    with pytest.raises(ValueError, match="batch_size"):
        async for _ in pipeline.resolve_batch(sample_entities(), batch_size=0):
            pass


def test_blocking_keeps_large_unique_dataset_fast() -> None:
    entities = [{"name": f"Company {index}", "jurisdiction": "CA"} for index in range(10_000)]
    started = time.perf_counter()
    resolved, _ = resolve_entities(entities)
    assert time.perf_counter() - started < 30
    assert len(resolved) == 10_000


def test_load_entities_supports_list_and_phase_one_document(tmp_path: Path) -> None:
    list_path = tmp_path / "list.json"
    list_path.write_text(json.dumps([{"name": "Acme"}]), encoding="utf-8")
    assert load_entities(list_path)[0]["name"] == "Acme"

    phase_one_path = tmp_path / "phase-one.json"
    phase_one_path.write_text(json.dumps({"companies": [{"legal_name": "Beta"}]}), encoding="utf-8")
    assert load_entities(phase_one_path)[0]["legal_name"] == "Beta"


def test_load_entities_rejects_invalid_documents(tmp_path: Path) -> None:
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps({"items": []}), encoding="utf-8")
    with pytest.raises(ValueError, match="companies"):
        load_entities(path)
    path.write_text(json.dumps(["not an object"]), encoding="utf-8")
    with pytest.raises(ValueError, match="JSON object"):
        load_entities(path)


def test_resolve_extraction_rewrites_relationship_ids() -> None:
    provenance = Provenance(
        source="sec_edgar",
        source_url="https://www.sec.gov/example",
        accession_number="0001-25-000001",
        filing_date="2025-01-01",
    )
    document = ExtractionResult(
        companies=[
            Company(entity_id="old-parent", legal_name="Parent Inc.", provenance=provenance),
            Company(entity_id="old-child", legal_name="Child LLC", provenance=provenance),
        ],
        relationships=[
            Relationship(
                relationship_id="old-rel",
                relationship_type="HAS_SUBSIDIARY",
                from_entity_id="old-parent",
                to_entity_id="old-child",
                confidence=1,
                provenance=provenance,
            )
        ],
    )
    resolved = resolve_extraction_document(document.model_dump(mode="json"))
    assert resolved.relationships[0].from_entity_id == resolved.companies[0].entity_id
    assert resolved.relationships[0].to_entity_id == resolved.companies[1].entity_id
    assert resolved.relationships[0].relationship_id != "old-rel"
    assert resolved.companies[0].sources == ["sec_edgar"]


@pytest.mark.asyncio
async def test_cli_runner_writes_list_resolution(tmp_path: Path) -> None:
    input_path = tmp_path / "input.json"
    output_path = tmp_path / "output.json"
    input_path.write_text(json.dumps(sample_entities()), encoding="utf-8")
    await _run(input_path, output_path, 0.85)
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert len(payload["entities"]) == 2
    assert payload["report"]["deduplication_rate"] == pytest.approx(1 / 3, abs=1e-6)


@pytest.mark.asyncio
async def test_cli_runner_preserves_extraction_contract(tmp_path: Path) -> None:
    provenance = {
        "source": "sec_edgar",
        "source_url": "https://www.sec.gov/example",
        "accession_number": "0001-25-000001",
        "filing_date": "2025-01-01",
        "collected_at": "2025-01-02T00:00:00Z",
    }
    input_path = tmp_path / "input.json"
    output_path = tmp_path / "output.json"
    input_path.write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "companies": [
                    {"entity_id": "old", "legal_name": "Acme Inc.", "provenance": provenance}
                ],
                "relationships": [],
            }
        ),
        encoding="utf-8",
    )
    await _run(input_path, output_path, 0.85)
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == "1.0"
    assert payload["companies"][0]["entity_id"].startswith("ent_")
