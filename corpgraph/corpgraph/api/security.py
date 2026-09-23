"""Authentication and Redis-backed request throttling for public API routes."""

from __future__ import annotations

from hmac import compare_digest
from typing import Protocol, cast

from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from corpgraph.api.cache import CacheError, CacheLayer


class RateLimitStore(Protocol):
    """Atomic counter operation required by the security middleware."""

    async def increment(self, key: str, window_seconds: int) -> int: ...


def _header(scope: Scope, name: bytes) -> str | None:
    headers = cast(list[tuple[bytes, bytes]], scope.get("headers", []))
    for key, value in headers:
        if key.lower() == name:
            return value.decode("latin-1")
    return None


def _credential(scope: Scope) -> str | None:
    api_key = _header(scope, b"x-api-key")
    if api_key:
        return api_key
    authorization = _header(scope, b"authorization")
    if authorization and authorization.casefold().startswith("bearer "):
        return authorization[7:].strip()
    return None


class ApiSecurityMiddleware:
    """Protect `/api/` routes with an optional key and a fixed-window limit."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        store: RateLimitStore,
        api_key: str | None,
        requests_per_minute: int,
    ) -> None:
        self._app = app
        self._store = store
        self._api_key = api_key
        self._requests_per_minute = requests_per_minute

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not str(scope.get("path", "")).startswith("/api/"):
            await self._app(scope, receive, send)
            return
        method = str(scope.get("method", "GET")).upper()
        if method == "OPTIONS":
            await self._app(scope, receive, send)
            return

        credential = _credential(scope)
        if self._api_key is not None and (
            credential is None or not compare_digest(credential, self._api_key)
        ):
            await JSONResponse(
                {"detail": "Invalid or missing API key"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )(scope, receive, send)
            return

        client = scope.get("client")
        client_host = client[0] if client else "unknown"
        identity = credential or str(client_host)
        key = CacheLayer.key("ratelimit", identity)
        try:
            count = await self._store.increment(key, 60)
        except CacheError:
            await JSONResponse(
                {"detail": "Rate limiter unavailable"}, status_code=503
            )(scope, receive, send)
            return
        remaining = max(self._requests_per_minute - count, 0)
        headers = {
            "X-RateLimit-Limit": str(self._requests_per_minute),
            "X-RateLimit-Remaining": str(remaining),
        }
        if count > self._requests_per_minute:
            headers["Retry-After"] = "60"
            await JSONResponse(
                {"detail": "Rate limit exceeded"}, status_code=429, headers=headers
            )(scope, receive, send)
            return

        async def send_with_limit_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                response_headers = MutableHeaders(scope=message)
                for name, value in headers.items():
                    response_headers.append(name, value)
            await send(message)

        await self._app(scope, receive, send_with_limit_headers)
