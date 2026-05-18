"""
Caching service for BiblioDrift application.
Provides multi-layer caching for expensive AI operations and external API calls.
Implements a robust prefixing and namespacing system to prevent key collisions.
"""

import os
import json
import hashlib
import logging
from typing import Optional, Any, Dict, Callable, List, Union
from functools import wraps
from datetime import datetime, timedelta
from enum import Enum

try:
    import redis
    from flask_caching import Cache
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


class CacheNamespace(Enum):
    """
    Standardized namespaces for cache keys to prevent collisions.
    Each major entity or feature in the application should have its own namespace.
    """
    USER = "user"
    BOOK = "book"
    MOOD_ANALYSIS = "mood_analysis"
    RECOMMENDATIONS = "recommendations"
    MOOD_TAGS = "mood_tags"
    CHAT_RESPONSE = "chat_response"
    GOODREADS = "goodreads"
    SYSTEM = "system"
    EXTERNAL_API = "external_api"
    PRICE_TRACKER = "price_tracker"


class CacheConfig:
    """
    Configuration for the BiblioDrift caching system.
    Centralizes all TTL values, prefixes, and connection settings.
    """
    
    # Global Application Prefix
    # This prevents collisions when multiple applications share the same Redis instance
    GLOBAL_PREFIX = os.getenv('CACHE_GLOBAL_PREFIX', 'bibliodrift')
    
    # Versioning for cache invalidation across deployments
    CACHE_VERSION = os.getenv('CACHE_VERSION', 'v1')
    
    # Cache TTL values (in seconds)
    TTL_SHORT = 300            # 5 minutes
    TTL_MEDIUM = 3600          # 1 hour
    TTL_LONG = 86400           # 24 hours
    TTL_EXTREME = 604800       # 7 days
    
    MOOD_ANALYSIS_TTL = int(os.getenv('CACHE_MOOD_ANALYSIS_TTL', 86400))
    BOOK_RECOMMENDATIONS_TTL = int(os.getenv('CACHE_RECOMMENDATIONS_TTL', 3600))
    MOOD_TAGS_TTL = int(os.getenv('CACHE_MOOD_TAGS_TTL', 43200))
    CHAT_RESPONSE_TTL = int(os.getenv('CACHE_CHAT_RESPONSE_TTL', 1800))
    GOODREADS_SCRAPING_TTL = int(os.getenv('CACHE_GOODREADS_TTL', 604800))
    
    # Cache configuration
    CACHE_TYPE = os.getenv('CACHE_TYPE', 'simple')  # 'redis', 'simple', or 'null'
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = int(os.getenv('CACHE_DEFAULT_TIMEOUT', 3600))
    
    # Redis Connection Timeouts
    REDIS_SOCKET_TIMEOUT = float(os.getenv('REDIS_SOCKET_TIMEOUT', 2.0))
    REDIS_CONNECT_TIMEOUT = float(os.getenv('REDIS_CONNECT_TIMEOUT', 2.0))


class CacheKey:
    """
    Structured cache key builder.
    Enforces the pattern: global_prefix:version:namespace:identifier:attribute:hash
    """
    
    def __init__(
        self, 
        namespace: Union[CacheNamespace, str], 
        identifier: Optional[Any] = None,
        attribute: Optional[str] = None
    ):
        self.namespace = namespace.value if isinstance(namespace, CacheNamespace) else namespace
        self.identifier = str(identifier) if identifier is not None else None
        self.attribute = attribute
    
    def build(self, *args, **kwargs) -> str:
        """
        Build the final cache key string.
        Includes a hash of additional arguments to ensure uniqueness for specific inputs.
        """
        components = [CacheConfig.GLOBAL_PREFIX, CacheConfig.CACHE_VERSION, self.namespace]
        
        if self.identifier:
            components.append(self.identifier)
        
        if self.attribute:
            components.append(self.attribute)
            
        # Add hash of arguments for uniqueness
        if args or kwargs:
            key_data = {
                'args': args,
                'kwargs': sorted(kwargs.items()) if kwargs else {}
            }
            key_string = json.dumps(key_data, sort_keys=True, default=str)
            key_hash = hashlib.md5(key_string.encode()).hexdigest()
            components.append(key_hash)
            
        return ":".join(components)


