"""Public response contracts for the CorpGraph REST API."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Literal

from neo4j.time import Date, DateTime, Duration, Time
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


def json_properties(value: Any) -> Any:
    """Preserve Neo4j temporal precision as ISO strings in nested API properties."""
    if isinstance(value, Date | DateTime | Duration | Time):
        return value.iso_format()
    if isinstance(value, dict):
        return {key: json_properties(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [json_properties(item) for item in value]
    return value


class CompanyResponse(BaseModel):
    """Stable public representation of a company node."""

    model_config = ConfigDict(extra="ignore")

    entity_id: str
    name: str = Field(validation_alias=AliasChoices("name", "legal_name"))
    jurisdiction: str | None = None
    registration_num: str | None = Field(
        default=None,
        validation_alias=AliasChoices("registration_num", "registration_number"),
    )
    normalized_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    source_url: str | None = None
    source_license: str | None = None
    collected_at: datetime | None = None
    wikidata_id: str | None = None
    entity_type: str | None = None
    status: str | None = None
    incorporation_date: date | None = None
    cik: str | None = None
    lei: str | None = None
    website: str | None = None
    industry: str | None = None
    headquarters: str | None = None
    employee_count: int | None = Field(default=None, ge=0)
    revenue_usd: float | None = Field(default=None, ge=0)
    description: str | None = None
    deduplication_confidence: float | None = Field(default=None, ge=0, le=1)
    risk_flags: list[str] = Field(default_factory=list)
    filing_references: list[str] = Field(default_factory=list)


class RelationshipResponse(BaseModel):
    """Relationship data returned as part of a network path."""

    type: str
    edge_id: str | None = None
    source: str | None = None
    target: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("properties", mode="before")
    @classmethod
    def normalize_properties(cls, value: Any) -> Any:
        """Normalize driver values before both HTTP and cache serialization."""
        return json_properties(value)


class RelatedCompanyResponse(BaseModel):
    """A related company and the path connecting it to the center node."""

    company: CompanyResponse
    nodes: list[CompanyResponse] = Field(default_factory=list)
    relationships: list[RelationshipResponse]
    depth: int = Field(ge=1, le=5)


class GraphNodeResponse(BaseModel):
    """Visualization-ready company or person node."""

    id: str
    label: str
    category: Literal["Company", "Subsidiary", "HoldingCompany", "Person"]
    entity_type: str | None = None
    jurisdiction: str | None = None
    industry: str | None = None
    title: str | None = None
    board_seats: int = Field(default=0, ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)
    risk_flags: list[str] = Field(default_factory=list)
    attributes: dict[str, Any] = Field(default_factory=dict)

    @field_validator("attributes", mode="before")
    @classmethod
    def normalize_attributes(cls, value: Any) -> Any:
        """Normalize nested Neo4j values before response serialization."""
        return json_properties(value)


class GraphLinkResponse(BaseModel):
    """Visualization-ready directed relationship."""

    id: str
    source: str
    target: str
    type: str
    label: str
    ownership_percentage: float | None = Field(default=None, ge=0, le=100)
    confidence: float | None = Field(default=None, ge=0, le=1)
    officer_title: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    is_current: bool = True
    risk_flags: list[str] = Field(default_factory=list)
    filing_reference: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("properties", mode="before")
    @classmethod
    def normalize_link_properties(cls, value: Any) -> Any:
        """Normalize nested Neo4j values before response serialization."""
        return json_properties(value)


class NetworkSummaryResponse(BaseModel):
    """Aggregated network signals for investigation workflows."""

    companies: int = Field(ge=0)
    people: int = Field(ge=0)
    subsidiaries: int = Field(ge=0)
    jurisdictions: int = Field(ge=0)
    flagged_nodes: int = Field(ge=0)
    interlocking_directors: int = Field(ge=0)
    average_confidence: float | None = Field(default=None, ge=0, le=1)


class NetworkResponse(BaseModel):
    """Bounded company network response."""

    center: CompanyResponse
    related: list[RelatedCompanyResponse]
    nodes: list[GraphNodeResponse] = Field(default_factory=list)
    links: list[GraphLinkResponse] = Field(default_factory=list)
    summary: NetworkSummaryResponse
    depth: int = Field(ge=1, le=5)
    total_nodes: int = Field(ge=1)
    total_relationships: int = Field(ge=0)


class HealthResponse(BaseModel):
    """Lightweight service liveness response."""

    status: str


class ReadinessResponse(BaseModel):
    """Dependency-aware readiness result for orchestrators."""

    status: Literal["ready"]
    services: dict[str, Literal["healthy"]]


class StatsResponse(BaseModel):
    """Current graph-size statistics."""

    companies: int = Field(ge=0)
    people: int = Field(ge=0)
    relationships: int = Field(ge=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ErrorResponse(BaseModel):
    """Non-sensitive API error payload."""

    detail: str
