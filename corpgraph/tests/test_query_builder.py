import pytest

from corpgraph.api.query_builder import ALLOWED_RELATIONSHIP_TYPES, SafeQueryBuilder


@pytest.fixture
def builder() -> SafeQueryBuilder:
    return SafeQueryBuilder()


def test_company_lookup_parameterizes_malicious_identifier(builder: SafeQueryBuilder) -> None:
    malicious = 'ent_abc"; MATCH (n) DELETE n //'
    query, parameters = builder.match_company_by_id(malicious)
    assert malicious not in query
    assert parameters == {"entity_id": malicious}
    assert builder.validate_query(query)


def test_search_is_parameterized_and_bounded(builder: SafeQueryBuilder) -> None:
    malicious = "Tesla') YIELD node MATCH (n) DELETE n //"
    query, parameters = builder.search_by_name(malicious, 5)
    assert malicious not in query
    assert parameters["limit"] == 5
    assert parameters["query_text"] != malicious
    assert "\\)" in str(parameters["query_text"])
    assert "company_search_v2" in query


def test_company_master_is_parameterized_and_bounded(builder: SafeQueryBuilder) -> None:
    query, parameters = builder.list_companies(limit=500, offset=25)
    assert parameters == {"offset": 25, "limit": 500}
    assert "SKIP $offset" in query
    assert "LIMIT $limit" in query


@pytest.mark.parametrize("limit,offset", [(0, 0), (2001, 0), (10, -1)])
def test_company_master_rejects_invalid_bounds(
    builder: SafeQueryBuilder, limit: int, offset: int
) -> None:
    with pytest.raises(ValueError):
        builder.list_companies(limit=limit, offset=offset)


@pytest.mark.parametrize("limit", [0, 101])
def test_search_rejects_invalid_limit(builder: SafeQueryBuilder, limit: int) -> None:
    with pytest.raises(ValueError, match="limit"):
        builder.search_by_name("Tesla", limit)


def test_relationship_query_binds_values_and_bounds_depth(builder: SafeQueryBuilder) -> None:
    query, parameters = builder.match_company_relationships(
        "ent_123", "HAS_SUBSIDIARY", depth=3, limit=250
    )
    assert "[*1..3]" in query
    assert "ent_123" not in query
    assert "HAS_SUBSIDIARY" not in query
    assert parameters == {
        "entity_id": "ent_123",
        "relationship_type": "HAS_SUBSIDIARY",
        "limit": 250,
    }


@pytest.mark.parametrize("depth", [0, 6])
def test_relationship_query_rejects_invalid_depth(builder: SafeQueryBuilder, depth: int) -> None:
    with pytest.raises(ValueError, match="depth"):
        builder.match_company_relationships("ent_123", depth=depth)


def test_relationship_query_rejects_non_allowlisted_type(builder: SafeQueryBuilder) -> None:
    assert len(ALLOWED_RELATIONSHIP_TYPES) == 7
    with pytest.raises(ValueError, match="allowlisted"):
        builder.match_company_relationships("ent_123", "HAS_SUBSIDIARY]->(n) DELETE n")


def test_relationship_query_allows_unfiltered_network(builder: SafeQueryBuilder) -> None:
    _query, parameters = builder.match_company_relationships("ent_123")
    assert parameters["relationship_type"] is None


def test_interlocking_directorates_is_parameterized(builder: SafeQueryBuilder) -> None:
    query, parameters = builder.match_interlocking_directorates("person_123", limit=20)
    assert "person_123" not in query
    assert parameters == {"person_id": "person_123", "limit": 20}
    assert "DIRECTOR_OF|OFFICER_AT" in query


def test_graph_statistics_has_no_parameters(builder: SafeQueryBuilder) -> None:
    query, parameters = builder.graph_statistics()
    assert parameters == {}
    assert "companies" in query
    assert "relationships" in query


@pytest.mark.parametrize(
    "query",
    [
        "",
        "MATCH (n) DELETE n",
        "MATCH (n) RETURN n; MATCH (m) RETURN m",
        "MATCH (n) RETURN n // comment",
        "MATCH (n) /* comment */ RETURN n",
        "CREATE (n:Company)",
        "MERGE (n:Company {id: 1}) RETURN n",
        "MATCH (n) SET n.name = 'x' RETURN n",
        "LOAD CSV FROM 'https://example.test' AS row RETURN row",
    ],
)
def test_validate_query_rejects_unsafe_statements(builder: SafeQueryBuilder, query: str) -> None:
    assert not builder.validate_query(query)


@pytest.mark.parametrize(
    "method,args",
    [
        ("match_company_by_id", ("  ",)),
        ("search_by_name", ("",)),
        ("match_interlocking_directorates", (" ",)),
    ],
)
def test_required_identifiers_reject_empty_values(
    builder: SafeQueryBuilder, method: str, args: tuple[object, ...]
) -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        getattr(builder, method)(*args)


def test_network_limit_is_bounded(builder: SafeQueryBuilder) -> None:
    with pytest.raises(ValueError, match="limit"):
        builder.match_company_relationships("ent_123", limit=1001)


def test_interlock_limit_is_bounded(builder: SafeQueryBuilder) -> None:
    with pytest.raises(ValueError, match="limit"):
        builder.match_interlocking_directorates("person_123", limit=101)


def test_finalize_refuses_unsafe_internal_query() -> None:
    with pytest.raises(ValueError, match="Unsafe"):
        SafeQueryBuilder._finalize("MATCH (n) DELETE n", {})
