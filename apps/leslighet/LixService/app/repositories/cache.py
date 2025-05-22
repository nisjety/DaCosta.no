import json
from typing import Dict, Any, Optional
from redis import Redis
from app.domain.interfaces.repositories import CacheRepository
from app.config.settings import settings

class RedisCacheRepository(CacheRepository):
    """Redis cache implementation."""
    
    def __init__(self):
        self.redis = Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get value from Redis cache."""
        value = self.redis.get(key)
        return json.loads(value) if value else None
    
    async def set(self, key: str, value: Dict[str, Any], ttl: int = 3600) -> None:
        """Set value in Redis cache with TTL."""
        self.redis.setex(
            key,
            ttl,
            json.dumps(value)
        )
    
    async def delete(self, key: str) -> None:
        """Delete value from Redis cache."""
        self.redis.delete(key) 