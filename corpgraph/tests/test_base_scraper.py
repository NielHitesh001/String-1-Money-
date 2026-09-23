import httpx
import pytest

from corpgraph.common.base_scraper import BaseScraper, ScraperError


@pytest.mark.asyncio
async def test_get_retries_transient_server_failure() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        status = 500 if attempts == 1 else 200
        return httpx.Response(status, json={"ok": True}, request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        async with BaseScraper(
            user_agent="CorpGraph test@example.com",
            requests_per_second=1_000_000,
            max_retries=1,
            backoff_seconds=0,
            client=client,
        ) as scraper:
            assert await scraper.get_json("https://example.test/data") == {"ok": True}
    assert attempts == 2


@pytest.mark.asyncio
async def test_get_does_not_retry_client_failure() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        scraper = BaseScraper(
            user_agent="CorpGraph test@example.com",
            requests_per_second=1_000_000,
            client=client,
        )
        with pytest.raises(ScraperError, match="Unable to fetch"):
            await scraper.get("https://example.test/missing")


@pytest.mark.asyncio
async def test_get_json_rejects_non_object_payload() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[1, 2], request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        scraper = BaseScraper(
            user_agent="CorpGraph test@example.com",
            requests_per_second=1_000_000,
            client=client,
        )
        with pytest.raises(ScraperError, match="Expected a JSON object"):
            await scraper.get_json("https://example.test/list")


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"user_agent": ""}, "User-Agent"),
        ({"user_agent": "test", "requests_per_second": 0}, "must be positive"),
    ],
)
def test_constructor_rejects_unsafe_configuration(kwargs: dict[str, object], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        BaseScraper(**kwargs)  # type: ignore[arg-type]
