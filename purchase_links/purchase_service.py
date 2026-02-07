# Core purchase link service with caching and error handling
# Orchestrates multiple link generators and provides unified interface

import json
import time
import logging
from typing import Dict, List, Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

from .config import config, SUPPORTED_PLATFORMS, PlatformConfig
from .link_generators import get_all_generators, PurchaseLink

# Setup logging
logger = logging.getLogger(__name__)

class PurchaseLinkCache:
    """Simple in-memory cache for purchase links."""
    
    def __init__(self, ttl: int = 3600):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl
    
    def _get_cache_key(self, title: str, author: str = "", isbn: str = "") -> str:
        """Generate cache key from book identifiers."""
        return f"{title.lower().strip()}|{author.lower().strip()}|{isbn.strip()}"
    
    def get(self, title: str, author: str = "", isbn: str = "") -> Optional[Dict[str, Any]]:
        """Get cached purchase links."""
        key = self._get_cache_key(title, author, isbn)
        
        if key not in self.cache:
            return None
        
        cached_data = self.cache[key]
        
        # Check if cache is expired
        if time.time() - cached_data['timestamp'] > self.ttl:
            del self.cache[key]
            return None
        
        return cached_data['data']
    
    def set(self, title: str, author: str = "", isbn: str = "", data: Dict[str, Any] = None):
        """Cache purchase links."""
        key = self._get_cache_key(title, author, isbn)
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def clear(self):
        """Clear all cached data."""
        self.cache.clear()
    
    def size(self) -> int:
        """Get cache size."""
        return len(self.cache)

