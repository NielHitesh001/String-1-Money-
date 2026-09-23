"""FastAPI application exposing bounded CorpGraph read operations."""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from typing import Annotated, Any, Literal, Protocol, cast

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import TypeAdapter
from starlette.middleware.cors import CORSMiddleware

from corpgraph.api.cache import CacheError, CacheLayer
from corpgraph.api.config import ApiSettings
from corpgraph.api.graph_client import (
    GraphConnectionError,
    GraphQueryError,
    GraphQueryTimeout,
    Neo4jClient,
)
from corpgraph.api.metrics import HttpMetricsMiddleware, MetricsRegistry
from corpgraph.api.models import (
    CompanyResponse,
    GraphLinkResponse,
    GraphNodeResponse,
    HealthResponse,
    NetworkResponse,
    NetworkSummaryResponse,
    ReadinessResponse,
    RelatedCompanyResponse,
    RelationshipResponse,
    StatsResponse,
    json_properties,
)
from corpgraph.api.query_builder import SafeQueryBuilder
from corpgraph.api.security import ApiSecurityMiddleware

RelationshipType = Literal[
    "CO_PATENT_HOLDER",
    "DIRECTOR_OF",
    "HAS_SUBSIDIARY",
    "OFFICER_AT",
    "OWNS",
    "PARENT_OF",
    "SUPPLIER_TO",
]


class GraphReader(Protocol):
    """Operations the HTTP layer requires from graph persistence."""

    async def connect(self) -> None: ...

    async def close(self) -> None: ...

    async def execute_query(
        self,
        query: str,
        params: Mapping[str, object] | None = None,
        timeout_ms: int = 30_000,
    ) -> list[dict[str, Any]]: ...

    async def health_check(self) -> bool: ...


class CacheStore(Protocol):
    """Operations the HTTP layer requires from caching."""

    async def connect(self) -> None: ...

    async def close(self) -> None: ...

    async def health_check(self) -> bool: ...

    async def get(self, key: str) -> str | None: ...

    async def set(self, key: str, value: str, ttl_seconds: int = 3600) -> None: ...

    async def increment(self, key: str, window_seconds: int) -> int: ...


def _company(payload: object) -> CompanyResponse:
    if not isinstance(payload, dict):
        raise GraphQueryError("Neo4j returned an invalid company record")
    return CompanyResponse.model_validate(json_properties(payload))


def _node(payload: object, center_id: str) -> GraphNodeResponse:
    """Convert a Neo4j node projection to the stable graph visualization contract."""
    if not isinstance(payload, dict):
        raise GraphQueryError("Neo4j returned an invalid graph node")
    wrapped = payload.get("properties")
    properties = wrapped if isinstance(wrapped, dict) else payload
    raw_labels = payload.get("labels", [])
    labels = {str(label) for label in raw_labels} if isinstance(raw_labels, list) else set()
    entity_id = str(properties.get("entity_id", "")).strip()
    if not entity_id:
        raise GraphQueryError("Neo4j returned a graph node without an identifier")
    is_person = "Person" in labels or properties.get("entity_type") == "Person"
    entity_type = str(properties.get("entity_type") or ("Person" if is_person else "Company"))
    category: Literal["Company", "Subsidiary", "HoldingCompany", "Person"]
    if is_person:
        category = "Person"
    elif entity_id == center_id:
        category = "HoldingCompany" if entity_type == "Holding Company" else "Company"
    elif "holding" in entity_type.casefold():
        category = "HoldingCompany"
    elif "subsidiary" in entity_type.casefold():
        category = "Subsidiary"
    else:
        category = "Company"
    risk_flags = properties.get("risk_flags", [])
    return GraphNodeResponse(
        id=entity_id,
        label=str(
            properties.get("full_name")
            or properties.get("name")
            or properties.get("legal_name")
            or entity_id
        ),
        category=category,
        entity_type=entity_type,
        jurisdiction=properties.get("jurisdiction"),
        industry=properties.get("industry"),
        title=properties.get("title"),
        board_seats=int(properties.get("board_seats") or 0),
        confidence=properties.get("deduplication_confidence"),
        risk_flags=[str(flag) for flag in risk_flags] if isinstance(risk_flags, list) else [],
        attributes=properties,
    )


def _link(
    relationship: RelationshipResponse, path_index: int, edge_index: int
) -> GraphLinkResponse:
    """Convert a path relationship to the stable graph visualization contract."""
    properties = relationship.properties
    source = relationship.source
    target = relationship.target
    if not source or not target:
        raise GraphQueryError("Neo4j returned a relationship without endpoints")
    edge_id = relationship.edge_id or f"legacy-{path_index}-{edge_index}"
    risk_flags = properties.get("risk_flags", [])
    return GraphLinkResponse(
        id=edge_id,
        source=source,
        target=target,
        type=relationship.type,
        label=relationship.type.replace("_", " ").title(),
        ownership_percentage=properties.get("ownership_percentage"),
        confidence=properties.get("confidence"),
        officer_title=properties.get("officer_title"),
        effective_from=properties.get("effective_from"),
        effective_to=properties.get("effective_to"),
        is_current=bool(properties.get("is_current", True)),
        risk_flags=[str(flag) for flag in risk_flags] if isinstance(risk_flags, list) else [],
        filing_reference=properties.get("filing_reference") or properties.get("accession_number"),
        properties=properties,
    )


