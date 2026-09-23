from datetime import date
from pathlib import Path

import httpx
import pytest

from corpgraph.common.base_scraper import ScraperError
from corpgraph.scrapers.sec_edgar import (
    SecEdgarScraper,
    find_exhibit_21,
    latest_10k,
    load_sec_config,
    normalize_cik,
    parse_subsidiaries,
)


def test_normalize_cik() -> None:
    assert normalize_cik("1318605") == "0001318605"
    assert normalize_cik("0001318605") == "0001318605"


def test_load_sec_config(tmp_path: Path) -> None:
    path = tmp_path / "scrapers.yaml"
    path.write_text(
        """
sec_edgar:
  submissions_url: https://data.test/CIK{cik}.json
  archives_base_url: https://archives.test
  requests_per_second: 4
  timeout_seconds: 20
  max_retries: 2
  backoff_seconds: 0.5
""",
        encoding="utf-8",
    )
    settings = load_sec_config(path)
    assert settings["requests_per_second"] == 4.0
    assert settings["max_retries"] == 2


def test_load_sec_config_requires_named_section(tmp_path: Path) -> None:
    path = tmp_path / "scrapers.yaml"
    path.write_text("other: {}", encoding="utf-8")
    with pytest.raises(ValueError, match="sec_edgar"):
        load_sec_config(path)


@pytest.mark.parametrize("value", ["ABC", "12345678901", "12-34"])
def test_normalize_cik_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError):
        normalize_cik(value)


def test_latest_10k_ignores_amendments_and_other_forms() -> None:
    filing = latest_10k(
        {
            "filings": {
                "recent": {
                    "form": ["10-K/A", "8-K", "10-K"],
                    "accessionNumber": ["a", "b", "0001-24-000003"],
                    "primaryDocument": ["a.htm", "b.htm", "annual.htm"],
                    "filingDate": ["2025-02-01", "2025-01-01", "2024-12-31"],
                }
            }
        }
    )
    assert filing.accession_number == "0001-24-000003"
    assert filing.filing_date == date(2024, 12, 31)


def test_latest_10k_reports_missing_filing() -> None:
    with pytest.raises(ScraperError, match="No recent 10-K"):
        latest_10k({"filings": {"recent": {"form": ["8-K"]}}})


def test_latest_10k_reports_malformed_filing() -> None:
    with pytest.raises(ScraperError, match="Malformed SEC"):
        latest_10k({"filings": {"recent": {"form": ["10-K"]}}})


def test_find_exhibit_21() -> None:
    html = """
    <table class="tableFile">
      <tr><td>2</td><td><a href="subsidiaries.htm">Exhibit 21</a></td>
          <td>Subsidiaries</td><td>EX-21.1</td><td>123</td></tr>
    </table>
    """
    assert find_exhibit_21(html, "https://www.sec.gov/example/index.html") == (
        "https://www.sec.gov/example/subsidiaries.htm"
    )


def test_find_exhibit_21_reports_missing_document() -> None:
    with pytest.raises(ScraperError, match="does not list"):
        find_exhibit_21("<html></html>", "https://www.sec.gov/example/index.html")


def test_parse_subsidiaries_deduplicates_and_excludes_header() -> None:
    html = Path("tests/fixtures/exhibit_21.html").read_text(encoding="utf-8")
    subsidiaries = parse_subsidiaries(html)
    assert [(item.legal_name, item.jurisdiction) for item in subsidiaries] == [
        ("Alpha Holdings, Inc", "Delaware"),
        ("Beta GmbH", "Germany"),
    ]


def test_parse_subsidiaries_supports_plain_text_fallback() -> None:
    subsidiaries = parse_subsidiaries(
        "<html><body>Gamma Limited  United Kingdom<br>Delta Corp  Unknown Place</body></html>"
    )
    assert [(item.legal_name, item.jurisdiction) for item in subsidiaries] == [
        ("Gamma Limited", "United Kingdom"),
        ("Delta Corp", None),
    ]


@pytest.mark.asyncio
async def test_scrape_builds_graph_ready_result() -> None:
    submissions = {
        "name": "Example Parent, Inc.",
        "filings": {
            "recent": {
                "form": ["10-K"],
                "accessionNumber": ["0001234567-25-000001"],
                "primaryDocument": ["annual.htm"],
                "filingDate": ["2025-02-01"],
            }
        },
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.sec.gov":
            return httpx.Response(200, json=submissions, request=request)
        if request.url.path.endswith("-index.html"):
            html = """
            <table class="tableFile"><tr><td>1</td>
            <td><a href="ex21.htm">Subsidiaries</a></td><td>List</td><td>EX-21.1</td></tr></table>
            """
            return httpx.Response(200, text=html, request=request)
        if request.url.path.endswith("ex21.htm"):
            return httpx.Response(
                200,
                text="<table><tr><td>Example Child LLC</td><td>Delaware</td></tr></table>",
                request=request,
            )
        return httpx.Response(404, request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        scraper = SecEdgarScraper(
            user_agent="CorpGraph test@example.com",
            requests_per_second=1_000_000,
            client=client,
        )
        result = await scraper.scrape("1234567")

    assert [company.legal_name for company in result.companies] == [
        "Example Parent, Inc.",
        "Example Child LLC",
    ]
    assert result.relationships[0].from_entity_id == result.companies[0].entity_id
    assert result.relationships[0].to_entity_id == result.companies[1].entity_id
    assert result.metadata["subsidiary_count"] == 1
