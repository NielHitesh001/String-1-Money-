"""Deterministic company clustering and command-line resolution pipeline."""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator, Mapping, Sequence
from hashlib import sha256
from pathlib import Path
from typing import Any

from corpgraph.entity_resolution.matcher import calculate_match_confidence
from corpgraph.entity_resolution.normalizer import (
    extract_registration_number,
    normalize_company_name,
    normalize_jurisdiction,
)
from corpgraph.models import ExtractionResult, stable_id

Entity = dict[str, Any]
AuditEntry = tuple[int, int, float]


class _UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: int, right: int) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root != right_root:
            self.parent[max(left_root, right_root)] = min(left_root, right_root)


def _value(entity: Mapping[str, object], *keys: str) -> str:
    for key in keys:
        value = entity.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def assign_entity_id(entity: Mapping[str, object]) -> str:
    """Assign a stable ID from registration evidence or normalized identity fields."""
    registration = extract_registration_number(
        _value(entity, "registration_number", "registration_num", "registration_id")
    )
    name = normalize_company_name(_value(entity, "name", "legal_name"))
    jurisdiction = normalize_jurisdiction(_value(entity, "jurisdiction"))
    identity = f"registration:{registration}" if registration else f"name:{name}|{jurisdiction}"
    return f"ent_{sha256(identity.encode()).hexdigest()[:12]}"


def _candidate_pairs(entities: Sequence[Mapping[str, object]]) -> set[tuple[int, int]]:
    """Generate blocking-based candidates and avoid quadratic all-pairs comparisons."""
    exact_names: dict[str, list[int]] = defaultdict(list)
    registrations: dict[str, list[int]] = defaultdict(list)
    token_blocks: dict[str, list[int]] = defaultdict(list)
    normalized_names: list[str] = []
    for index, entity in enumerate(entities):
        normalized = normalize_company_name(_value(entity, "name", "legal_name"))
        normalized_names.append(normalized)
        if normalized:
            exact_names[normalized].append(index)
            token_blocks[normalized.split()[0]].append(index)
        registration = extract_registration_number(
            _value(entity, "registration_number", "registration_num", "registration_id")
        )
        if registration:
            registrations[registration].append(index)

    pairs: set[tuple[int, int]] = set()

    def add_group(group: Sequence[int]) -> None:
        for position, left in enumerate(group):
            for right in group[position + 1 :]:
                pairs.add((min(left, right), max(left, right)))

    for group in [*exact_names.values(), *registrations.values()]:
        add_group(group)
    for group in token_blocks.values():
        if len(group) <= 256:
            add_group(group)
            continue
        prefix_blocks: dict[str, list[int]] = defaultdict(list)
        for index in group:
            prefix_blocks[normalized_names[index][:16]].append(index)
        for prefix_group in prefix_blocks.values():
            add_group(prefix_group)
    return pairs


def _clusters(union_find: _UnionFind, size: int) -> list[list[int]]:
    grouped: dict[int, list[int]] = defaultdict(list)
    for index in range(size):
        grouped[union_find.find(index)].append(index)
    return sorted((sorted(group) for group in grouped.values()), key=lambda group: group[0])


def _merge_cluster(entities: Sequence[Entity], members: Sequence[int]) -> Entity:
    ranked = sorted(
        (entities[index] for index in members),
        key=lambda entity: (
            -sum(value not in (None, "", [], {}) for value in entity.values()),
            len(normalize_company_name(_value(entity, "name", "legal_name"))),
            normalize_company_name(_value(entity, "name", "legal_name")),
        ),
    )
    merged = dict(ranked[0])
    for entity in ranked[1:]:
        for key, value in entity.items():
            if merged.get(key) in (None, "", [], {}) and value not in (None, "", [], {}):
                merged[key] = value
    aliases = sorted(
        {
            _value(entity, "name", "legal_name")
            for entity in ranked
            if _value(entity, "name", "legal_name")
        },
        key=str.casefold,
    )
    sources = sorted(
        {str(entity["source"]) for entity in ranked if entity.get("source") not in (None, "")}
    )
    sources.extend(
        str(provenance["source"])
        for entity in ranked
        if isinstance((provenance := entity.get("provenance")), dict)
        and provenance.get("source") not in (None, "")
    )
    merged["aliases"] = aliases
    merged["sources"] = sorted(set(sources))
    merged["normalized_name"] = normalize_company_name(_value(merged, "name", "legal_name"))
    merged["entity_id"] = assign_entity_id(merged)
    return merged


def assign_entity_ids(
    entities: Sequence[Entity], clusters: Sequence[Sequence[int]]
) -> list[Entity]:
    """Merge clusters and assign a deterministic ID to each representative record."""
    return [_merge_cluster(entities, members) for members in clusters]


