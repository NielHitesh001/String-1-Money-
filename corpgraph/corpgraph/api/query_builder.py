"""Allowlisted, parameterized Cypher queries for the public API."""

from __future__ import annotations

import re
from typing import TypeAlias

QueryParameters: TypeAlias = dict[str, object]
BuiltQuery: TypeAlias = tuple[str, QueryParameters]

ALLOWED_RELATIONSHIP_TYPES = frozenset(
    {
        "CO_PATENT_HOLDER",
        "DIRECTOR_OF",
        "HAS_SUBSIDIARY",
        "OFFICER_AT",
        "OWNS",
        "PARENT_OF",
        "SUPPLIER_TO",
    }
)

_WRITE_KEYWORDS = re.compile(
    r"\b(?:CREATE|DELETE|DETACH|DROP|LOAD\s+CSV|MERGE|REMOVE|SET)\b",
    re.IGNORECASE,
)
_COMMENT_OR_TERMINATOR = re.compile(r";|//|/\*|\*/")
_LUCENE_SPECIAL = re.compile(r"(\&\&|\|\||[+\-!(){}\[\]^\"~*?:\\/])")


class SafeQueryBuilder:
    """Build read-only Cypher with all user-controlled values in parameters."""

    @staticmethod
    def validate_query(query: str) -> bool:
        """Return whether a query is a non-empty, single, read-only Cypher statement."""
        stripped = query.strip()
        return (
            bool(stripped)
            and not _WRITE_KEYWORDS.search(stripped)
            and not (_COMMENT_OR_TERMINATOR.search(stripped))
        )

    @classmethod
    def _finalize(cls, query: str, parameters: QueryParameters) -> BuiltQuery:
        normalized = "\n".join(line.strip() for line in query.strip().splitlines())
        if not cls.validate_query(normalized):
            raise ValueError("Unsafe Cypher query generated")
        return normalized, parameters

    @staticmethod
    def _required(value: str, field: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError(f"{field} must not be empty")
        return cleaned

    @staticmethod
    def _limit(value: int, maximum: int = 1000) -> int:
        if type(value) is not int or not 1 <= value <= maximum:
            raise ValueError(f"limit must be between 1 and {maximum}")
        return value

    def match_company_by_id(self, entity_id: str) -> BuiltQuery:
        """Build an exact company lookup without interpolating the identifier."""
        return self._finalize(
            """
            MATCH (company:Company {entity_id: $entity_id})
            RETURN company {.*} AS company
            """,
            {"entity_id": self._required(entity_id, "entity_id")},
        )

    def search_by_name(self, query_text: str, limit: int = 10) -> BuiltQuery:
        """Build an indexed full-text company search with a bounded result count."""
        cleaned = self._required(query_text, "query_text")
        lucene_query = _LUCENE_SPECIAL.sub(r"\\\1", cleaned)
        return self._finalize(
            """
            CALL db.index.fulltext.queryNodes(
                'company_search_v2', $query_text, {limit: $limit}
            ) YIELD node, score
            RETURN node {.*} AS company, score
            ORDER BY score DESC, node.legal_name ASC
            """,
            {
                "query_text": lucene_query,
                "limit": self._limit(limit, 100),
            },
        )

    def list_companies(self, limit: int = 1000, offset: int = 0) -> BuiltQuery:
        """Build a stable, paginated security-master listing."""
        if type(offset) is not int or offset < 0:
            raise ValueError("offset must be zero or greater")
        return self._finalize(
            """
            MATCH (company:Company)
            RETURN company {.*} AS company
            ORDER BY company.legal_name ASC, company.entity_id ASC
            SKIP $offset
            LIMIT $limit
            """,
            {"offset": offset, "limit": self._limit(limit, 2000)},
        )

    def match_company_relationships(
        self,
        entity_id: str,
        relationship_type: str | None = None,
        depth: int = 1,
        limit: int = 500,
    ) -> BuiltQuery:
        """Build a bounded N-degree company network query.

        Cypher cannot parameterize a variable-length relationship bound. The depth is therefore
        validated as an integer in the closed range 1-5 before being inserted into the static
        query structure. All user strings remain parameters.
        """
        if type(depth) is not int or not 1 <= depth <= 5:
            raise ValueError("depth must be between 1 and 5")
        if relationship_type is not None and relationship_type not in ALLOWED_RELATIONSHIP_TYPES:
            raise ValueError("relationship_type is not allowlisted")
        return self._finalize(
            f"""
            MATCH (center:Company {{entity_id: $entity_id}})
            MATCH path = (center)-[*1..{depth}]-(related)
            WHERE (related:Company OR related:Person)
              AND ($relationship_type IS NULL
               OR ALL(edge IN relationships(path) WHERE type(edge) = $relationship_type)
              )
            WITH center, related, path
            ORDER BY length(path), related.legal_name
            LIMIT $limit
            RETURN related {{.*}} AS related,
                   labels(related) AS related_labels,
                   [node IN nodes(path) |
                       {{labels: labels(node), properties: node {{.*}}}}] AS nodes,
                   [edge IN relationships(path) |
                       {{type: type(edge), edge_id: elementId(edge),
                         source: startNode(edge).entity_id, target: endNode(edge).entity_id,
                         properties: properties(edge)}}] AS relationships,
                   length(path) AS depth
            """,
            {
                "entity_id": self._required(entity_id, "entity_id"),
                "relationship_type": relationship_type,
                "limit": self._limit(limit),
            },
        )

    def match_interlocking_directorates(self, person_id: str, limit: int = 100) -> BuiltQuery:
        """Build a query for companies sharing a director or officer."""
        return self._finalize(
            """
            MATCH (person:Person {entity_id: $person_id})
                  -[position:DIRECTOR_OF|OFFICER_AT]->(company:Company)
            RETURN person {.*} AS person,
                   company {.*} AS company,
                   type(position) AS relationship_type,
                   position {.*} AS position
            ORDER BY company.legal_name
            LIMIT $limit
            """,
            {
                "person_id": self._required(person_id, "person_id"),
                "limit": self._limit(limit, 100),
            },
        )

    def graph_statistics(self) -> BuiltQuery:
        """Build a query returning company, person, and relationship counts."""
        return self._finalize(
            """
            CALL () { MATCH (company:Company) RETURN count(company) AS companies }
            CALL () { MATCH (person:Person) RETURN count(person) AS people }
            OPTIONAL MATCH ()-[relationship]->()
            RETURN companies, people, count(relationship) AS relationships
            """,
            {},
        )
