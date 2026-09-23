"""Collect source-attributed public corporate data from the Wikidata Action API."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from neo4j import AsyncDriver, AsyncGraphDatabase
from redis.asyncio import Redis

from corpgraph.api.config import ApiSettings
from corpgraph.common.base_scraper import BaseScraper, ScraperError
from corpgraph.graph_db.db_client import SCHEMA_STATEMENTS

Record = dict[str, object]
Entity = dict[str, Any]

API_URL = "https://www.wikidata.org/w/api.php"
ENTITY_URL = "https://www.wikidata.org/wiki/{entity_id}"
DEFAULT_USER_AGENT = "CorpGraph/0.1 (https://github.com/NielHitesh001/String-1-Money-)"
DEFAULT_ROOTS = (
    "Q312",  # Apple
    "Q2283",  # Microsoft
    "Q20800404",  # Alphabet
    "Q3884",  # Amazon
    "Q380",  # Meta Platforms
    "Q182477",  # Nvidia
    "Q478214",  # Tesla
    "Q37156",  # IBM
    "Q217583",  # Berkshire Hathaway
    "Q53268",  # Toyota
    "Q20718",  # Samsung Electronics
    "Q81230",  # Siemens
)
QID_PATTERN = re.compile(r"^Q[1-9][0-9]*$")

SUBSIDIARY = "P355"
COUNTRY = "P17"
INDUSTRY = "P452"
HEADQUARTERS = "P159"
LEGAL_FORM = "P1454"
INCEPTION = "P571"
WEBSITE = "P856"
EMPLOYEES = "P1128"
LEI = "P1278"
CEO = "P169"
CHAIRPERSON = "P488"
LABEL_PROPERTIES = (COUNTRY, INDUSTRY, HEADQUARTERS, LEGAL_FORM)
OFFICER_PROPERTIES = {CEO: "Chief Executive Officer", CHAIRPERSON: "Chairperson"}


def batches(values: list[str], size: int = 50) -> Iterable[list[str]]:
    """Yield Action API batches within the documented entity limit."""
    if size < 1 or size > 50:
        raise ValueError("batch size must be between 1 and 50")
    for start in range(0, len(values), size):
        yield values[start : start + size]


def claim_values(entity: Mapping[str, Any], property_id: str) -> list[Any]:
    """Extract usable main-snak values while ignoring unknown/deprecated values."""
    claims = entity.get("claims", {})
    if not isinstance(claims, dict):
        return []
    statements = claims.get(property_id, [])
    if not isinstance(statements, list):
        return []
    values: list[Any] = []
    for statement in statements:
        if not isinstance(statement, dict) or statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if not isinstance(snak, dict) or snak.get("snaktype") != "value":
            continue
        data_value = snak.get("datavalue", {})
        if isinstance(data_value, dict) and "value" in data_value:
            values.append(data_value["value"])
    return values


def linked_ids(entity: Mapping[str, Any], property_id: str) -> list[str]:
    """Return valid linked Wikidata item identifiers for one property."""
    result: list[str] = []
    for value in claim_values(entity, property_id):
        if isinstance(value, dict):
            entity_id = value.get("id")
            if isinstance(entity_id, str) and QID_PATTERN.fullmatch(entity_id):
                result.append(entity_id)
    return list(dict.fromkeys(result))


def scalar_string(entity: Mapping[str, Any], property_id: str) -> str | None:
    """Return the first string claim value."""
    return next(
        (value for value in claim_values(entity, property_id) if isinstance(value, str)),
        None,
    )


def quantity_integer(entity: Mapping[str, Any], property_id: str) -> int | None:
    """Return the first non-negative integer quantity, if present."""
    for value in claim_values(entity, property_id):
        if not isinstance(value, dict):
            continue
        amount = value.get("amount")
        try:
            parsed = int(float(str(amount)))
        except (TypeError, ValueError):
            continue
        if parsed >= 0:
            return parsed
    return None


def claim_date(entity: Mapping[str, Any], property_id: str) -> str | None:
    """Return an ISO date without inventing precision absent from Wikidata."""
    for value in claim_values(entity, property_id):
        if not isinstance(value, dict):
            continue
        raw = value.get("time")
        precision = value.get("precision")
        if not isinstance(raw, str):
            continue
        match = re.match(r"^[+-](\d{4})-(\d{2})-(\d{2})T", raw)
        if not match:
            continue
        year, month, day = match.groups()
        if precision == 9:
            return f"{year}-01-01"
        if precision == 10:
            return f"{year}-{month}-01"
        return f"{year}-{month}-{day}"
    return None


def english_value(entity: Mapping[str, Any], field: str, fallback: str) -> str:
    """Read an English label or description from an entity payload."""
    values = entity.get(field, {})
    if isinstance(values, dict):
        english = values.get("en", {})
        if isinstance(english, dict) and isinstance(english.get("value"), str):
            return str(english["value"])
    return fallback


class WikidataCollector(BaseScraper):
    """Sequential, cached-friendly reader for public Wikidata entities."""

    def __init__(self, user_agent: str, **kwargs: Any) -> None:
        super().__init__(
            user_agent=user_agent,
            requests_per_second=2,
            timeout_seconds=30,
            max_retries=3,
            **kwargs,
        )

    async def fetch_entities(self, entity_ids: Iterable[str]) -> dict[str, Entity]:
        """Fetch full English entity records in sequential batches."""
        requested = sorted(set(entity_ids))
        for entity_id in requested:
            if not QID_PATTERN.fullmatch(entity_id):
                raise ValueError(f"Invalid Wikidata entity identifier: {entity_id}")
        entities: dict[str, Entity] = {}
        for batch in batches(requested):
            query = urlencode(
                {
                    "action": "wbgetentities",
                    "ids": "|".join(batch),
                    "props": "labels|descriptions|aliases|claims",
                    "languages": "en",
                    "format": "json",
                    "maxlag": "5",
                }
            )
            payload = await self.get_json(f"{API_URL}?{query}")
            if "error" in payload:
                raise ScraperError("Wikidata API returned an error response")
            raw_entities = payload.get("entities", {})
            if not isinstance(raw_entities, dict):
                raise ScraperError("Wikidata entities response is invalid")
            for entity_id, entity in raw_entities.items():
                if (
                    isinstance(entity_id, str)
                    and isinstance(entity, dict)
                    and "missing" not in entity
                ):
                    entities[entity_id] = entity
        return entities

    async def collect(
        self, roots: Iterable[str], *, depth: int = 2, max_entities: int = 500
    ) -> tuple[list[Record], list[Record], dict[str, list[Record]]]:
        """Traverse declared subsidiaries and public executive relationships."""
        if not 0 <= depth <= 3:
            raise ValueError("depth must be between 0 and 3")
        if not 1 <= max_entities <= 2000:
            raise ValueError("max_entities must be between 1 and 2000")
        root_ids = list(dict.fromkeys(roots))
        entities = await self.fetch_entities(root_ids)
        company_ids = set(entities)
        frontier = list(entities)
        for _ in range(depth):
            discovered = [
                child
                for parent_id in frontier
                for child in linked_ids(entities[parent_id], SUBSIDIARY)
                if child not in company_ids
            ]
            remaining = max_entities - len(company_ids)
            frontier = list(dict.fromkeys(discovered))[: max(remaining, 0)]
            if not frontier:
                break
            fetched = await self.fetch_entities(frontier)
            entities.update(fetched)
            company_ids.update(fetched)
            frontier = list(fetched)

        label_ids = {
            linked
            for entity in entities.values()
            for property_id in LABEL_PROPERTIES
            for linked in linked_ids(entity, property_id)
        }
        officer_ids = {
            linked
            for entity in entities.values()
            for property_id in OFFICER_PROPERTIES
            for linked in linked_ids(entity, property_id)
        }
        lookup = await self.fetch_entities(label_ids | officer_ids)
        collected_at = datetime.now(UTC).isoformat()
        companies = [
            company_record(entity_id, entity, lookup, collected_at)
            for entity_id, entity in sorted(entities.items())
        ]
        people = [
            person_record(person_id, lookup[person_id], collected_at)
            for person_id in sorted(officer_ids & lookup.keys())
        ]
        relationships: dict[str, list[Record]] = defaultdict(list)
        for parent_id, entity in entities.items():
            for child_id in linked_ids(entity, SUBSIDIARY):
                if child_id in company_ids:
                    relationships["HAS_SUBSIDIARY"].append(
                        relationship_record(parent_id, child_id, "subsidiary", collected_at)
                    )
            for property_id, title in OFFICER_PROPERTIES.items():
                for person_id in linked_ids(entity, property_id):
                    if person_id in officer_ids:
                        relationships["OFFICER_AT"].append(
                            officer_relationship(person_id, parent_id, title, collected_at)
                        )
        return companies, people, dict(relationships)


def labels_for(
    entity: Mapping[str, Any], property_id: str, lookup: Mapping[str, Entity]
) -> list[str]:
    """Resolve linked items to stable English labels."""
    return [
        english_value(lookup[entity_id], "labels", entity_id)
        for entity_id in linked_ids(entity, property_id)
        if entity_id in lookup
    ]


def company_record(
    entity_id: str,
    entity: Entity,
    lookup: Mapping[str, Entity],
    collected_at: str,
) -> Record:
    """Translate a Wikidata company item to CorpGraph properties."""
    label = english_value(entity, "labels", entity_id)
    aliases = entity.get("aliases", {}).get("en", [])
    alias_values = (
        [
            str(alias["value"])
            for alias in aliases
            if isinstance(alias, dict) and isinstance(alias.get("value"), str)
        ]
        if isinstance(aliases, list)
        else []
    )
    legal_forms = labels_for(entity, LEGAL_FORM, lookup)
    return {
        "entity_id": f"wikidata_{entity_id}",
        "wikidata_id": entity_id,
        "legal_name": label,
        "normalized_name": label.casefold(),
        "registration_number": None,
        "jurisdiction": ", ".join(labels_for(entity, COUNTRY, lookup)) or None,
        "entity_type": legal_forms[0] if legal_forms else "Company",
        "status": "Public record",
        "incorporation_date": claim_date(entity, INCEPTION),
        "lei": scalar_string(entity, LEI),
        "website": scalar_string(entity, WEBSITE),
        "industry": ", ".join(labels_for(entity, INDUSTRY, lookup)) or None,
        "headquarters": ", ".join(labels_for(entity, HEADQUARTERS, lookup)) or None,
        "employee_count": quantity_integer(entity, EMPLOYEES),
        "description": english_value(entity, "descriptions", "Public Wikidata corporate record."),
        "deduplication_confidence": 0.9,
        "risk_flags": ["PUBLIC_SOURCE_REQUIRES_VERIFICATION"],
        "filing_references": [],
        "aliases": alias_values,
        "sources": ["wikidata"],
        "source": "wikidata",
        "source_url": ENTITY_URL.format(entity_id=entity_id),
        "source_license": "CC0-1.0",
        "collected_at": collected_at,
    }


def person_record(entity_id: str, entity: Entity, collected_at: str) -> Record:
    """Translate a publicly named executive item to CorpGraph properties."""
    return {
        "entity_id": f"wikidata_{entity_id}",
        "wikidata_id": entity_id,
        "full_name": english_value(entity, "labels", entity_id),
        "entity_type": "Person",
        "risk_flags": [],
        "sources": ["wikidata"],
        "source": "wikidata",
        "source_url": ENTITY_URL.format(entity_id=entity_id),
        "source_license": "CC0-1.0",
        "collected_at": collected_at,
    }


def relationship_record(parent_id: str, child_id: str, kind: str, collected_at: str) -> Record:
    """Build a source-attributed public corporate relationship."""
    return {
        "relationship_id": f"wikidata_{kind}_{parent_id}_{child_id}",
        "from_entity_id": f"wikidata_{parent_id}",
        "to_entity_id": f"wikidata_{child_id}",
        "confidence": 0.9,
        "is_current": True,
        "risk_flags": ["PUBLIC_SOURCE_REQUIRES_VERIFICATION"],
        "source": "wikidata",
        "source_url": ENTITY_URL.format(entity_id=parent_id),
        "source_license": "CC0-1.0",
        "collected_at": collected_at,
    }


def officer_relationship(person_id: str, company_id: str, title: str, collected_at: str) -> Record:
    """Build a public executive-to-company relationship."""
    record = relationship_record(person_id, company_id, "officer", collected_at)
    role_key = re.sub(r"[^a-z0-9]+", "_", title.casefold()).strip("_")
    record["relationship_id"] = f"wikidata_officer_{role_key}_{person_id}_{company_id}"
    record["officer_title"] = title
    return record


async def load_public_data(
    settings: ApiSettings,
    companies: list[Record],
    people: list[Record],
    relationships: Mapping[str, list[Record]],
    *,
    replace_wikidata: bool,
) -> dict[str, int]:
    """Idempotently load collected public records and invalidate API caches."""
    driver: AsyncDriver = AsyncGraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )
    try:
        await driver.verify_connectivity()
        async with driver.session(database=settings.neo4j_database) as session:
            for statement in SCHEMA_STATEMENTS:
                await session.run(statement)
            if replace_wikidata:
                await session.run("MATCH (node) WHERE node.source = 'wikidata' DETACH DELETE node")
            await session.run(
                "UNWIND $rows AS row "
                "MERGE (node:Company {entity_id: row.entity_id}) SET node += row",
                rows=companies,
            )
            await session.run(
                "UNWIND $rows AS row "
                "MERGE (node:Person {entity_id: row.entity_id}) SET node += row",
                rows=people,
            )
            for relationship_type, records in relationships.items():
                await session.run(public_relationship_query(relationship_type), rows=records)
            await session.run("CALL db.index.fulltext.awaitEventuallyConsistentIndexRefresh()")
    finally:
        await driver.close()
    cache = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        keys = [key async for key in cache.scan_iter(match="corpgraph:*")]
        if keys:
            await cache.delete(*keys)
    finally:
        await cache.aclose()
    return {
        "companies": len(companies),
        "people": len(people),
        "relationships": sum(len(records) for records in relationships.values()),
    }


def public_relationship_query(relationship_type: str) -> str:
    """Return one of two static relationship write templates."""
    if relationship_type not in {"HAS_SUBSIDIARY", "OFFICER_AT"}:
        raise ValueError("Unsupported Wikidata relationship type")
    source_label = ":Person" if relationship_type == "OFFICER_AT" else ":Company"
    return f"""
    UNWIND $rows AS row
    MATCH (source{source_label} {{entity_id: row.from_entity_id}})
    MATCH (target:Company {{entity_id: row.to_entity_id}})
    MERGE (source)-[edge:{relationship_type} {{relationship_id: row.relationship_id}}]->(target)
    SET edge += row
    """


def write_snapshot(
    path: Path,
    companies: list[Record],
    people: list[Record],
    relationships: Mapping[str, list[Record]],
) -> None:
    """Persist the exact collected payload for audit and replay."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schema_version": "2.0",
                "source": "wikidata",
                "source_license": "CC0-1.0",
                "companies": companies,
                "people": people,
                "relationships": relationships,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


