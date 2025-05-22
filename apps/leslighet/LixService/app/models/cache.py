"""
Cache policy definitions for LixService.
"""
from enum import Enum

class CachePolicy(str, Enum):
    """Enum for different cache policies."""
    NONE = "none"          # Don't cache
    FIXED = "fixed"        # Fixed TTL
    ADAPTIVE = "adaptive"  # TTL based on content size/complexity
    LRU = "lru"            # Least recently used eviction