"""Low-cardinality Prometheus metrics for CorpGraph HTTP operations."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import monotonic

from starlette.types import ASGIApp, Message, Receive, Scope, Send


def normalized_route(path: str) -> str:
    """Collapse identifier-bearing paths into stable metric labels."""
    if path.startswith("/api/company/"):
        if path.endswith("/relationships"):
            return "/api/company/{entity_id}/relationships"
        return "/api/company/{entity_id}"
    if path in {"/api/search", "/api/stats", "/health", "/ready", "/metrics"}:
        return path
    return "other"


def _label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


@dataclass
class MetricValue:
    """Aggregated request count and duration for one label set."""

    count: int = 0
    duration_seconds: float = 0.0


class MetricsRegistry:
    """Concurrency-safe, process-local HTTP metric aggregation."""

    def __init__(self) -> None:
        self._values: dict[tuple[str, str, int], MetricValue] = {}
        self._lock = asyncio.Lock()

    async def record(self, method: str, route: str, status: int, duration: float) -> None:
        """Record one completed HTTP operation."""
        key = (method, route, status)
        async with self._lock:
            value = self._values.setdefault(key, MetricValue())
            value.count += 1
            value.duration_seconds += duration

    async def render(self) -> str:
        """Render the Prometheus text exposition format."""
        lines = [
            "# HELP corpgraph_http_requests_total Completed HTTP requests.",
            "# TYPE corpgraph_http_requests_total counter",
            "# HELP corpgraph_http_request_duration_seconds HTTP request duration.",
            "# TYPE corpgraph_http_request_duration_seconds summary",
        ]
        async with self._lock:
            snapshot = sorted(self._values.items())
        for (method, route, status), value in snapshot:
            labels = (
                f'method="{_label(method)}",route="{_label(route)}",status="{status}"'
            )
            lines.append(f"corpgraph_http_requests_total{{{labels}}} {value.count}")
            lines.append(
                "corpgraph_http_request_duration_seconds_sum"
                f"{{{labels}}} {value.duration_seconds:.9f}"
            )
            lines.append(
                "corpgraph_http_request_duration_seconds_count"
                f"{{{labels}}} {value.count}"
            )
        return "\n".join(lines) + "\n"


class HttpMetricsMiddleware:
    """Measure HTTP responses while keeping route labels bounded."""

    def __init__(self, app: ASGIApp, *, registry: MetricsRegistry) -> None:
        self._app = app
        self._registry = registry

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        started = monotonic()
        status = 500

        async def capture_status(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
            await send(message)

        try:
            await self._app(scope, receive, capture_status)
        finally:
            await self._registry.record(
                str(scope.get("method", "UNKNOWN")),
                normalized_route(str(scope.get("path", ""))),
                status,
                monotonic() - started,
            )