def parse_args() -> argparse.Namespace:
    """Parse collection boundaries and explicit replacement behavior."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", action="append", dest="roots", help="Wikidata QID; repeatable")
    parser.add_argument("--depth", type=int, default=2)
    parser.add_argument("--max-entities", type=int, default=500)
    parser.add_argument("--replace-wikidata", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("data/wikidata-public.json"))
    return parser.parse_args()


async def run(args: argparse.Namespace) -> dict[str, int]:
    """Collect, snapshot, and load the requested public graph."""
    user_agent = os.getenv("WIKIMEDIA_USER_AGENT", DEFAULT_USER_AGENT)
    async with WikidataCollector(user_agent) as collector:
        companies, people, relationships = await collector.collect(
            args.roots or DEFAULT_ROOTS,
            depth=args.depth,
            max_entities=args.max_entities,
        )
    write_snapshot(args.output, companies, people, relationships)
    return await load_public_data(
        ApiSettings.from_env(),
        companies,
        people,
        relationships,
        replace_wikidata=args.replace_wikidata,
    )


def main() -> None:
    """CLI entry point."""
    result = asyncio.run(run(parse_args()))
    print(
        f"Loaded {result['companies']} public companies, {result['people']} public officers, "
        f"and {result['relationships']} attributed relationships."
    )


if __name__ == "__main__":  # pragma: no cover - exercised through the installed CLI
    main()
