import json

from neo4j.time import Date, DateTime, Duration, Time

from corpgraph.api.models import RelationshipResponse


def test_nested_neo4j_properties_survive_cache_round_trip() -> None:
    values = [
        Date(2026, 1, 1),
        DateTime(2026, 1, 1, nanosecond=123456789),
        Time(12, 30, 0),
        Duration(months=2, days=3),
    ]
    record = RelationshipResponse(
        type="HAS_SUBSIDIARY",
        properties={"nested": {"dates": tuple(values)}, "confidence": 1, "unknown": None},
    )
    encoded = record.model_dump_json()
    assert json.loads(encoded)["properties"]["nested"]["dates"] == [
        value.iso_format() for value in values
    ]
    assert RelationshipResponse.model_validate_json(encoded) == record
