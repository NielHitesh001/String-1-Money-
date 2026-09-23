"""Company normalization, matching, and deterministic deduplication."""

from corpgraph.entity_resolution.matcher import calculate_match_confidence, fuzzy_match
from corpgraph.entity_resolution.normalizer import normalize_company_name
from corpgraph.entity_resolution.resolver import EntityResolutionPipeline, resolve_entities

__all__ = [
    "EntityResolutionPipeline",
    "calculate_match_confidence",
    "fuzzy_match",
    "normalize_company_name",
    "resolve_entities",
]
