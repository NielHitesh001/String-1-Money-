import pytest

from corpgraph.entity_resolution.normalizer import (
    extract_jurisdiction,
    extract_registration_number,
    normalize_company_name,
    normalize_jurisdiction,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Tesla, Inc.", "tesla"),
        ("Apple Computer Company, Inc.", "apple computer company"),
        ("SONY CORPORATION", "sony"),
        ("BMW AG", "bmw"),
        ("Nestlé S.A.", "nestle"),
        ("  Microsoft  Corp.  ", "microsoft"),
        ("Acme Holdings LLC", "acme holdings"),
        ("Marks & Spencer PLC", "marks and spencer"),
        ("Example Pte. Ltd.", "example"),
        ("Zürich Versicherungs AG", "zurich versicherungs"),
        ("A.B.C. Limited", "a b c"),
        ("", ""),
    ],
)
def test_normalize_company_name(raw: str, expected: str) -> None:
    assert normalize_company_name(raw) == expected


def test_normalize_company_name_requires_string() -> None:
    with pytest.raises(TypeError):
        normalize_company_name(None)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("address", "expected"),
    [
        ("1 Main Street, Wilmington, DE", "delaware"),
        ("London, UK", "united kingdom"),
        ("San Francisco CA", "california"),
        ("Paris, France", "france"),
        ("Unknown Place", ""),
        ("", ""),
    ],
)
def test_extract_jurisdiction(address: str, expected: str) -> None:
    assert extract_jurisdiction(address) == expected


def test_normalize_jurisdiction_alias() -> None:
    assert normalize_jurisdiction("U.S.A.") == "united states"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("CIK: 0000320193", "320193"),
        ("Company No. 01234567", "1234567"),
        ("Registration Number: DE-ABC-009", "DEABC009"),
        ("", ""),
        ("0000", "0"),
    ],
)
def test_extract_registration_number(raw: str, expected: str) -> None:
    assert extract_registration_number(raw) == expected
