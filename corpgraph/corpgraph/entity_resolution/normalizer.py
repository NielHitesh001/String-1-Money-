"""Conservative normalization helpers for cross-source company matching."""

from __future__ import annotations

import re
import unicodedata

CORPORATE_SUFFIXES = {
    "ab",
    "ag",
    "as",
    "bv",
    "corp",
    "corporation",
    "gmbh",
    "inc",
    "incorporated",
    "kk",
    "llc",
    "llp",
    "lp",
    "ltd",
    "limited",
    "nv",
    "oy",
    "plc",
    "pte",
    "pty",
    "sa",
    "sas",
    "spa",
    "srl",
}

DOTTED_SUFFIXES = {
    ("a", "g"),
    ("b", "v"),
    ("l", "l", "c"),
    ("n", "v"),
    ("p", "l", "c"),
    ("s", "a"),
    ("s", "p", "a"),
    ("s", "r", "l"),
}

JURISDICTION_ALIASES = {
    "ca": "california",
    "calif": "california",
    "de": "delaware",
    "ny": "new york",
    "uk": "united kingdom",
    "u k": "united kingdom",
    "usa": "united states",
    "u s a": "united states",
    "us": "united states",
    "u s": "united states",
}

KNOWN_JURISDICTIONS = {
    "california",
    "canada",
    "china",
    "delaware",
    "france",
    "germany",
    "india",
    "ireland",
    "japan",
    "netherlands",
    "new york",
    "singapore",
    "switzerland",
    "united kingdom",
    "united states",
}


def _ascii_text(value: str) -> str:
    """Fold Unicode accents while retaining readable Latin characters."""
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii")


def normalize_company_name(name: str) -> str:
    """Normalize a legal company name for matching.

    Punctuation, accents, repeated whitespace, and trailing legal-form suffixes are removed.
    Meaningful words such as ``company`` and ``holdings`` are retained.
    """
    if not isinstance(name, str):
        raise TypeError("company name must be a string")
    value = _ascii_text(name).casefold().replace("&", " and ")
    tokens = re.sub(r"[^a-z0-9]+", " ", value).split()
    changed = True
    while tokens and changed:
        changed = False
        if tokens[-1] in CORPORATE_SUFFIXES:
            tokens.pop()
            changed = True
            continue
        for suffix in DOTTED_SUFFIXES:
            if len(tokens) >= len(suffix) and tuple(tokens[-len(suffix) :]) == suffix:
                del tokens[-len(suffix) :]
                changed = True
                break
    return " ".join(tokens)


def normalize_jurisdiction(value: str) -> str:
    """Normalize a jurisdiction name or common abbreviation."""
    cleaned = re.sub(r"[^a-z]+", " ", _ascii_text(value).casefold()).strip()
    return JURISDICTION_ALIASES.get(cleaned, cleaned)


def extract_jurisdiction(address: str) -> str:
    """Extract a recognized state or country from an address, if present."""
    if not address:
        return ""
    parts = [part.strip() for part in re.split(r"[,;|]", address) if part.strip()]
    for part in reversed(parts or [address]):
        normalized = normalize_jurisdiction(part)
        if normalized in KNOWN_JURISDICTIONS:
            return normalized
        words = normalized.split()
        for width in (3, 2, 1):
            candidate = " ".join(words[-width:])
            candidate = JURISDICTION_ALIASES.get(candidate, candidate)
            if candidate in KNOWN_JURISDICTIONS:
                return candidate
    return ""


def extract_registration_number(value: str) -> str:
    """Remove labels and punctuation from a company registration identifier."""
    if not value:
        return ""
    cleaned = re.sub(
        r"^(?:cik|company\s+no\.?|company\s+number|registration\s+(?:no\.?|number))"
        r"\s*[:#-]?\s*",
        "",
        value.strip(),
        flags=re.IGNORECASE,
    )
    identifier = re.sub(r"[^A-Za-z0-9]", "", cleaned).upper()
    if identifier.isdigit():
        return identifier.lstrip("0") or "0"
    return identifier
