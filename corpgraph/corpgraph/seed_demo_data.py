"""Create a deterministic, richly connected fictional CorpGraph demo dataset."""

from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from collections.abc import Iterable
from datetime import date

from neo4j import AsyncDriver, AsyncGraphDatabase
from redis.asyncio import Redis

from corpgraph.api.config import ApiSettings
from corpgraph.graph_db.db_client import SCHEMA_STATEMENTS

Record = dict[str, object]

GROUPS = (
    ("Atlas Meridian", "Technology", "US-DE", "San Francisco, US"),
    ("Northstar Quantum", "Semiconductors", "US-DE", "Austin, US"),
    ("Helix Harbor", "Healthcare", "GB", "London, UK"),
    ("Verdant Grid", "Renewable Energy", "DE", "Berlin, Germany"),
    ("Orion Ledger", "Financial Services", "SG", "Singapore"),
    ("Keystone Mobility", "Transportation", "JP", "Tokyo, Japan"),
    ("Lumen Forge", "Industrial Automation", "CH", "Zurich, Switzerland"),
    ("BluePeak Systems", "Cloud Infrastructure", "CA", "Toronto, Canada"),
    ("Cedar Arc", "Consumer Products", "NL", "Amsterdam, Netherlands"),
    ("Solstice Materials", "Advanced Materials", "AU", "Sydney, Australia"),
)
REGIONS = ("Americas", "EMEA", "APAC", "Nordics", "Gulf", "LatAm")
FIRST_NAMES = ("Maya", "Aiden", "Sofia", "Noah", "Zara", "Elias", "Priya", "Leo", "Amara", "Jonas")
LAST_NAMES = ("Chen", "Okafor", "Mehta", "Rossi", "Silva", "Tanaka")
OFFICER_TITLES = (
    "Board Chair",
    "Independent Director",
    "Chief Executive Officer",
    "Chief Risk Officer",
)


def chunks(records: list[Record], size: int) -> Iterable[list[Record]]:
    """Yield bounded batches for Neo4j UNWIND operations."""
    if size < 1:
        raise ValueError("chunk size must be positive")
    for start in range(0, len(records), size):
        yield records[start : start + size]


