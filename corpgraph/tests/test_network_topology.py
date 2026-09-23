"""Ensure graph responses preserve directed topology and count unique records."""

from collections.abc import Mapping
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_api_endpoints import FakeCache, FakeGraphClient, company

from corpgraph.api.graph_client import GraphQueryError
from corpgraph.api.main import _link, _node, create_app
from corpgraph.api.models import RelationshipResponse
from corpgraph.api.query_builder import SafeQueryBuilder


def test_directed_topology_survives_cache_and_repeated_paths() -> None:
    class TopologyGraph(FakeGraphClient):
        async def execute_query(
            self,
            query: str,
            params: Mapping[str, object] | None = None,
            timeout_ms: int = 30_000,
        ) -> list[dict[str, Any]]:
            if "MATCH path" not in query:
                return await super().execute_query(query, params, timeout_ms)
            assert "startNode(edge).entity_id" in query
            assert "endNode(edge).entity_id" in query
            row = {
                "related": company("ent_3", "Grandchild"),
                "nodes": [company("ent_2", "Intermediate"), company("ent_3", "Grandchild")],
                "relationships": [
                    {
                        "type": "HAS_SUBSIDIARY",
                        "edge_id": "edge-1",
                        "source": "ent_2",
                        "target": "ent_3",
                        "properties": {},
                    }
                ],
                "depth": 2,
            }
            return [row, row]

    with TestClient(create_app(graph_client=TopologyGraph(), cache_layer=FakeCache())) as client:
        result = client.get("/api/company/ent_1/relationships?depth=2").json()
        assert result["total_nodes"] == 3
        assert result["total_relationships"] == 1
        assert result["related"][0]["relationships"][0]["source"] == "ent_2"
        assert result["links"][0]["source"] == "ent_2"
        assert result["summary"]["flagged_nodes"] == 3
        assert client.get("/api/company/ent_1/relationships?depth=2").json() == result


@pytest.mark.parametrize("value", [True, 1.5, "1"])
def test_depth_rejects_non_integer_runtime_values(value: Any) -> None:
    with pytest.raises(ValueError, match="depth"):
        SafeQueryBuilder().match_company_relationships("ent_1", depth=value)


@pytest.mark.parametrize("value", [True, 1.5, "1"])
def test_limit_rejects_non_integer_runtime_values(value: Any) -> None:
    with pytest.raises(ValueError, match="limit"):
        SafeQueryBuilder().search_by_name("Company", limit=value)


def test_graph_projection_validates_and_classifies_all_node_types() -> None:
    with pytest.raises(GraphQueryError, match="invalid graph node"):
        _node(None, "center")
    with pytest.raises(GraphQueryError, match="without an identifier"):
        _node({}, "center")
    person = _node({"labels": "invalid", "entity_id": "person", "entity_type": "Person"}, "center")
    assert person.category == "Person"
    holding = _node(
        {"entity_id": "holding", "entity_type": "Holding Company", "risk_flags": "invalid"},
        "center",
    )
    assert holding.category == "HoldingCompany"
    assert holding.risk_flags == []


def test_graph_link_requires_endpoints() -> None:
    with pytest.raises(GraphQueryError, match="without endpoints"):
        _link(RelationshipResponse(type="OWNS"), 0, 0)
