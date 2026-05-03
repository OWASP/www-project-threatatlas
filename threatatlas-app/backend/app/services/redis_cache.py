"""
Optional Redis cache. Falls back silently on any error or missing config.
Usage:
    from app.services.redis_cache import cache
    val = await cache.get("key")
    await cache.set("key", "value", ttl=300)
    await cache.delete("key")
"""
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_client = None


async def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import redis.asyncio as aioredis
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _client.ping()
        logger.info("Redis connected at %s", settings.redis_url)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — caching disabled", exc)
        _client = None
    return _client


class _RedisCache:
    async def get(self, key: str) -> Any | None:
        try:
            client = await _get_client()
            if client is None:
                return None
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        try:
            client = await _get_client()
            if client is None:
                return False
            await client.setex(key, ttl, json.dumps(value))
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        try:
            client = await _get_client()
            if client is None:
                return False
            await client.delete(key)
            return True
        except Exception:
            return False


cache = _RedisCache()