def build_demo_dataset() -> tuple[list[Record], list[Record], dict[str, list[Record]]]:
    """Return 510 companies, 60 people, and a multi-relational graph."""
    companies: list[Record] = []
    people: list[Record] = []
    relationships: dict[str, list[Record]] = defaultdict(list)
    roots: list[str] = []
    divisions: list[str] = []

    for group_index, (brand, industry, jurisdiction, headquarters) in enumerate(GROUPS):
        slug = brand.lower().replace(" ", "_")
        root_id = f"demo_{slug}_root"
        roots.append(root_id)
        companies.append(
            {
                "entity_id": root_id,
                "legal_name": f"{brand} Group plc",
                "normalized_name": f"{brand.lower()} group",
                "registration_number": f"CG-{group_index + 1:03d}-ROOT",
                "jurisdiction": jurisdiction,
                "entity_type": "Public Company",
                "status": "Active",
                "incorporation_date": date(1994 + group_index, 3, 15).isoformat(),
                "cik": f"{1800000 + group_index:010d}",
                "lei": f"DEMOLEI{group_index + 1:012d}",
                "website": f"https://{slug.replace('_', '-')}.example.invalid",
                "industry": industry,
                "headquarters": headquarters,
                "employee_count": 42_000 + group_index * 3_700,
                "revenue_usd": float(8_500_000_000 + group_index * 925_000_000),
                "description": (
                    f"Fictional global {industry.lower()} group used for product demonstration."
                ),
                "deduplication_confidence": 0.99,
                "risk_flags": ["HIGH_SUBSIDIARY_COUNT", "CROSS_BORDER_STRUCTURE"],
                "filing_references": [f"DEMO-10K-{2025}-{group_index + 1:03d}"],
                "aliases": [brand, f"{brand} Group"],
                "sources": ["demo_seed"],
                "source": "demo_seed",
                "demo_seed": True,
            }
        )
        holdings: list[str] = []
        for holding_index in range(3):
            holding_id = f"demo_{slug}_holding_{holding_index + 1}"
            holdings.append(holding_id)
            companies.append(
                company_record(
                    holding_id,
                    f"{brand} {REGIONS[holding_index]} Holdings Ltd",
                    industry,
                    ("US-DE", "GB", "SG")[holding_index],
                    "Holding Company",
                    0.97,
                    ["CROSS_BORDER_STRUCTURE"] if holding_index else [],
                    group_index,
                )
            )
            relationships["OWNS"].append(
                ownership_record(root_id, holding_id, 100.0, group_index, holding_index)
            )
        for division_index in range(12):
            division_id = f"demo_{slug}_division_{division_index + 1:02d}"
            divisions.append(division_id)
            companies.append(
                company_record(
                    division_id,
                    (
                        f"{brand} "
                        f"{('Cloud', 'Labs', 'Capital', 'Operations')[division_index % 4]} "
                        f"{division_index + 1}"
                    ),
                    industry,
                    ("US-CA", "GB", "SG", "DE")[division_index % 4],
                    "Operating Subsidiary",
                    0.94 + (division_index % 5) / 100,
                    ["RELATED_PARTY_EXPOSURE"] if division_index % 7 == 0 else [],
                    group_index,
                )
            )
            relationships["HAS_SUBSIDIARY"].append(
                ownership_record(
                    holdings[division_index % 3],
                    division_id,
                    75.0 + division_index % 5 * 5,
                    group_index,
                    division_index,
                )
            )

    for regional_index in range(350):
        group_index = regional_index % len(GROUPS)
        brand, industry, _, _ = GROUPS[group_index]
        region = REGIONS[regional_index % len(REGIONS)]
        entity_id = f"demo_regional_{regional_index + 1:03d}"
        companies.append(
            company_record(
                entity_id,
                f"{brand} {region} Services {regional_index + 1:03d} Ltd",
                industry,
                ("US-NY", "IE", "IN", "AE", "BR", "SE")[regional_index % 6],
                "Subsidiary",
                0.89 + (regional_index % 10) / 100,
                ["MINORITY_OWNERSHIP"] if regional_index % 11 == 0 else [],
                group_index,
            )
        )
        relationships["HAS_SUBSIDIARY"].append(
            ownership_record(
                divisions[regional_index % len(divisions)],
                entity_id,
                51.0 + regional_index % 10 * 4,
                group_index,
                regional_index,
            )
        )

    for person_index in range(60):
        full_name = f"{FIRST_NAMES[person_index % 10]} {LAST_NAMES[person_index // 10]}"
        person_id = f"demo_person_{person_index + 1:03d}"
        title = OFFICER_TITLES[person_index % len(OFFICER_TITLES)]
        people.append(
            {
                "entity_id": person_id,
                "full_name": full_name,
                "entity_type": "Person",
                "title": title,
                "nationality": ("US", "GB", "IN", "SG", "JP", "NG")[person_index % 6],
                "board_seats": 3,
                "risk_flags": ["INTERLOCKING_DIRECTOR"],
                "sources": ["demo_seed"],
                "demo_seed": True,
            }
        )
        for seat in range(3):
            company_id = (
                roots[(person_index + seat * 3) % len(roots)]
                if seat == 0
                else divisions[(person_index * 7 + seat * 17) % len(divisions)]
            )
            relationships["DIRECTOR_OF"].append(
                {
                    "relationship_id": f"demo_director_{person_index + 1:03d}_{seat}",
                    "source": person_id,
                    "target": company_id,
                    "confidence": 0.96,
                    "officer_title": title,
                    "effective_from": f"{2020 + seat}-01-01",
                    "is_current": True,
                    "risk_flags": ["INTERLOCKING_DIRECTOR"],
                    "filing_reference": f"DEMO-DEF14A-{2025}-{person_index + 1:03d}",
                    "demo_seed": True,
                }
            )

    for link_index in range(40):
        relationships["SUPPLIER_TO"].append(
            generic_relationship(
                "supplier",
                link_index,
                divisions[(link_index * 5) % 120],
                divisions[(link_index * 5 + 37) % 120],
                0.91,
            )
        )
    for link_index in range(20):
        relationships["CO_PATENT_HOLDER"].append(
            generic_relationship(
                "patent",
                link_index,
                roots[link_index % 10],
                divisions[(link_index * 11) % 120],
                0.94,
            )
        )
    return companies, people, dict(relationships)


