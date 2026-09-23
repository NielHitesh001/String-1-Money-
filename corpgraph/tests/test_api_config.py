import pytest

from corpgraph.api.config import ApiSettings


def test_settings_defaults() -> None:
    settings = ApiSettings.from_env({})
    assert settings.neo4j_uri == "bolt://localhost:7687"
    assert settings.neo4j_password == "corpgraph-local"
    assert settings.query_timeout_ms == 30_000
    assert settings.rate_limit_per_minute == 120
    assert settings.api_key is None


def test_settings_from_environment() -> None:
    settings = ApiSettings.from_env(
        {
            "NEO4J_URI": "bolt://graph:7687",
            "NEO4J_USER": "reader",
            "NEO4J_PASSWORD": "secret",
            "NEO4J_DATABASE": "corpgraph",
            "CORPGRAPH_QUERY_TIMEOUT_MS": "1500",
            "CORPGRAPH_ENV": "test",
            "CORPGRAPH_API_KEY": "test-key",
            "CORPGRAPH_RATE_LIMIT_PER_MINUTE": "75",
            "CORPGRAPH_CORS_ORIGINS": "https://app.example, https://admin.example",
        }
    )
    assert settings == ApiSettings(
        neo4j_uri="bolt://graph:7687",
        neo4j_user="reader",
        neo4j_password="secret",
        neo4j_database="corpgraph",
        query_timeout_ms=1500,
        environment="test",
        api_key="test-key",
        rate_limit_per_minute=75,
        cors_origins=("https://app.example", "https://admin.example"),
    )


@pytest.mark.parametrize("timeout", ["0", "30001"])
def test_settings_reject_invalid_timeout(timeout: str) -> None:
    with pytest.raises(ValueError, match="CORPGRAPH_QUERY_TIMEOUT_MS"):
        ApiSettings.from_env({"CORPGRAPH_QUERY_TIMEOUT_MS": timeout})


@pytest.mark.parametrize(
    ("environment", "error"),
    [
        ({"CORPGRAPH_ENV": "staging"}, "CORPGRAPH_ENV"),
        ({"CORPGRAPH_ENV": "production"}, "CORPGRAPH_API_KEY"),
        ({"CORPGRAPH_RATE_LIMIT_PER_MINUTE": "0"}, "RATE_LIMIT"),
        ({"CORPGRAPH_RATE_LIMIT_PER_MINUTE": "10001"}, "RATE_LIMIT"),
        ({"CORPGRAPH_CORS_ORIGINS": "*"}, "CORS_ORIGINS"),
    ],
)
def test_settings_reject_unsafe_security_values(
    environment: dict[str, str], error: str
) -> None:
    with pytest.raises(ValueError, match=error):
        ApiSettings.from_env(environment)
