"""RapidFuzz-based company similarity and confidence scoring."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime

from rapidfuzz import fuzz
from rapidfuzz.distance import JaroWinkler

from corpgraph.entity_resolution.normalizer import (
    extract_registration_number,
    normalize_company_name,
    normalize_jurisdiction,
)

DEFAULT_WEIGHTS = {
    "name": 0.4,
    "jurisdiction": 0.3,
    "registration_number": 0.2,
    "incorporation_date": 0.1,
}


def fuzzy_match(name1: str, name2: str, method: str = "token_sort") -> float:
    """Return a normalized name similarity score between zero and one.

    Supported methods are ``token_sort``, ``token_set``, ``partial``, and
    ``jaro_winkler``. Token-sort also recognizes a complete token subset, which handles legal
    renames such as ``Tesla`` and ``Tesla Motors`` conservatively.
    """
    left = normalize_company_name(name1)
    right = normalize_company_name(name2)
    if not left or not right:
        return 0.0
    scorers = {
        "token_sort": lambda: (
            max(fuzz.token_sort_ratio(left, right), fuzz.token_set_ratio(left, right)) / 100
        ),
        "token_set": lambda: fuzz.token_set_ratio(left, right) / 100,
        "partial": lambda: fuzz.partial_ratio(left, right) / 100,
        "jaro_winkler": lambda: JaroWinkler.normalized_similarity(left, right),
    }
    if method not in scorers:
        raise ValueError(f"Unsupported fuzzy matching method: {method}")
    return round(float(scorers[method]()), 6)


def _first_value(company: Mapping[str, object], *keys: str) -> str:
    for key in keys:
        value = company.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _year(value: str) -> str:
    if not value:
        return ""
    try:
        return str(datetime.fromisoformat(value.replace("Z", "+00:00")).year)
    except ValueError:
        return value[:4] if len(value) >= 4 and value[:4].isdigit() else ""


def calculate_match_confidence(
    company1: Mapping[str, object],
    company2: Mapping[str, object],
    weights: Mapping[str, float] | None = None,
) -> float:
    """Calculate an evidence-weighted confidence score for two company records.

    Missing fields are excluded and remaining weights are renormalized. Conflicting populated
    registration numbers are strong negative evidence and prevent name-only false positives.
    """
    selected_weights = dict(DEFAULT_WEIGHTS if weights is None else weights)
    invalid_weight = any(weight < 0 for weight in selected_weights.values())
    if invalid_weight or not sum(selected_weights.values()):
        raise ValueError("weights must be non-negative and have a positive sum")

    name1 = _first_value(company1, "name", "legal_name")
    name2 = _first_value(company2, "name", "legal_name")
    jurisdiction1 = normalize_jurisdiction(_first_value(company1, "jurisdiction"))
    jurisdiction2 = normalize_jurisdiction(_first_value(company2, "jurisdiction"))
    registration1 = extract_registration_number(
        _first_value(company1, "registration_number", "registration_num", "registration_id")
    )
    registration2 = extract_registration_number(
        _first_value(company2, "registration_number", "registration_num", "registration_id")
    )
    date1 = _year(_first_value(company1, "incorporation_date"))
    date2 = _year(_first_value(company2, "incorporation_date"))

    evidence: dict[str, float] = {}
    if name1 and name2:
        evidence["name"] = fuzzy_match(name1, name2, "token_sort")
    if jurisdiction1 and jurisdiction2:
        evidence["jurisdiction"] = 1.0 if jurisdiction1 == jurisdiction2 else 0.0
    if registration1 and registration2:
        if registration1 != registration2:
            return 0.0
        evidence["registration_number"] = 1.0
    if date1 and date2:
        evidence["incorporation_date"] = 1.0 if date1 == date2 else 0.0

    applicable = {field: selected_weights.get(field, 0.0) for field in evidence}
    denominator = sum(applicable.values())
    if denominator == 0:
        return 0.0
    score = sum(evidence[field] * weight for field, weight in applicable.items()) / denominator
    return round(score, 6)
