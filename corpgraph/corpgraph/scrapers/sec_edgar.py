"""SEC EDGAR 10-K Exhibit 21 subsidiary extractor."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import yaml
from bs4 import BeautifulSoup

from corpgraph.common.base_scraper import BaseScraper, ScraperError
from corpgraph.models import Company, ExtractionResult, Provenance, Relationship, stable_id

logger = logging.getLogger(__name__)

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data"
EXHIBIT_TYPE_PATTERN = re.compile(r"^EX[- ]?21(?:\.|$)", re.IGNORECASE)
JURISDICTION_WORDS = {
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
    "canada",
    "china",
    "france",
    "germany",
    "ireland",
    "japan",
    "netherlands",
    "singapore",
    "switzerland",
    "united kingdom",
    "united states",
}


@dataclass(frozen=True)
class Filing:
    """The minimum filing coordinates needed to locate an Exhibit 21."""

    accession_number: str
    primary_document: str
    filing_date: date


@dataclass(frozen=True)
class SubsidiaryDisclosure:
    """A subsidiary name with an optional disclosed jurisdiction."""

    legal_name: str
    jurisdiction: str | None = None


def normalize_cik(cik: str) -> str:
    """Validate and left-pad a CIK for the SEC submissions endpoint."""
    digits = cik.strip().lstrip("0") or "0"
    if not digits.isdigit() or len(digits) > 10:
        raise ValueError("CIK must contain at most 10 digits")
    return digits.zfill(10)


def latest_10k(submissions: dict[str, Any]) -> Filing:
    """Select the most recent 10-K from an SEC submissions response."""
    recent = submissions.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    for index, form in enumerate(forms):
        if form == "10-K":
            try:
                return Filing(
                    accession_number=recent["accessionNumber"][index],
                    primary_document=recent["primaryDocument"][index],
                    filing_date=date.fromisoformat(recent["filingDate"][index]),
                )
            except (IndexError, KeyError, TypeError, ValueError) as exc:
                raise ScraperError("Malformed SEC recent-filings data") from exc
    raise ScraperError("No recent 10-K filing found")


def find_exhibit_21(index_html: str, index_url: str) -> str:
    """Return the absolute document URL for the first Exhibit 21 row."""
    soup = BeautifulSoup(index_html, "html.parser")
    for row in soup.select("table.tableFile tr"):
        cells = row.find_all("td")
        if len(cells) < 4 or not EXHIBIT_TYPE_PATTERN.search(cells[3].get_text(" ", strip=True)):
            continue
        link = row.find("a", href=True)
        if link:
            from urllib.parse import urljoin

            return urljoin(index_url, str(link["href"]))
    raise ScraperError("The selected 10-K does not list an Exhibit 21 document")


def _clean_cell(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip(" \t\r\n.;")


def parse_subsidiaries(exhibit_html: str) -> list[SubsidiaryDisclosure]:
    """Extract likely subsidiary rows from an Exhibit 21 HTML document.

    SEC issuers use many layouts. Tables are preferred; a conservative line-based fallback
    handles simple text exhibits. Headers and empty values are excluded.
    """
    soup = BeautifulSoup(exhibit_html, "html.parser")
    disclosures: list[SubsidiaryDisclosure] = []
    seen: set[tuple[str, str | None]] = set()

    def add(name: str, jurisdiction: str | None = None) -> None:
        clean_name = _clean_cell(name)
        clean_jurisdiction = _clean_cell(jurisdiction or "") or None
        lowered = clean_name.casefold()
        lowered_jurisdiction = clean_jurisdiction.casefold() if clean_jurisdiction else ""
        if (
            len(clean_name) < 2
            or lowered in {"name", "subsidiary", "subsidiaries", "entity name"}
            or "jurisdiction" in lowered
            or "state of incorporation" in lowered
            or "jurisdiction" in lowered_jurisdiction
            or "state of incorporation" in lowered_jurisdiction
        ):
            return
        key = (lowered, lowered_jurisdiction or None)
        if key not in seen:
            seen.add(key)
            disclosures.append(SubsidiaryDisclosure(clean_name, clean_jurisdiction))

    for row in soup.select("tr"):
        cells = [_clean_cell(cell.get_text(" ", strip=True)) for cell in row.find_all(["td", "th"])]
        cells = [cell for cell in cells if cell]
        if not cells:
            continue
        jurisdiction = cells[1] if len(cells) > 1 else None
        add(cells[0], jurisdiction)

    if not disclosures:
        for line in soup.get_text("\n").splitlines():
            raw_line = line.replace("\xa0", " ").strip()
            if not raw_line:
                continue
            parts = re.split(r"\s{2,}|\t+", raw_line, maxsplit=1)
            name = _clean_cell(parts[0])
            jurisdiction = _clean_cell(parts[1]) if len(parts) == 2 else None
            if jurisdiction and jurisdiction.casefold() not in JURISDICTION_WORDS:
                jurisdiction = None
            add(name, jurisdiction)
    return disclosures


class SecEdgarScraper(BaseScraper):
    """Collect the newest 10-K subsidiary disclosure for one SEC registrant."""

    def __init__(
        self,
        *,
        submissions_url: str = SUBMISSIONS_URL,
        archives_base_url: str = ARCHIVES_BASE_URL,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._submissions_url = submissions_url
        self._archives_base_url = archives_base_url.rstrip("/")

    async def scrape(self, cik: str) -> ExtractionResult:
        padded_cik = normalize_cik(cik)
        submissions = await self.get_json(self._submissions_url.format(cik=padded_cik))
        filing = latest_10k(submissions)
        accession_path = filing.accession_number.replace("-", "")
        cik_path = str(int(padded_cik))
        filing_dir = f"{self._archives_base_url}/{cik_path}/{accession_path}"
        index_url = f"{filing_dir}/{filing.accession_number}-index.html"
        exhibit_url = find_exhibit_21((await self.get(index_url)).text, index_url)
        subsidiaries = parse_subsidiaries((await self.get(exhibit_url)).text)

        parent_name = str(submissions.get("name") or "").strip()
        if not parent_name:
            raise ScraperError("SEC submissions response did not include a registrant name")
        provenance = Provenance(
            source="sec_edgar",
            source_url=exhibit_url,
            accession_number=filing.accession_number,
            filing_date=filing.filing_date,
        )
        parent_id = stable_id("SEC", padded_cik)
        companies = [
            Company(
                entity_id=parent_id,
                legal_name=parent_name,
                registration_number=padded_cik,
                provenance=provenance,
            )
        ]
        relationships: list[Relationship] = []
        for disclosure in subsidiaries:
            child_id = stable_id(
                "SEC-SUB", padded_cik, disclosure.legal_name, disclosure.jurisdiction or ""
            )
            companies.append(
                Company(
                    entity_id=child_id,
                    legal_name=disclosure.legal_name,
                    jurisdiction=disclosure.jurisdiction,
                    provenance=provenance,
                )
            )
            relationships.append(
                Relationship(
                    relationship_id=stable_id("REL", parent_id, child_id, "HAS_SUBSIDIARY"),
                    relationship_type="HAS_SUBSIDIARY",
                    from_entity_id=parent_id,
                    to_entity_id=child_id,
                    confidence=1.0,
                    provenance=provenance,
                )
            )
        return ExtractionResult(
            companies=companies,
            relationships=relationships,
            metadata={
                "cik": padded_cik,
                "filing_primary_document": filing.primary_document,
                "subsidiary_count": len(subsidiaries),
            },
        )


def load_sec_config(path: Path) -> dict[str, Any]:
    """Load and validate the SEC section of the centralized scraper configuration."""
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("sec_edgar"), dict):
        raise ValueError("Configuration must contain a sec_edgar mapping")
    section = payload["sec_edgar"]
    return {
        "submissions_url": str(section["submissions_url"]),
        "archives_base_url": str(section["archives_base_url"]),
        "requests_per_second": float(section["requests_per_second"]),
        "timeout_seconds": float(section["timeout_seconds"]),
        "max_retries": int(section["max_retries"]),
        "backoff_seconds": float(section["backoff_seconds"]),
    }


async def _run(cik: str, output: Path, user_agent: str, settings: dict[str, Any]) -> None:
    async with SecEdgarScraper(user_agent=user_agent, **settings) as scraper:
        result = await scraper.scrape(cik)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("sec_extraction_complete", extra={"cik": cik, "output": str(output)})


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cik", required=True, help="SEC Central Index Key")
    parser.add_argument("--output", type=Path, required=True, help="Destination JSON file")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "config" / "scraper_config.yaml",
    )
    args = parser.parse_args(argv)
    user_agent = os.environ.get("SEC_USER_AGENT", "").strip()
    if not user_agent:
        parser.error("SEC_USER_AGENT must identify your organization and contact email")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_run(args.cik, args.output, user_agent, load_sec_config(args.config)))


if __name__ == "__main__":
    main()
