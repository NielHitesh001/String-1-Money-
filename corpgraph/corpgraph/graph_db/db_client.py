"""Small, transaction-oriented Neo4j client."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from neo4j import AsyncDriver, AsyncGraphDatabase

SCHEMA_STATEMENTS = (
    "CREATE CONSTRAINT company_entity_id_unique IF NOT EXISTS "
    "FOR (company:Company) REQUIRE company.entity_id IS UNIQUE",
    "CREATE INDEX company_registration_number IF NOT EXISTS "
    "FOR (company:Company) ON (company.registration_number)",
    "CREATE INDEX company_jurisdiction IF NOT EXISTS "
    "FOR (company:Company) ON (company.jurisdiction)",
    "CREATE FULLTEXT INDEX company_name_search IF NOT EXISTS "
    "FOR (company:Company) ON EACH [company.legal_name]",
    "CREATE FULLTEXT INDEX company_search_v2 IF NOT EXISTS "
    "FOR (company:Company) ON EACH "
    "[company.legal_name, company.aliases, company.registration_number]",
    "CREATE CONSTRAINT person_entity_id_unique IF NOT EXISTS "
    "FOR (person:Person) REQUIRE person.entity_id IS UNIQUE",
    "CREATE INDEX person_full_name IF NOT EXISTS FOR (person:Person) ON (person.full_name)",
)


class GraphClient:
    """Own a pooled Neo4j driver and expose bounded write operations."""

    def __init__(self, uri: str, user: str, password: str) -> None:
        self._driver: AsyncDriver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def __aenter__(self) -> GraphClient:
        await self._driver.verify_connectivity()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self._driver.close()

    async def execute_schema(self, statements: Sequence[str]) -> None:
        """Apply idempotent schema statements one transaction at a time."""
        async with self._driver.session() as session:
            for statement in statements:
                await session.run(statement)

    async def load_batch(
        self,
        companies: Sequence[Mapping[str, Any]],
        relationships: Sequence[Mapping[str, Any]],
    ) -> None:
        """Upsert a complete extraction atomically."""
        async with self._driver.session() as session:
            await session.execute_write(
                self._upsert_extraction,
                companies=list(companies),
                relationships=list(relationships),
            )

    @staticmethod
    async def _upsert_extraction(
        tx: Any, *, companies: list[Any], relationships: list[Any]
    ) -> None:
        await tx.run(
            """
            UNWIND $companies AS company
            MERGE (c:Company {entity_id: company.entity_id})
            SET c.legal_name = company.legal_name,
                c.registration_number = company.registration_number,
                c.jurisdiction = company.jurisdiction,
                c.normalized_name = company.normalized_name,
                c.aliases = company.aliases,
                c.sources = company.sources,
                c.source = company.provenance.source,
                c.source_url = company.provenance.source_url,
                c.accession_number = company.provenance.accession_number,
                c.filing_date = date(company.provenance.filing_date),
                c.collected_at = datetime(company.provenance.collected_at)
            """,
            companies=companies,
        )
        await tx.run(
            """
            UNWIND $relationships AS relationship
            MATCH (parent:Company {entity_id: relationship.from_entity_id})
            MATCH (child:Company {entity_id: relationship.to_entity_id})
            MERGE (parent)-[r:HAS_SUBSIDIARY {
                relationship_id: relationship.relationship_id
            }]->(child)
            SET r.confidence = relationship.confidence,
                r.source = relationship.provenance.source,
                r.source_url = relationship.provenance.source_url,
                r.accession_number = relationship.provenance.accession_number,
                r.filing_date = date(relationship.provenance.filing_date),
                r.collected_at = datetime(relationship.provenance.collected_at)
            """,
            relationships=relationships,
        )