class CacheService:
    """
    Advanced Multi-layer Caching Service.
    
    This service manages interaction with both Flask-Caching (for standard web requests)
    and raw Redis (for advanced data structures and prefix clearing).
    
    It enforces a strict namespacing system to prevent key collisions between different
    subsystems of the application, such as user profiles vs book metadata.
    """
    
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
        """
        Initialize the caching system with a Flask application context.
        Configures either Redis, In-Memory (Simple), or Null caching based on environment.
        """
        if self.is_initialized:
            logger.warning("CacheService already initialized. Skipping.")
            return

        self.is_initialized = True
        try:
            # Configure Flask-Caching
            cache_config = {
                'CACHE_DEFAULT_TIMEOUT': CacheConfig.CACHE_DEFAULT_TIMEOUT
            }
            
            if CacheConfig.CACHE_TYPE == 'redis' and REDIS_AVAILABLE:
                cache_config.update({
                    'CACHE_TYPE': 'RedisCache',
                    'CACHE_REDIS_URL': CacheConfig.REDIS_URL,
                    'CACHE_OPTIONS': {
                        'socket_timeout': CacheConfig.REDIS_SOCKET_TIMEOUT,
                        'socket_connect_timeout': CacheConfig.REDIS_CONNECT_TIMEOUT
                    }
                })
                logger.info(f"Initializing Redis cache at {CacheConfig.REDIS_URL}")
            elif CacheConfig.CACHE_TYPE == 'null':
                cache_config['CACHE_TYPE'] = 'NullCache'
                logger.info("Caching explicitly disabled (NullCache)")
            else:
                cache_config['CACHE_TYPE'] = 'SimpleCache'
                logger.info("Using simple in-memory cache (not recommended for production)")
            
            self.cache = Cache()
            self.cache.init_app(app, config=cache_config)
            
            # Initialize direct Redis client for advanced operations (e.g. prefix clearing)
            if CacheConfig.CACHE_TYPE == 'redis' and REDIS_AVAILABLE:
                try:
                    self.redis_client = redis.from_url(
                        CacheConfig.REDIS_URL,
                        socket_timeout=CacheConfig.REDIS_SOCKET_TIMEOUT,
                        socket_connect_timeout=CacheConfig.REDIS_CONNECT_TIMEOUT
                    )
                    self.redis_client.ping()  # Verify connection with a ping
                    logger.info("Direct Redis client connection verified")
                except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
                    logger.error(f"Redis connection failed: {e}. Falling back to standard cache operations.")
                    self.redis_client = None
            
        except Exception as e:
            logger.critical(f"FATAL: Cache initialization failed: {e}")
            self.cache = None
    
    def _get_key_string(
        self, 
        namespace: Union[CacheNamespace, str], 
        identifier: Optional[Any] = None,
        attribute: Optional[str] = None,
        *args, 
        **kwargs
    ) -> str:
        """Helper to build key strings consistently."""
        builder = CacheKey(namespace, identifier, attribute)
        return builder.build(*args, **kwargs)

    def get(self, key: str) -> Optional[Any]:
        """
        Retrieve a value from the cache.
        Includes error handling for Redis timeouts and connection issues.
        """
        if not self.cache:
            return None
        
        try:
            value = self.cache.get(key)
            if value is not None:
                self.cache_stats['hits'] += 1
                logger.debug(f"Cache HIT for: {key}")
            else:
                self.cache_stats['misses'] += 1
                logger.debug(f"Cache MISS for: {key}")
            return value
        except (redis.exceptions.TimeoutError, redis.exceptions.ConnectionError) as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Redis error during GET '{key}': {e}")
            return None
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Unexpected cache error during GET '{key}': {e}")
            return None
    
    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> bool:
        """
        Store a value in the cache with an optional TTL.
        """
        if not self.cache:
            return False
        
        try:
            self.cache.set(key, value, timeout=timeout)
            logger.debug(f"Cache SET for: {key} (TTL: {timeout})")
            return True
        except (redis.exceptions.TimeoutError, redis.exceptions.ConnectionError) as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Redis error during SET '{key}': {e}")
            return False
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Unexpected cache error during SET '{key}': {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Remove a specific key from the cache.
        """
        if not self.cache:
            return False
        
        try:
            self.cache.delete(key)
            logger.debug(f"Cache DELETE for: {key}")
            return True
        except Exception as e:
            self.cache_stats['errors'] += 1
            logger.error(f"Cache error during DELETE '{key}': {e}")
            return False
    
    def clear_namespace(self, namespace: Union[CacheNamespace, str], identifier: Optional[Any] = None) -> int:
        """
        Clear all cache entries within a specific namespace or for a specific entity.
        Requires Redis for pattern-based deletion.
        """
        if not self.redis_client:
            logger.warning("Namespaced clearing requires an active Redis connection.")
            return 0
        
        try:
            ns_val = namespace.value if isinstance(namespace, CacheNamespace) else namespace
            if identifier:
                pattern = f"{CacheConfig.GLOBAL_PREFIX}:{CacheConfig.CACHE_VERSION}:{ns_val}:{identifier}:*"
            else:
                pattern = f"{CacheConfig.GLOBAL_PREFIX}:{CacheConfig.CACHE_VERSION}:{ns_val}:*"
                
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"Cleared {deleted_count} keys from namespace '{ns_val}' pattern '{pattern}'")
                return deleted_count
            return 0
        except Exception as e:
            logger.error(f"Error clearing namespace '{namespace}': {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Return performance metrics for the caching system.
        Useful for health checks and monitoring.
        """
        stats = self.cache_stats.copy()
        total = stats['hits'] + stats['misses']
        stats['hit_rate_pct'] = (stats['hits'] / total * 100) if total > 0 else 0
        stats['total_operations'] = total
        stats['cache_type'] = CacheConfig.CACHE_TYPE
        stats['redis_active'] = self.redis_client is not None
        stats['config'] = {
            'global_prefix': CacheConfig.GLOBAL_PREFIX,
            'version': CacheConfig.CACHE_VERSION
        }
        return stats


# Singleton instance for application-wide use
cache_service = CacheService()


def cached_result(
    namespace: Union[CacheNamespace, str], 
    identifier_arg: Optional[str] = None,
    attribute: Optional[str] = None,
    ttl: Optional[int] = None
):
    """
    Universal decorator for caching function results with namespacing.
    
    Example Usage:
    @cached_result(CacheNamespace.USER, identifier_arg='user_id', attribute='profile')
    def get_user_profile(user_id):
        ...
    
    Args:
        namespace: The logical group for the cache key (e.g. USER, BOOK)
        identifier_arg: Name of the function argument to use as the entity ID in the key
        attribute: Optional static string for the attribute being cached
        ttl: Time-to-live in seconds
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not cache_service.is_initialized:
                # If cache is not initialized, we still want the function to work, 
                # but we warn the developer because it indicates a configuration error.
                logger.warning(f"CacheService used before initialization in {func.__name__}")
                return func(*args, **kwargs)

            # Resolve identifier from arguments if specified
            identifier = None
            if identifier_arg:
                # Try to find the identifier in kwargs first, then args
                if identifier_arg in kwargs:
                    identifier = kwargs[identifier_arg]
                else:
                    # Logic to find the argument index in the original function signature
                    import inspect
                    sig = inspect.signature(func)
                    if identifier_arg in sig.parameters:
                        param_idx = list(sig.parameters.keys()).index(identifier_arg)
                        if param_idx < len(args):
                            identifier = args[param_idx]

            # Generate structured cache key
            cache_key = cache_service._get_key_string(
                namespace, identifier, attribute, *args, **kwargs
            )
            
            # Check cache
            cached_data = cache_service.get(cache_key)
            if cached_data is not None:
                return cached_data
            
            # Execute and store
            try:
                result = func(*args, **kwargs)
                if result is not None:
                    cache_service.set(cache_key, result, timeout=ttl)
                return result
            except Exception as e:
                logger.error(f"Error in {func.__name__} (cached): {e}")
                raise
        
        return wrapper
    return decorator


# Convenience decorators for backward compatibility and specific features
# These use the new namespacing system under the hood.

def cache_mood_analysis(func):
    """Cache mood analysis results for books."""
    return cached_result(
        CacheNamespace.MOOD_ANALYSIS, 
        ttl=CacheConfig.MOOD_ANALYSIS_TTL
    )(func)


def cache_recommendations(func):
    """Cache AI-driven book recommendations."""
    return cached_result(
        CacheNamespace.RECOMMENDATIONS, 
        ttl=CacheConfig.BOOK_RECOMMENDATIONS_TTL
    )(func)


def cache_mood_tags(func):
    """Cache mood tags generated for titles."""
    return cached_result(
        CacheNamespace.MOOD_TAGS, 
        ttl=CacheConfig.MOOD_TAGS_TTL
    )(func)


def cache_chat_response(func):
    """Cache generated chat responses."""
    return cached_result(
        CacheNamespace.CHAT_RESPONSE, 
        ttl=CacheConfig.CHAT_RESPONSE_TTL
    )(func)


def cache_goodreads_data(func):
    """Cache scraped GoodReads data."""
    return cached_result(
        CacheNamespace.GOODREADS, 
        ttl=CacheConfig.GOODREADS_SCRAPING_TTL
    )(func)


def invalidate_namespace(namespace: Union[CacheNamespace, str], identifier: Optional[Any] = None):
    """
    Public API to invalidate a whole namespace or specific entity.
    """
    return cache_service.clear_namespace(namespace, identifier)