def resolve_entities(
    entities: Sequence[Mapping[str, object]], threshold: float = 0.85, verbose: bool = False
) -> tuple[list[Entity], list[AuditEntry]]:
    """Deduplicate records using blocking, evidence-weighted matching, and union-find."""
    del verbose  # Reserved for CLI progress reporting without changing resolution behavior.
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must be between zero and one")
    records = [dict(entity) for entity in entities]
    if not records:
        return [], []
    for record in records:
        if not _value(record, "name", "legal_name"):
            raise ValueError("every entity requires name or legal_name")

    union_find = _UnionFind(len(records))
    matched_scores: dict[int, float] = {}
    for left, right in sorted(_candidate_pairs(records)):
        score = calculate_match_confidence(records[left], records[right])
        if score >= threshold:
            union_find.union(left, right)
            matched_scores[left] = max(matched_scores.get(left, 0.0), score)
            matched_scores[right] = max(matched_scores.get(right, 0.0), score)

    clusters = _clusters(union_find, len(records))
    resolved = assign_entity_ids(records, clusters)
    audit = [
        (cluster_id, index, matched_scores.get(index, 1.0 if len(members) == 1 else threshold))
        for cluster_id, members in enumerate(clusters)
        for index in members
    ]
    return resolved, audit


class EntityResolutionPipeline:
    """Stateful async facade around deterministic entity resolution."""

    def __init__(self, threshold: float = 0.85) -> None:
        self.threshold = threshold
        self._report: dict[str, Any] = {
            "total_entities": 0,
            "unique_entities": 0,
            "deduplication_rate": 0.0,
            "average_confidence": 0.0,
        }

    async def resolve_batch(
        self, entities: Sequence[Mapping[str, object]], batch_size: int = 1000
    ) -> AsyncIterator[Entity]:
        """Resolve the full collection and cooperatively yield result-sized batches."""
        if batch_size <= 0:
            raise ValueError("batch_size must be positive")
        resolved, audit = resolve_entities(entities, self.threshold)
        total = len(entities)
        self._report = {
            "total_entities": total,
            "unique_entities": len(resolved),
            "deduplication_rate": round((total - len(resolved)) / total, 6) if total else 0.0,
            "average_confidence": (
                round(sum(entry[2] for entry in audit) / len(audit), 6) if audit else 0.0
            ),
            "threshold": self.threshold,
        }
        for start in range(0, len(resolved), batch_size):
            await asyncio.sleep(0)
            for entity in resolved[start : start + batch_size]:
                yield entity

    def get_resolution_report(self) -> dict[str, Any]:
        """Return a copy of metrics from the most recently completed resolution."""
        return dict(self._report)


def load_entities(path: Path) -> list[Entity]:
    """Load a JSON list or Phase 1 extraction document into generic entity records."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and isinstance(payload.get("companies"), list):
        records = payload["companies"]
    else:
        raise ValueError("input must be a JSON list or contain a companies list")
    if not all(isinstance(record, dict) for record in records):
        raise ValueError("every input entity must be a JSON object")
    return records


def resolve_extraction_document(
    payload: Mapping[str, object], threshold: float = 0.85
) -> ExtractionResult:
    """Resolve a Phase 1 extraction and rewrite relationships to the canonical IDs."""
    validated = ExtractionResult.model_validate(payload)
    original = [company.model_dump(mode="json") for company in validated.companies]
    resolved, audit = resolve_entities(original, threshold)
    id_map = {
        validated.companies[original_index].entity_id: resolved[cluster_id]["entity_id"]
        for cluster_id, original_index, _confidence in audit
    }
    relationships: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for relationship in validated.relationships:
        source_id = id_map[relationship.from_entity_id]
        target_id = id_map[relationship.to_entity_id]
        key = (source_id, target_id, relationship.relationship_type)
        if source_id == target_id or key in seen:
            continue
        seen.add(key)
        item = relationship.model_dump(mode="json")
        item["from_entity_id"] = source_id
        item["to_entity_id"] = target_id
        item["relationship_id"] = stable_id(
            "REL", source_id, target_id, relationship.relationship_type
        )
        relationships.append(item)
    metadata = dict(validated.metadata)
    metadata["resolution_report"] = {
        "total_entities": len(original),
        "unique_entities": len(resolved),
        "deduplication_rate": round((len(original) - len(resolved)) / len(original), 6)
        if original
        else 0.0,
        "threshold": threshold,
    }
    return ExtractionResult.model_validate(
        {
            "schema_version": validated.schema_version,
            "companies": resolved,
            "relationships": relationships,
            "metadata": metadata,
        }
    )


async def _run(input_path: Path, output_path: Path, threshold: float) -> None:
    raw_payload = json.loads(input_path.read_text(encoding="utf-8"))
    if isinstance(raw_payload, dict) and "companies" in raw_payload:
        document = resolve_extraction_document(raw_payload, threshold)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(document.model_dump_json(indent=2), encoding="utf-8")
        return
    entities = load_entities(input_path)
    pipeline = EntityResolutionPipeline(threshold)
    resolved = [entity async for entity in pipeline.resolve_batch(entities)]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"entities": resolved, "report": pipeline.get_resolution_report()}, indent=2),
        encoding="utf-8",
    )


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--threshold", type=float, default=0.85)
    args = parser.parse_args(argv)
    asyncio.run(_run(args.input, args.output, args.threshold))


if __name__ == "__main__":
    main()
