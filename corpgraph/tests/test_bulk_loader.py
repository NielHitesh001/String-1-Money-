from datetime import date
from pathlib import Path

from corpgraph.graph_db.bulk_loader import load_document
from corpgraph.models import Company, ExtractionResult, Provenance


def test_load_document_validates_contract(tmp_path: Path) -> None:
    provenance = Provenance(
        source="sec_edgar",
        source_url="https://www.sec.gov/example",
        accession_number="0001-24-000001",
        filing_date=date(2024, 1, 1),
    )
    document = ExtractionResult(
        companies=[Company(entity_id="SEC_1", legal_name="Example Corp", provenance=provenance)],
        relationships=[],
    )
    path = tmp_path / "result.json"
    path.write_text(document.model_dump_json(), encoding="utf-8")
    assert load_document(path).companies[0].legal_name == "Example Corp"
