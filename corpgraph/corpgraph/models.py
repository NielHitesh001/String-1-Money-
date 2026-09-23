"""Validated data contracts shared by scrapers and graph loaders."""

from __future__ import annotations

from datetime import UTC, date, datetime
from hashlib import sha256
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def stable_id(namespace: str, *parts: str) -> str:
    """Create a deterministic, compact identifier from source-controlled values."""
    canonical = "|".join(part.strip().casefold() for part in parts if part.strip())
    digest = sha256(f"{namespace}|{canonical}".encode()).hexdigest()[:20]
    return f"{namespace.upper()}_{digest}"


class Provenance(BaseModel):
    """Traceability metadata required on every extracted fact."""

    model_config = ConfigDict(extra="forbid")

    source: Literal["sec_edgar", "benchmark_fixture", "wikidata"]
    source_url: str
    accession_number: str
    filing_date: date
    collected_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Company(BaseModel):
    """Minimal company representation for the MVP graph."""

    model_config = ConfigDict(extra="forbid")

    entity_id: str
    legal_name: str = Field(min_length=1)
    registration_number: str | None = None
    jurisdiction: str | None = None
    normalized_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    provenance: Provenance


class Relationship(BaseModel):
    """Directed relationship between two graph entities."""

    model_config = ConfigDict(extra="forbid")

    relationship_id: str
    relationship_type: Literal["HAS_SUBSIDIARY"]
    from_entity_id: str
    to_entity_id: str
    confidence: float = Field(ge=0, le=1)
    provenance: Provenance


class ExtractionResult(BaseModel):
    """Versioned, graph-ready output from a single filing extraction."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = "1.0"
    companies: list[Company]
    relationships: list[Relationship]
    metadata: dict[str, Any] = Field(default_factory=dict)
