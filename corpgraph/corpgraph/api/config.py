"""Environment-backed API configuration without global mutable state."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class ApiSettings:
    """Runtime connection and query settings for the CorpGraph API."""

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "corpgraph-local"
    neo4j_database: str = "neo4j"
    redis_url: str = "redis://localhost:6379"
    query_timeout_ms: int = 30_000
    environment: str = "development"
    api_key: str | None = None
    rate_limit_per_minute: int = 120
    cors_origins: tuple[str, ...] = ("http://127.0.0.1:5174", "http://localhost:5174")

    @classmethod
    def from_env(cls, environment: Mapping[str, str] | None = None) -> ApiSettings:
        """Build settings from an explicit mapping or the process environment."""
        values = os.environ if environment is None else environment
        timeout = int(values.get("CORPGRAPH_QUERY_TIMEOUT_MS", "30000"))
        if not 1 <= timeout <= 30_000:
            raise ValueError("CORPGRAPH_QUERY_TIMEOUT_MS must be between 1 and 30000")
        environment_name = values.get("CORPGRAPH_ENV", "development").strip().casefold()
        if environment_name not in {"development", "test", "production"}:
            raise ValueError("CORPGRAPH_ENV must be development, test, or production")
        api_key = values.get("CORPGRAPH_API_KEY") or None
        if environment_name == "production" and (api_key is None or len(api_key) < 32):
            raise ValueError("CORPGRAPH_API_KEY must contain at least 32 characters in production")
        rate_limit = int(values.get("CORPGRAPH_RATE_LIMIT_PER_MINUTE", "120"))
        if not 1 <= rate_limit <= 10_000:
            raise ValueError("CORPGRAPH_RATE_LIMIT_PER_MINUTE must be between 1 and 10000")
        origins = tuple(
            origin.strip()
            for origin in values.get(
                "CORPGRAPH_CORS_ORIGINS",
                "http://127.0.0.1:5174,http://localhost:5174",
            ).split(",")
            if origin.strip()
        )
        if "*" in origins:
            raise ValueError("CORPGRAPH_CORS_ORIGINS must not contain a wildcard")
        return cls(
            neo4j_uri=values.get("NEO4J_URI", "bolt://localhost:7687"),
            neo4j_user=values.get("NEO4J_USER", "neo4j"),
            neo4j_password=values.get("NEO4J_PASSWORD", "corpgraph-local"),
            neo4j_database=values.get("NEO4J_DATABASE", "neo4j"),
            redis_url=values.get("REDIS_URL", "redis://localhost:6379"),
            query_timeout_ms=timeout,
            environment=environment_name,
            api_key=api_key,
            rate_limit_per_minute=rate_limit,
            cors_origins=origins,
        )
