"""Focused tests for Prometheus metric aggregation and label normalization."""

from __future__ import annotations

import pytest

from corpgraph.api.metrics import MetricsRegistry, normalized_route


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/api/company/acme", "/api/company/{entity_id}"),
        (
            "/api/company/acme/relationships",
            "/api/company/{entity_id}/relationships",
        ),
        ("/api/search", "/api/search"),
        ("/unexpected/value", "other"),
    ],
)
def test_normalized_route(path: str, expected: str) -> None:
    assert normalized_route(path) == expected


@pytest.mark.asyncio
async def test_registry_renders_escaped_prometheus_labels() -> None:
    registry = MetricsRegistry()
    await registry.record('G"ET', "/line\nbreak", 200, 0.25)
    output = await registry.render()
    assert 'method="G\\"ET"' in output
    assert 'route="/line\\nbreak"' in output
    assert "corpgraph_http_requests_total" in output
    assert output.endswith("\n")