class PurchaseLinkService:
    """
    Production-grade service for generating book purchase links.
    Supports multiple platforms with caching, error handling, and concurrent processing.
    """
    
    def __init__(self):
        self.generators = get_all_generators()
        self.cache = PurchaseLinkCache(ttl=config.cache_ttl)
        self.logger = logging.getLogger(__name__)
        
        # Log available generators
        available_platforms = list(self.generators.keys())
        self.logger.info(f"Initialized with platforms: {available_platforms}")
    
    def get_purchase_links(
        self, 
        title: str, 
        author: str = "", 
        isbn: str = "",
        platforms: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Get purchase links for a book from multiple platforms.
        
        Args:
            title: Book title (required)
            author: Book author (optional)
            isbn: Book ISBN (optional, but recommended)
            platforms: List of platforms to check (default: all available)
            use_cache: Whether to use cached results (default: True)
            
        Returns:
            Dictionary with purchase links and metadata
        """
        if not title.strip():
            return {
                'success': False,
                'error': 'Book title is required',
                'links': {},
                'metadata': {}
            }
        
        # Check cache first
        if use_cache:
            cached_result = self.cache.get(title, author, isbn)
            if cached_result:
                self.logger.info(f"Using cached purchase links for: {title}")
                return cached_result
        
        # Determine which platforms to check
        if platforms is None:
            platforms = list(self.generators.keys())
        else:
            # Filter to only available platforms
            platforms = [p for p in platforms if p in self.generators]
        
        if not platforms:
            return {
                'success': False,
                'error': 'No valid platforms specified',
                'links': {},
                'metadata': {}
            }
        
        # Generate links concurrently
        links = self._generate_links_concurrent(title, author, isbn, platforms)
        
        # Prepare result
        result = {
            'success': True,
            'links': links,
            'metadata': {
                'title': title,
                'author': author,
                'isbn': isbn,
                'platforms_checked': platforms,
                'platforms_available': [p for p, data in links.items() if data.get('available', False)],
                'total_links': len([p for p, data in links.items() if data.get('available', False)]),
                'generated_at': time.time(),
                'cache_used': False
            }
        }
        
        # Cache the result
        if use_cache:
            self.cache.set(title, author, isbn, result)
        
        return result
    
    def _generate_links_concurrent(
        self, 
        title: str, 
        author: str, 
        isbn: str, 
        platforms: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """Generate links from multiple platforms concurrently."""
        links = {}
        
        # Use ThreadPoolExecutor for concurrent generation
        with ThreadPoolExecutor(max_workers=min(len(platforms), 4)) as executor:
            # Submit tasks
            future_to_platform = {
                executor.submit(self._generate_single_link, platform, title, author, isbn): platform
                for platform in platforms
            }
            
            # Collect results
            for future in as_completed(future_to_platform):
                platform = future_to_platform[future]
                try:
                    link_data = future.result(timeout=config.request_timeout)
                    links[platform] = link_data
                except Exception as e:
                    self.logger.error(f"Error generating {platform} link: {e}")
                    links[platform] = {
                        'available': False,
                        'error': str(e),
                        'platform_info': SUPPORTED_PLATFORMS.get(platform, {})
                    }
        
        return links
    
    def _generate_single_link(
        self, 
        platform: str, 
        title: str, 
        author: str, 
        isbn: str
    ) -> Dict[str, Any]:
        """Generate a single purchase link for a platform."""
        try:
            generator = self.generators.get(platform)
            if not generator:
                platform_info = SUPPORTED_PLATFORMS.get(platform, PlatformConfig(
                    name='Unknown', icon='', color='', priority=999, always_available=False
                ))
                return {
                    'available': False,
                    'error': f'Generator not available for platform: {platform}',
                    'platform_info': {
                        'name': platform_info.name,
                        'icon': platform_info.icon,
                        'color': platform_info.color,
                        'priority': platform_info.priority,
                        'always_available': platform_info.always_available
                    }
                }
            
            # Generate the link
            purchase_link = generator.generate_link(title, author, isbn)
            
            if not purchase_link:
                platform_info = SUPPORTED_PLATFORMS.get(platform, PlatformConfig(
                    name='Unknown', icon='', color='', priority=999, always_available=False
                ))
                return {
                    'available': False,
                    'error': 'No link generated',
                    'platform_info': {
                        'name': platform_info.name,
                        'icon': platform_info.icon,
                        'color': platform_info.color,
                        'priority': platform_info.priority,
                        'always_available': platform_info.always_available
                    }
                }
            
            # Convert to dictionary and add platform info
            link_data = asdict(purchase_link)
            platform_info = SUPPORTED_PLATFORMS.get(platform, PlatformConfig(
                name='Unknown', icon='', color='', priority=999, always_available=False
            ))
            link_data['platform_info'] = {
                'name': platform_info.name,
                'icon': platform_info.icon,
                'color': platform_info.color,
                'priority': platform_info.priority,
                'always_available': platform_info.always_available
            }
            
            return link_data
            
        except Exception as e:
            self.logger.error(f"Error in {platform} link generation: {e}")
            platform_info = SUPPORTED_PLATFORMS.get(platform, PlatformConfig(
                name='Unknown', icon='', color='', priority=999, always_available=False
            ))
            return {
                'available': False,
                'error': str(e),
                'platform_info': {
                    'name': platform_info.name,
                    'icon': platform_info.icon,
                    'color': platform_info.color,
                    'priority': platform_info.priority,
                    'always_available': platform_info.always_available
                }
            }
    
    def get_platform_status(self) -> Dict[str, Any]:
        """Get status of all supported platforms."""
        status = {
            'total_platforms': len(SUPPORTED_PLATFORMS),
            'available_platforms': len(self.generators),
            'platforms': {}
        }
        
        for platform_id, platform_info in SUPPORTED_PLATFORMS.items():
            generator_available = platform_id in self.generators
            
            status['platforms'][platform_id] = {
                'name': platform_info.name,
                'generator_available': generator_available,
                'always_available': platform_info.always_available,
                'priority': platform_info.priority,
                'icon': platform_info.icon,
                'color': platform_info.color
            }
        
        return status
    
    def clear_cache(self):
        """Clear the purchase links cache."""
        self.cache.clear()
        self.logger.info("Purchase links cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'size': self.cache.size(),
            'ttl': self.cache.ttl,
            'hit_rate': 'Not implemented'  # Could be added with counters
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on the service."""
        try:
            # Test with a known book
            test_result = self.get_purchase_links(
                title="The Great Gatsby",
                author="F. Scott Fitzgerald",
                platforms=['google_books'],  # Use most reliable platform
                use_cache=False
            )
            
            return {
                'status': 'healthy',
                'service': 'Purchase Links Service',
                'version': '1.0.0',
                'platforms_available': len(self.generators),
                'cache_size': self.cache.size(),
                'test_successful': test_result.get('success', False),
                'timestamp': time.time()
            }
            
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': time.time()
            }