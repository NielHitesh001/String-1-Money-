import pytest

from corpgraph.entity_resolution.matcher import calculate_match_confidence, fuzzy_match


@pytest.mark.parametrize(
    ("left", "right", "minimum"),
    [
        ("Tesla, Inc.", "Tesla Motors", 0.99),
        ("Apple Inc.", "Apple Computer Inc.", 0.99),
        ("Sony Corporation", "SONY CORP", 0.99),
        ("Microsoft", "Microsft", 0.80),
        ("Nestlé S.A.", "Nestle", 0.99),
    ],
)
def test_fuzzy_match(left: str, right: str, minimum: float) -> None:
    assert fuzzy_match(left, right) >= minimum


@pytest.mark.parametrize("method", ["token_sort", "token_set", "partial", "jaro_winkler"])
def test_fuzzy_match_methods(method: str) -> None:
    assert 0.8 <= fuzzy_match("Example Holding", "Example Holdings", method) <= 1


def test_fuzzy_match_handles_empty_names() -> None:
    assert fuzzy_match("", "Example") == 0


def test_fuzzy_match_rejects_unknown_method() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        fuzzy_match("A", "B", "unknown")


def test_exact_metadata_match_is_high_confidence() -> None:
    first = {
        "name": "Tesla, Inc.",
        "jurisdiction": "Delaware",
        "registration_num": "001318605",
        "incorporation_date": "2003-07-01",
    }
    second = {
        "legal_name": "Tesla Motors",
        "jurisdiction": "DE",
        "registration_number": "1318605",
        "incorporation_date": "2003",
    }
    assert calculate_match_confidence(first, second) == 1


def test_conflicting_registration_is_definitive_non_match() -> None:
    assert (
        calculate_match_confidence(
            {"name": "Example", "registration_number": "123"},
            {"name": "Example", "registration_number": "456"},
        )
        == 0
    )


def test_missing_metadata_renormalizes_available_weight() -> None:
    assert calculate_match_confidence({"name": "Acme LLC"}, {"name": "Acme Ltd"}) == 1


def test_no_comparable_fields_returns_zero() -> None:
    assert calculate_match_confidence({}, {}) == 0


def test_invalid_weights_are_rejected() -> None:
    with pytest.raises(ValueError, match="weights"):
        calculate_match_confidence({"name": "A"}, {"name": "A"}, {"name": -1})