def company_record(
    entity_id: str,
    name: str,
    industry: str,
    jurisdiction: str,
    entity_type: str,
    confidence: float,
    risk_flags: list[str],
    group_index: int,
) -> Record:
    """Build a realistic fictional company property map."""
    return {
        "entity_id": entity_id,
        "legal_name": name,
        "normalized_name": name.casefold(),
        "registration_number": f"CG-{group_index + 1:03d}-{entity_id[-8:].upper()}",
        "jurisdiction": jurisdiction,
        "entity_type": entity_type,
        "status": "Active",
        "incorporation_date": f"{2001 + group_index}-06-01",
        "industry": industry,
        "headquarters": jurisdiction,
        "employee_count": 350 + group_index * 41,
        "revenue_usd": float(75_000_000 + group_index * 11_500_000),
        "description": f"Fictional {industry.lower()} operating entity for product demonstration.",
        "deduplication_confidence": confidence,
        "risk_flags": risk_flags,
        "filing_references": [f"DEMO-EX21-{2025}-{group_index + 1:03d}"],
        "aliases": [],
        "sources": ["demo_seed"],
        "source": "demo_seed",
        "demo_seed": True,
    }


def ownership_record(
    source: str, target: str, percentage: float, group_index: int, index: int
) -> Record:
    """Build an ownership relationship with investigation metadata."""
    return {
        "relationship_id": f"demo_ownership_{group_index:02d}_{index:04d}_{target[-4:]}",
        "source": source,
        "target": target,
        "ownership_percentage": percentage,
        "confidence": 0.97,
        "effective_from": "2021-01-01",
        "is_current": True,
        "risk_flags": ["MINORITY_OWNERSHIP"] if percentage < 80 else [],
        "filing_reference": f"DEMO-EX21-{2025}-{group_index + 1:03d}",
        "demo_seed": True,
    }


def generic_relationship(
    kind: str, index: int, source: str, target: str, confidence: float
) -> Record:
    """Build a non-ownership demo relationship."""
    return {
        "relationship_id": f"demo_{kind}_{index + 1:03d}",
        "source": source,
        "target": target,
        "confidence": confidence,
        "effective_from": "2023-01-01",
        "is_current": True,
        "risk_flags": [],
        "filing_reference": f"DEMO-{kind.upper()}-{index + 1:03d}",
        "demo_seed": True,
    }


async def seed(settings: ApiSettings, *, replace_demo: bool, batch_size: int) -> dict[str, int]:
    """Apply the deterministic demo dataset and clear stale API cache entries."""
    companies, people, relationships = build_demo_dataset()
    driver: AsyncDriver = AsyncGraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )
    try:
        await driver.verify_connectivity()
        async with driver.session(database=settings.neo4j_database) as session:
            for statement in SCHEMA_STATEMENTS:
                await session.run(statement)
            if replace_demo:
                await session.run("MATCH (node) WHERE node.demo_seed = true DETACH DELETE node")
            for batch in chunks(companies, batch_size):
                await session.run(
                    "UNWIND $rows AS row "
                    "MERGE (node:Company {entity_id: row.entity_id}) SET node += row",
                    rows=batch,
                )
            for batch in chunks(people, batch_size):
                await session.run(
                    "UNWIND $rows AS row "
                    "MERGE (node:Person {entity_id: row.entity_id}) SET node += row",
                    rows=batch,
                )
            for relationship_type, records in relationships.items():
                query = relationship_query(relationship_type)
                for batch in chunks(records, batch_size):
                    await session.run(query, rows=batch)
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


def relationship_query(relationship_type: str) -> str:
    """Return a hardcoded allowlisted write template; relationship types are never user input."""
    allowed = {"OWNS", "HAS_SUBSIDIARY", "DIRECTOR_OF", "SUPPLIER_TO", "CO_PATENT_HOLDER"}
    if relationship_type not in allowed:
        raise ValueError("Unsupported demo relationship type")
    source_label = ":Person" if relationship_type in {"DIRECTOR_OF", "OFFICER_AT"} else ":Company"
    return f"""
    UNWIND $rows AS row
    MATCH (source{source_label} {{entity_id: row.source}})
    MATCH (target:Company {{entity_id: row.target}})
    MERGE (source)-[edge:{relationship_type} {{relationship_id: row.relationship_id}}]->(target)
    SET edge += row
    """


def parse_args() -> argparse.Namespace:
    """Parse the explicit replacement and batching controls."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replace-demo", action="store_true", help="delete only prior demo_seed nodes"
    )
    parser.add_argument("--batch-size", type=int, default=250)
    return parser.parse_args()


def main() -> None:
    """CLI entry point."""
    args = parse_args()
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")
    result = asyncio.run(
        seed(ApiSettings.from_env(), replace_demo=args.replace_demo, batch_size=args.batch_size)
    )
    print(
        f"Seeded {result['companies']} companies, {result['people']} people, "
        f"and {result['relationships']} relationships."
    )


if __name__ == "__main__":  # pragma: no cover - exercised through the installed CLI
    main()
