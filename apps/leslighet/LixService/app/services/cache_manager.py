"""
Advanced cache management for LixService with adaptive TTL and intelligent eviction policies.
"""
import time
import hashlib
import json
from typing import Any, Dict, Optional, Union, Tuple

import redis
from redis.asyncio import Redis
from fastapi import Depends

from app.config import settings
from app.utils.logger import get_logger
from app.models.cache import CachePolicy

logger = get_logger(__name__)

# Initialize Redis connection pool
redis_pool = None

async def get_redis_connection() -> Redis:
    """Get an async Redis connection from the connection pool."""
    global redis_pool
    if redis_pool is None:
        redis_pool = redis.asyncio.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            max_connections=50  # Adjust based on expected load
        )
    return Redis(connection_pool=redis_pool)

def generate_cache_key(content: str, *args, **kwargs) -> str:
    """
    Generate a unique cache key based on content and optional parameters.
    
    Args:
        content: The main content to hash
        *args: Additional positional arguments to include in the key
        **kwargs: Additional keyword arguments to include in the key
    
    Returns:
        A unique hash string to use as a cache key
    """
    # Create a dictionary of all parameters
    key_parts = {
        'content_hash': hashlib.md5(content.encode('utf-8')).hexdigest(),
        'args': args,
        'kwargs': kwargs
    }
    
    # Convert to JSON and hash
    key_json = json.dumps(key_parts, sort_keys=True)
    return f"lix:cache:{hashlib.md5(key_json.encode('utf-8')).hexdigest()}"

def get_cache_ttl(text: str) -> int:
    """
    Calculate cache TTL based on text characteristics.
    Shorter texts get shorter TTL as they change more frequently.
    
    Args:
        text: The text to analyze
        
    Returns:
        TTL in seconds
    """
    base_ttl = 3600  # 1 hour base TTL
    
    # Adjust TTL based on text length
    text_length = len(text)
    if text_length < 100:
        return 60  # 1 minute for very short snippets
    elif text_length < 500:
        return 300  # 5 minutes for short texts
    elif text_length < 2000:
        return 1800  # 30 minutes for medium texts
    else:
        return base_ttl  # 1 hour for long texts

async def get_from_cache(key: str, redis_client: Redis = None) -> Optional[str]:
    """
    Get a value from cache with connection handling.
    
    Args:
        key: The cache key
        redis_client: Optional Redis client to use
        
    Returns:
        Cached value or None if not found
    """
    try:
        if redis_client is None:
            redis_client = await get_redis_connection()
        
        return await redis_client.get(key)
    except Exception as e:
        logger.warning(f"Cache read error: {str(e)}")
        return None

async def set_in_cache(key: str, value: str, ttl: int = 3600, redis_client: Redis = None) -> bool:
    """
    Set a value in cache with connection handling.
    
    Args:
        key: The cache key
        value: The value to cache
        ttl: Time to live in seconds
        redis_client: Optional Redis client to use
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if redis_client is None:
            redis_client = await get_redis_connection()
            
        return await redis_client.set(key, value, ex=ttl)
    except Exception as e:
        logger.warning(f"Cache write error: {str(e)}")
        return False

async def invalidate_cache(pattern: str = "lix:cache:*", redis_client: Redis = None) -> int:
    """
    Invalidate cache entries matching the pattern.
    
    Args:
        pattern: Pattern to match keys
        redis_client: Optional Redis client to use
        
    Returns:
        Number of keys removed
    """
    try:
        if redis_client is None:
            redis_client = await get_redis_connection()
            
        cursor = 0
        count = 0
        
        while True:
            cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
            if keys:
                count += await redis_client.delete(*keys)
            if cursor == 0:
                break
                
        return count
    except Exception as e:
        logger.warning(f"Cache invalidation error: {str(e)}")
        return 0

class CacheManager:
    """Advanced cache manager with intelligent caching strategies."""
    
    def __init__(self, namespace: str = "lix"):
        self.namespace = namespace
        self._cache_policy = CachePolicy.ADAPTIVE
        self._cache_stats = {
            "hits": 0,
            "misses": 0,
            "writes": 0,
            "errors": 0
        }
    
    async def get(self, key: str, redis_client: Redis = None) -> Tuple[Any, bool]:
        """
        Get a value from cache with hit/miss tracking.
        
        Args:
            key: Base key (will be prefixed with namespace)
            redis_client: Optional Redis client
            
        Returns:
            Tuple of (value, hit_status)
        """
        full_key = f"{self.namespace}:{key}"
        try:
            if redis_client is None:
                redis_client = await get_redis_connection()
                
            result = await redis_client.get(full_key)
            
            if result:
                self._cache_stats["hits"] += 1
                return json.loads(result), True
            else:
                self._cache_stats["misses"] += 1
                return None, False
                
        except Exception as e:
            self._cache_stats["errors"] += 1
            logger.warning(f"Cache get error: {str(e)}")
            return None, False
    
    async def set(self, key: str, value: Any, ttl: int = None, 
                  policy: CachePolicy = None, redis_client: Redis = None) -> bool:
        """
        Set a value in cache with smart TTL management.
        
        Args:
            key: Base key (will be prefixed with namespace)
            value: Value to cache (will be JSON serialized)
            ttl: Optional TTL override
            policy: Optional cache policy override
            redis_client: Optional Redis client
            
        Returns:
            True if successful
        """
        full_key = f"{self.namespace}:{key}"
        active_policy = policy or self._cache_policy
        
        try:
            if redis_client is None:
                redis_client = await get_redis_connection()
            
            # Apply caching policy
            if active_policy == CachePolicy.ADAPTIVE:
                # If no TTL specified, calculate based on value size
                if ttl is None:
                    value_size = len(json.dumps(value))
                    if value_size > 10000:  # Large value
                        ttl = 3600  # 1 hour
                    elif value_size > 1000:  # Medium value
                        ttl = 600  # 10 minutes
                    else:  # Small value
                        ttl = 300  # 5 minutes
            
            # Default TTL if still None
            if ttl is None:
                ttl = 3600  # 1 hour default
            
            # Store the value
            serialized = json.dumps(value)
            result = await redis_client.set(full_key, serialized, ex=ttl)
            
            if result:
                self._cache_stats["writes"] += 1
                return True
            return False
            
        except Exception as e:
            self._cache_stats["errors"] += 1
            logger.warning(f"Cache set error: {str(e)}")
            return False
    
    async def get_stats(self) -> Dict[str, int]:
        """Get cache statistics."""
        return self._cache_stats
    
    async def clear_namespace(self, redis_client: Redis = None) -> int:
        """Clear all cache entries in this namespace."""
        pattern = f"{self.namespace}:*"
        return await invalidate_cache(pattern, redis_client)