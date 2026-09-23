"""Validate a CorpGraph extraction file and upsert it into Neo4j."""

from __future__ import annotations

import argparse
import asyncio
import os
from collections.abc import Sequence
from pathlib import Path

from corpgraph.graph_db.db_client import SCHEMA_STATEMENTS, GraphClient
from corpgraph.models import ExtractionResult


def load_document(path: Path) -> ExtractionResult:
    """Read and validate an extraction before any graph mutation occurs."""
    return ExtractionResult.model_validate_json(path.read_text(encoding="utf-8"))


async def _run(path: Path, uri: str, user: str, password: str) -> None:
    document = load_document(path)
    companies = [company.model_dump(mode="json") for company in document.companies]
    relationships = [
        relationship.model_dump(mode="json") for relationship in document.relationships
    ]
    async with GraphClient(uri, user, password) as client:
        await client.execute_schema(SCHEMA_STATEMENTS)
        await client.load_batch(companies, relationships)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    args = parser.parse_args(argv)
    password = os.environ.get("NEO4J_PASSWORD", "")
    if not password:
        parser.error("NEO4J_PASSWORD is required")
    asyncio.run(
        _run(
            args.input,
            os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
            os.environ.get("NEO4J_USER", "neo4j"),
            password,
        )
    )


if __name__ == "__main__":
    main()
