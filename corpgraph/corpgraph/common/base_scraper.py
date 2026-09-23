"""Async HTTP foundation with fair-access throttling and bounded retries."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Self

import httpx

logger = logging.getLogger(__name__)


class ScraperError(RuntimeError):
    """Raised when a source cannot be fetched after bounded retries."""


class BaseScraper:
    """Reusable async scraper transport with per-instance rate limiting."""

    def __init__(
        self,
        *,
        user_agent: str,
        requests_per_second: float = 5,
        timeout_seconds: float = 30,
        max_retries: int = 3,
        backoff_seconds: float = 1,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not user_agent.strip():
            raise ValueError("A source-compliant User-Agent is required")
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be positive")
        self._interval = 1 / requests_per_second
        self._max_retries = max_retries
        self._backoff_seconds = backoff_seconds
        self._last_request = 0.0
        self._lock = asyncio.Lock()
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            headers={"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"},
            timeout=timeout_seconds,
            follow_redirects=True,
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _throttle(self) -> None:
        async with self._lock:
            delay = self._interval - (time.monotonic() - self._last_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_request = time.monotonic()

    async def get(self, url: str) -> httpx.Response:
        """Fetch a URL, retrying transient network and server errors."""
        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            await self._throttle()
            try:
                response = await self._client.get(url)
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
                last_error = exc
                retryable = not isinstance(exc, httpx.HTTPStatusError) or (
                    exc.response.status_code == 429 or exc.response.status_code >= 500
                )
                if not retryable or attempt == self._max_retries:
                    break
                delay = self._backoff_seconds * (2**attempt)
                logger.warning(
                    "source_request_retry",
                    extra={"url": url, "attempt": attempt + 1, "delay_seconds": delay},
                )
                await asyncio.sleep(delay)
        raise ScraperError(f"Unable to fetch {url}") from last_error

    async def get_json(self, url: str) -> dict[str, Any]:
        """Fetch and validate a JSON object response."""
        payload = self._json_object((await self.get(url)).json(), url)
        return payload

    @staticmethod
    def _json_object(payload: Any, url: str) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ScraperError(f"Expected a JSON object from {url}")
        return payload
