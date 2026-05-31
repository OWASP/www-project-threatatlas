"""Rate-limiter singleton shared across the application.

Uses Redis storage when available (same Redis instance as the rest of the app).
Falls back to in-memory storage if Redis is unreachable so the app still starts
in minimal / dev environments that skip Redis.
"""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

logger = logging.getLogger(__name__)


def _build_limiter() -> Limiter:
    try:
        lim = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)
        logger.info("Rate limiter: using Redis storage (%s)", settings.redis_url)
        return lim
    except Exception as exc:
        logger.warning("Rate limiter: Redis unavailable (%s) — falling back to memory storage", exc)
        return Limiter(key_func=get_remote_address, storage_uri="memory://")


limiter = _build_limiter()
