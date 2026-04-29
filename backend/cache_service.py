"""
Caching service for BiblioDrift application.
Provides multi-layer caching for expensive AI operations and external API calls.
"""

import os
import json
import hashlib
import logging
from typing import Optional, Any, Dict, Callable
from functools import wraps
from datetime import datetime, timedelta

try:
    import redis
    from flask_caching import Cache
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


class CacheConfig:
    """Configuration for caching system."""
    
    # Cache TTL values (in seconds)
    MOOD_ANALYSIS_TTL = int(os.getenv('CACHE_MOOD_ANALYSIS_TTL', 86400))  # 24 hours
    BOOK_RECOMMENDATIONS_TTL = int(os.getenv('CACHE_RECOMMENDATIONS_TTL', 3600))  # 1 hour
    MOOD_TAGS_TTL = int(os.getenv('CACHE_MOOD_TAGS_TTL', 43200))  # 12 hours
    CHAT_RESPONSE_TTL = int(os.getenv('CACHE_CHAT_RESPONSE_TTL', 1800))  # 30 minutes
    GOODREADS_SCRAPING_TTL = int(os.getenv('CACHE_GOODREADS_TTL', 604800))  # 7 days
    
    # Cache configuration
    CACHE_TYPE = os.getenv('CACHE_TYPE', 'simple')  # 'redis', 'simple', or 'null'
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = int(os.getenv('CACHE_DEFAULT_TIMEOUT', 3600))
    
    # Cache key prefixes
    MOOD_ANALYSIS_PREFIX = "mood_analysis"
    RECOMMENDATIONS_PREFIX = "recommendations"
    MOOD_TAGS_PREFIX = "mood_tags"
    CHAT_RESPONSE_PREFIX = "chat_response"
    GOODREADS_PREFIX = "goodreads"


class CacheService:
    """Multi-layer caching service for expensive operations."""
    
    def __init__(self, app=None):
        self.cache = None
        self.redis_client = None
        self.is_initialized = False
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize caching with Flask app."""
        self.is_initialized = True
        try:
            # Configure Flask-Caching
            cache_config = {
                'CACHE_DEFAULT_TIMEOUT': CacheConfig.CACHE_DEFAULT_TIMEOUT
            }
            
            if CacheConfig.CACHE_TYPE == 'redis' and REDIS_AVAILABLE:
                cache_config.update({
                    'CACHE_TYPE': 'RedisCache',
                    'CACHE_REDIS_URL': CacheConfig.REDIS_URL
                })
                logger.info("Initializing Redis cache")
            elif CacheConfig.CACHE_TYPE == 'null':
                cache_config['CACHE_TYPE'] = 'NullCache'
                logger.info("Caching disabled (NullCache)")
            else:
                cache_config['CACHE_TYPE'] = 'SimpleCache'
                logger.info("Using simple in-memory cache")
            
            self.cache = Cache()
            self.cache.init_app(app, config=cache_config)
            
            # Initialize Redis client for advanced operations
            if CacheConfig.CACHE_TYPE == 'redis' and REDIS_AVAILABLE:
                try:
                    self.redis_client = redis.from_url(CacheConfig.REDIS_URL)
                    self.redis_client.ping()  # Test connection
                    logger.info("Redis client initialized successfully")
                except Exception as e:
                    logger.warning(f"Redis client initialization failed: {e}")
                    self.redis_client = None
            
        except Exception as e:
            logger.error(f"Cache initialization failed: {e}")
            # Fallback to no caching
            self.cache = None
    
    def _generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a consistent cache key from arguments."""
        # Create a string representation of all arguments
        key_data = {
            'args': args,
            'kwargs': sorted(kwargs.items()) if kwargs else {}
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        
        # Create hash for consistent key length
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        
        return f"{prefix}:{key_hash}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.cache:
            return None
        
        try:
            value = self.cache.get(key)
            if value is not None:
                self.cache_stats['hits'] += 1
                logger.debug(f"Cache hit for key: {key}")
            else:
                self.cache_stats['misses'] += 1
                logger.debug(f"Cache miss for key: {key}")
            return value
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> bool:
        """Set value in cache."""
        if not self.cache:
            return False
        
        try:
            self.cache.set(key, value, timeout=timeout)
            logger.debug(f"Cache set for key: {key}")
            return True
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if not self.cache:
            return False
        
        try:
            self.cache.delete(key)
            logger.debug(f"Cache delete for key: {key}")
            return True
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    def clear_prefix(self, prefix: str) -> int:
        """Clear all cache entries with given prefix."""
        if not self.redis_client:
            logger.warning("Prefix clearing requires Redis client")
            return 0
        
        try:
            pattern = f"{prefix}:*"
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"Cleared {deleted} cache entries with prefix: {prefix}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Error clearing cache prefix {prefix}: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = self.cache_stats.copy()
        
        # Calculate hit rate
        total_requests = stats['hits'] + stats['misses']
        stats['hit_rate'] = (stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        stats['total_requests'] = total_requests
        
        # Add cache info
        stats['cache_type'] = CacheConfig.CACHE_TYPE
        stats['redis_available'] = REDIS_AVAILABLE and self.redis_client is not None
        
        return stats


# Global cache service instance
cache_service = CacheService()


def cached_function(prefix: str, ttl: int = None):
    """Decorator to cache function results."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Guard against uninitialized cache:
            # issue: cache_service is a module-level singleton initialized before the Flask app is fully configured.
            # why?: Calling cache_service.init_app(app) on line 92 of app.py is correct, but if any decorated function
            # (e.g., via @cache_recommendations) is called before init_app, the cache will be in an unconfigured state
            # and may silently fail or use a null cache.
            if not cache_service.is_initialized:
                raise RuntimeError("cache_service.init_app() must be called before invoking any cached functions.")

            # Generate cache key
            cache_key = cache_service._generate_cache_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for function {func.__name__}")
                return cached_result
            
            # Execute function and cache result
            try:
                result = func(*args, **kwargs)
                if result is not None:  # Only cache non-None results
                    cache_service.set(cache_key, result, timeout=ttl)
                    logger.debug(f"Cached result for function {func.__name__}")
                return result
            except Exception as e:
                logger.error(f"Error in cached function {func.__name__}: {e}")
                raise
        
        return wrapper
    return decorator


def invalidate_cache(prefix: str):
    """Invalidate all cache entries with given prefix."""
    return cache_service.clear_prefix(prefix)


# Convenience decorators for specific use cases
def cache_mood_analysis(func):
    """Cache mood analysis results."""
    return cached_function(CacheConfig.MOOD_ANALYSIS_PREFIX, CacheConfig.MOOD_ANALYSIS_TTL)(func)


def cache_recommendations(func):
    """Cache book recommendations."""
    return cached_function(CacheConfig.RECOMMENDATIONS_PREFIX, CacheConfig.BOOK_RECOMMENDATIONS_TTL)(func)


def cache_mood_tags(func):
    """Cache mood tags."""
    return cached_function(CacheConfig.MOOD_TAGS_PREFIX, CacheConfig.MOOD_TAGS_TTL)(func)


def cache_chat_response(func):
    """Cache chat responses."""
    return cached_function(CacheConfig.CHAT_RESPONSE_PREFIX, CacheConfig.CHAT_RESPONSE_TTL)(func)


def cache_goodreads_data(func):
    """Cache GoodReads scraping results."""
    return cached_function(CacheConfig.GOODREADS_PREFIX, CacheConfig.GOODREADS_SCRAPING_TTL)(func)