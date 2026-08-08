"""
Caching Service using Redis.
Caches responses to repeated queries.
"""

import hashlib
import json
from typing import Optional, Dict
from loguru import logger
from app.core.config import settings


class CacheService:
    """
    Simple query-response caching.
    TTL: 7 days by default.
    """

    def __init__(self, redis_url: str = None, enabled: bool = True):
        self.redis_url = redis_url or getattr(settings, "REDIS_URL", None)
        self.enabled = enabled and self.redis_url is not None
        self._redis = None
        self.ttl = 604800  # 7 days in seconds

        if self.enabled:
            try:
                import redis
                self._redis = redis.from_url(self.redis_url, decode_responses=True)
                # Test connection
                self._redis.ping()
                logger.info("✅ Redis cache initialized")
            except Exception as e:
                logger.warning(f"Redis initialization failed: {e} — caching disabled")
                self.enabled = False

    def _normalize_query(self, query: str) -> str:
        """Normalize query for caching."""
        normalized = query.lower().strip()
        # Remove extra spaces
        normalized = " ".join(normalized.split())
        return normalized

    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query hash."""
        normalized = self._normalize_query(query)
        query_hash = hashlib.md5(normalized.encode()).hexdigest()
        return f"query:{query_hash}"

    def get(self, query: str) -> Optional[Dict]:
        """
        Get cached response for query.
        Returns None if not cached.
        """
        if not self.enabled:
            return None

        try:
            cache_key = self._get_cache_key(query)
            cached = self._redis.get(cache_key)
            
            if cached:
                result = json.loads(cached)
                logger.debug(f"Cache HIT for: {query[:50]}...")
                self._record(hit=True)
                return result
            else:
                logger.debug(f"Cache MISS for: {query[:50]}...")
                self._record(hit=False)
                return None
        except Exception as e:
            logger.warning(f"Cache GET failed: {e}")
            return None

    def _record(self, hit: bool) -> None:
        """Increment persistent hit/miss counters in Redis (survives restarts)."""
        try:
            self._redis.incr("stats:cache_hits" if hit else "stats:cache_misses")
        except Exception as e:
            logger.warning(f"Cache stats increment failed: {e}")

    def get_stats(self) -> Dict:
        """Return cumulative cache hit/miss counts and hit rate."""
        if not self.enabled:
            return {"enabled": False, "hits": 0, "misses": 0, "total": 0, "hit_rate": 0.0}
        try:
            hits = int(self._redis.get("stats:cache_hits") or 0)
            misses = int(self._redis.get("stats:cache_misses") or 0)
            total = hits + misses
            return {
                "enabled": True,
                "hits": hits,
                "misses": misses,
                "total": total,
                "hit_rate": round(hits / total * 100, 1) if total else 0.0,
            }
        except Exception as e:
            logger.warning(f"Cache stats fetch failed: {e}")
            return {"enabled": True, "hits": 0, "misses": 0, "total": 0, "hit_rate": 0.0}

    def set(self, query: str, response: Dict) -> bool:
        """Store response in cache."""
        if not self.enabled:
            return False

        try:
            cache_key = self._get_cache_key(query)
            self._redis.setex(
                cache_key,
                self.ttl,
                json.dumps(response)
            )
            logger.debug(f"Cache SET for: {query[:50]}...")
            return True
        except Exception as e:
            logger.warning(f"Cache SET failed: {e}")
            return False

    def clear(self) -> bool:
        """Clear all cached queries."""
        if not self.enabled:
            return False

        try:
            # Delete all keys matching "query:*"
            for key in self._redis.scan_iter("query:*"):
                self._redis.delete(key)
            logger.info("Cache cleared")
            return True
        except Exception as e:
            logger.warning(f"Cache CLEAR failed: {e}")
            return False

    def health_check(self) -> bool:
        """Check if Redis is available."""
        if not self.enabled:
            return False
        try:
            self._redis.ping()
            return True
        except:
            return False


cache_service = CacheService()