def create_app(
    settings: ApiSettings | None = None,
    graph_client: GraphReader | None = None,
    cache_layer: CacheStore | None = None,
    metrics_registry: MetricsRegistry | None = None,
) -> FastAPI:
    """Create an independently configurable API application."""
    configured = settings or ApiSettings.from_env()
    client: GraphReader = graph_client or Neo4jClient(
        configured.neo4j_uri,
        (configured.neo4j_user, configured.neo4j_password),
        database=configured.neo4j_database,
    )
    cache: CacheStore = cache_layer or CacheLayer(configured.redis_url)
    metrics = metrics_registry or MetricsRegistry()
    builder = SafeQueryBuilder()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        await client.connect()
        try:
            await cache.connect()
            application.state.graph_client = client
            application.state.cache = cache
            try:
                yield
            finally:
                await cache.close()
        finally:
            await client.close()

    application = FastAPI(
        title="CorpGraph API",
        version="0.1.0",
        description="Read-only corporate relationship intelligence API",
        lifespan=lifespan,
    )
    application.add_middleware(
        ApiSecurityMiddleware,
        store=cache,
        api_key=configured.api_key,
        requests_per_minute=configured.rate_limit_per_minute,
    )
    application.add_middleware(HttpMetricsMiddleware, registry=metrics)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(configured.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    def database(request: Request) -> GraphReader:
        return cast(GraphReader, request.app.state.graph_client)

    def response_cache(request: Request) -> CacheStore:
        return cast(CacheStore, request.app.state.cache)

    @application.exception_handler(GraphConnectionError)
    async def connection_error(_request: Request, _exc: GraphConnectionError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": "Graph database unavailable"})

    @application.exception_handler(GraphQueryTimeout)
    async def timeout_error(_request: Request, _exc: GraphQueryTimeout) -> JSONResponse:
        return JSONResponse(status_code=504, content={"detail": "Graph query timed out"})

    @application.exception_handler(GraphQueryError)
    async def query_error(_request: Request, _exc: GraphQueryError) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": "Graph query failed"})

    @application.exception_handler(CacheError)
    async def cache_error(_request: Request, _exc: CacheError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": "Cache unavailable"})

    @application.get("/health", response_model=HealthResponse)
    async def health_check(request: Request) -> HealthResponse:
        if not await database(request).health_check():
            raise HTTPException(status_code=503, detail="Database unavailable")
        return HealthResponse(status="healthy")

    @application.get("/ready", response_model=ReadinessResponse)
    async def readiness_check(request: Request) -> ReadinessResponse:
        if not await database(request).health_check() or not await response_cache(
            request
        ).health_check():
            raise HTTPException(status_code=503, detail="Service unavailable")
        return ReadinessResponse(
            status="ready", services={"neo4j": "healthy", "redis": "healthy"}
        )

    @application.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
    async def prometheus_metrics() -> PlainTextResponse:
        return PlainTextResponse(
            await metrics.render(), media_type="text/plain; version=0.0.4"
        )

    @application.get("/api/stats", response_model=StatsResponse)
    async def graph_stats(request: Request) -> StatsResponse:
        query, parameters = builder.graph_statistics()
        rows = await database(request).execute_query(query, parameters, configured.query_timeout_ms)
        row = rows[0] if rows else {}
        return StatsResponse(
            companies=int(row.get("companies", 0)),
            people=int(row.get("people", 0)),
            relationships=int(row.get("relationships", 0)),
        )

    @application.get("/api/company/{entity_id}", response_model=CompanyResponse)
    async def get_company(entity_id: str, request: Request) -> CompanyResponse:
        cache_key = CacheLayer.key("company_v2", entity_id)
        cached = await response_cache(request).get(cache_key)
        if cached is not None:
            return CompanyResponse.model_validate_json(cached)
        query, parameters = builder.match_company_by_id(entity_id)
        rows = await database(request).execute_query(query, parameters, configured.query_timeout_ms)
        if not rows:
            raise HTTPException(status_code=404, detail="Company not found")
        company = _company(rows[0].get("company"))
        await response_cache(request).set(cache_key, company.model_dump_json(), 3600)
        return company

    @application.get("/api/search", response_model=list[CompanyResponse])
    async def search_companies(
        request: Request,
        q: Annotated[str, Query(min_length=2, max_length=100)],
        limit: Annotated[int, Query(ge=1, le=100)] = 10,
    ) -> list[CompanyResponse]:
        cache_key = CacheLayer.key("search_v2", q.casefold(), limit)
        cached = await response_cache(request).get(cache_key)
        adapter = TypeAdapter(list[CompanyResponse])
        if cached is not None:
            return adapter.validate_json(cached)
        query, parameters = builder.search_by_name(q, limit)
        rows = await database(request).execute_query(query, parameters, configured.query_timeout_ms)
        companies = [_company(row.get("company")) for row in rows]
        await response_cache(request).set(cache_key, adapter.dump_json(companies).decode(), 900)
        return companies

    @application.get("/api/companies", response_model=list[CompanyResponse])
    async def list_companies(
        request: Request,
        limit: Annotated[int, Query(ge=1, le=2000)] = 1000,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> list[CompanyResponse]:
        cache_key = CacheLayer.key("company_master_v1", limit, offset)
        cached = await response_cache(request).get(cache_key)
        adapter = TypeAdapter(list[CompanyResponse])
        if cached is not None:
            return adapter.validate_json(cached)
        query, parameters = builder.list_companies(limit, offset)
        rows = await database(request).execute_query(query, parameters, configured.query_timeout_ms)
        companies = [_company(row.get("company")) for row in rows]
        await response_cache(request).set(cache_key, adapter.dump_json(companies).decode(), 900)
        return companies

    @application.get("/api/company/{entity_id}/relationships", response_model=NetworkResponse)
    async def get_relationships(
        entity_id: str,
        request: Request,
        depth: Annotated[int, Query(ge=1, le=5)] = 1,
        relationship_type: Annotated[RelationshipType | None, Query()] = None,
        limit: Annotated[int, Query(ge=1, le=1000)] = 500,
    ) -> NetworkResponse:
        cache_key = CacheLayer.key(
            "network_v4", entity_id, depth, relationship_type or "all", limit
        )
        cached = await response_cache(request).get(cache_key)
        if cached is not None:
            return NetworkResponse.model_validate_json(cached)
        company_query, company_parameters = builder.match_company_by_id(entity_id)
        company_rows = await database(request).execute_query(
            company_query, company_parameters, configured.query_timeout_ms
        )
        if not company_rows:
            raise HTTPException(status_code=404, detail="Company not found")
        center = _company(company_rows[0].get("company"))

        network_query, network_parameters = builder.match_company_relationships(
            entity_id, relationship_type, depth, limit
        )
        rows = await database(request).execute_query(
            network_query, network_parameters, configured.query_timeout_ms
        )
        graph_nodes: dict[str, GraphNodeResponse] = {
            center.entity_id: _node(center.model_dump(by_alias=True), center.entity_id)
        }
        graph_links: dict[str, GraphLinkResponse] = {}
        related: list[RelatedCompanyResponse] = []
        for path_index, row in enumerate(rows):
            raw_nodes = cast(list[object], row.get("nodes", []))
            path_nodes = [_node(node, center.entity_id) for node in raw_nodes]
            for node in path_nodes:
                graph_nodes[node.id] = node
            relationships = [
                RelationshipResponse.model_validate(item)
                for item in cast(list[object], row.get("relationships", []))
            ]
            for edge_index, relationship in enumerate(relationships):
                link = _link(relationship, path_index, edge_index)
                graph_links[link.id] = link
            raw_related = row.get("related")
            labels = row.get("related_labels", ["Company"])
            if isinstance(raw_related, dict) and isinstance(labels, list) and "Company" in labels:
                related.append(
                    RelatedCompanyResponse(
                        company=_company(raw_related),
                        nodes=[
                            _company(node.attributes)
                            for node in path_nodes
                            if node.category != "Person"
                        ],
                        relationships=relationships,
                        depth=int(row.get("depth", 1)),
                    )
                )
        nodes = list(graph_nodes.values())
        links = list(graph_links.values())
        confidence_values = [link.confidence for link in links if link.confidence is not None]
        summary = NetworkSummaryResponse(
            companies=sum(node.category != "Person" for node in nodes),
            people=sum(node.category == "Person" for node in nodes),
            subsidiaries=sum(node.category == "Subsidiary" for node in nodes),
            jurisdictions=len({node.jurisdiction for node in nodes if node.jurisdiction}),
            flagged_nodes=sum(bool(node.risk_flags) for node in nodes),
            interlocking_directors=sum(
                node.category == "Person" and "INTERLOCKING_DIRECTOR" in node.risk_flags
                for node in nodes
            ),
            average_confidence=(
                sum(confidence_values) / len(confidence_values) if confidence_values else None
            ),
        )
        network = NetworkResponse(
            center=center,
            related=related,
            nodes=nodes,
            links=links,
            summary=summary,
            depth=depth,
            total_nodes=len(nodes),
            total_relationships=len(links),
        )
        await response_cache(request).set(cache_key, network.model_dump_json(), 1800)
        return network

    return application


app = create_app()
