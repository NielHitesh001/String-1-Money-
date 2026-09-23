from corpgraph.models import stable_id


def test_stable_id_is_case_and_whitespace_insensitive() -> None:
    assert stable_id("sec", " Tesla, Inc. ") == stable_id("sec", "tesla, inc.")


def test_stable_id_uses_namespace() -> None:
    assert stable_id("company", "123") != stable_id("person", "123")
