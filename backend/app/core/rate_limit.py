"""Lightweight sliding-window rate limiter for public auth & analytics endpoints."""

from __future__ import annotations

import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter keyed by bucket and client IP."""

    def __init__(self, max_entries: int = 5000) -> None:
        self._max_entries = max_entries
        self._entries: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(
        self,
        bucket: str,
        key: str,
        *,
        max_requests: int,
        window_seconds: int,
    ) -> int | None:
        """Record a hit or return Retry-After seconds if the limit was exceeded."""
        now = time.monotonic()
        cutoff = now - window_seconds
        bucket_key = f"{bucket}:{key}"

        with self._lock:
            if len(self._entries) > self._max_entries:
                stale_keys = [
                    k
                    for k, timestamps in self._entries.items()
                    if not timestamps or timestamps[-1] <= cutoff
                ]
                for k in stale_keys:
                    self._entries.pop(k, None)
                if len(self._entries) > self._max_entries:
                    self._entries.clear()

            queue = self._entries[bucket_key]
            while queue and queue[0] <= cutoff:
                queue.popleft()

            if len(queue) >= max_requests:
                return max(1, math.ceil(queue[0] + window_seconds - now))

            queue.append(now)
            return None

    def reset(self) -> None:
        """Clear all recorded rate-limit windows (intended for test isolation)."""
        with self._lock:
            self._entries.clear()


rate_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP, honoring Cloudflare and reverse-proxy forwarding headers."""
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit(bucket: str, max_requests: int, window_seconds: int) -> Callable[[Request], None]:
    """Create a FastAPI dependency that enforces a sliding-window IP rate limit."""

    def _dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        client_ip = get_client_ip(request)
        retry_after = rate_limiter.check(
            bucket,
            client_ip,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Quá nhiều yêu cầu từ thiết bị của bạn. Vui lòng thử lại sau ít phút.",
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency
