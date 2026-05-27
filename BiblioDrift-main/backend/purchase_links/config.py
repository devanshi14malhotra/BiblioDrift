# Purchase Links Configuration
# Environment-based configuration for purchase link services with validation

import os
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum

class LogLevel(Enum):
    """Supported log levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class AmazonRegion(Enum):
    """Supported Amazon regions."""
    US = "US"
    UK = "UK"
    CA = "CA"
    DE = "DE"
    FR = "FR"
    IT = "IT"
    ES = "ES"
    JP = "JP"
    IN = "IN"

@dataclass(frozen=True)
class PlatformConfig:
    """Configuration for a specific platform."""
    name: str
    icon: str
    color: str
    priority: int
    always_available: bool
    region_specific: bool = False
    requires_affiliate: bool = False

@dataclass
class PurchaseLinksConfig:
    """
    Production-grade configuration for purchase links services.
    All settings are validated and have sensible defaults.
    """
    
    # Google Books API Configuration
    google_books_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv('GOOGLE_BOOKS_API_KEY')
    )
    google_books_base_url: str = field(
        default_factory=lambda: os.getenv('GOOGLE_BOOKS_BASE_URL', 'https://www.googleapis.com/books/v1')
    )
    
    # Amazon Configuration
    amazon_affiliate_tag: Optional[str] = field(
        default_factory=lambda: os.getenv('AMAZON_AFFILIATE_TAG')
    )
    amazon_access_key: Optional[str] = field(
        default_factory=lambda: os.getenv('AMAZON_ACCESS_KEY')
    )
    amazon_secret_key: Optional[str] = field(
        default_factory=lambda: os.getenv('AMAZON_SECRET_KEY')
    )
    amazon_region: AmazonRegion = field(
        default_factory=lambda: AmazonRegion(os.getenv('AMAZON_REGION', 'US'))
    )
    amazon_base_url: str = field(
        default_factory=lambda: os.getenv('AMAZON_BASE_URL', 'https://www.amazon.com')
    )
    
    # Flipkart Configuration (India-specific)
    flipkart_affiliate_id: Optional[str] = field(
        default_factory=lambda: os.getenv('FLIPKART_AFFILIATE_ID')
    )
    flipkart_affiliate_token: Optional[str] = field(
        default_factory=lambda: os.getenv('FLIPKART_AFFILIATE_TOKEN')
    )
    flipkart_base_url: str = field(
        default_factory=lambda: os.getenv('FLIPKART_BASE_URL', 'https://www.flipkart.com')
    )
    
    # Barnes & Noble Configuration
    barnes_noble_affiliate_id: Optional[str] = field(
        default_factory=lambda: os.getenv('BARNES_NOBLE_AFFILIATE_ID')
    )
    barnes_noble_base_url: str = field(
        default_factory=lambda: os.getenv('BARNES_NOBLE_BASE_URL', 'https://www.barnesandnoble.com')
    )
    
    # Performance Settings
    cache_ttl: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_CACHE_TTL', '3600'))
    )
    request_timeout: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_TIMEOUT', '10'))
    )
    max_retries: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_MAX_RETRIES', '3'))
    )
    retry_delay: float = field(
        default_factory=lambda: float(os.getenv('PURCHASE_LINKS_RETRY_DELAY', '1.0'))
    )
    
    # Rate Limiting
    rate_limit_requests: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_RATE_LIMIT', '100'))
    )
    rate_limit_window: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_RATE_WINDOW', '60'))
    )
    
    # Concurrency Settings
    max_concurrent_requests: int = field(
        default_factory=lambda: int(os.getenv('PURCHASE_LINKS_MAX_CONCURRENT', '4'))
    )
    
    # Logging Configuration
    log_level: LogLevel = field(
        default_factory=lambda: LogLevel(os.getenv('PURCHASE_LINKS_LOG_LEVEL', 'INFO'))
    )
    
    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        self._validate_configuration()
        self._setup_logging()
    
    def _validate_configuration(self) -> None:
        """Validate all configuration values."""
        logger = logging.getLogger(__name__)
        
        # Validate numeric ranges
        if not 1 <= self.cache_ttl <= 86400:  # 1 second to 24 hours
            raise ValueError(f"cache_ttl must be between 1 and 86400, got {self.cache_ttl}")
        
        if not 1 <= self.request_timeout <= 60:  # 1 to 60 seconds
            raise ValueError(f"request_timeout must be between 1 and 60, got {self.request_timeout}")
        
        if not 0 <= self.max_retries <= 10:
            raise ValueError(f"max_retries must be between 0 and 10, got {self.max_retries}")
        
        if not 0.1 <= self.retry_delay <= 10.0:
            raise ValueError(f"retry_delay must be between 0.1 and 10.0, got {self.retry_delay}")
        
        if not 1 <= self.max_concurrent_requests <= 20:
            raise ValueError(f"max_concurrent_requests must be between 1 and 20, got {self.max_concurrent_requests}")
        
        # Validate URLs
        required_urls = [
            ('google_books_base_url', self.google_books_base_url),
            ('amazon_base_url', self.amazon_base_url),
            ('flipkart_base_url', self.flipkart_base_url),
            ('barnes_noble_base_url', self.barnes_noble_base_url)
        ]
        
        for name, url in required_urls:
            if not url.startswith(('http://', 'https://')):
                raise ValueError(f"{name} must be a valid HTTP/HTTPS URL, got {url}")
        
        # Log configuration warnings
        if not self.google_books_api_key:
            logger.warning("Google Books API key not configured - functionality will be limited")
        
        if not self.amazon_affiliate_tag:
            logger.info("Amazon affiliate tag not configured - no affiliate revenue")
        
        if not self.flipkart_affiliate_id:
            logger.info("Flipkart affiliate ID not configured - no affiliate revenue")
    
    def _setup_logging(self) -> None:
        """Setup logging configuration."""
        logging.basicConfig(
            level=getattr(logging, self.log_level.value),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    def is_platform_configured(self, platform: str) -> bool:
        """Check if a platform is properly configured."""
        platform_checks = {
            'google_books': lambda: bool(self.google_books_api_key),
            'amazon': lambda: bool(self.amazon_affiliate_tag),
            'flipkart': lambda: bool(self.flipkart_affiliate_id),
            'barnes_noble': lambda: True  # No special config required
        }
        
        check_func = platform_checks.get(platform)
        return check_func() if check_func else False
    
    def get_platform_url(self, platform: str) -> Optional[str]:
        """Get base URL for a platform."""
        url_mapping = {
            'google_books': self.google_books_base_url,
            'amazon': self.amazon_base_url,
            'flipkart': self.flipkart_base_url,
            'barnes_noble': self.barnes_noble_base_url
        }
        return url_mapping.get(platform)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary (excluding sensitive data)."""
        return {
            'google_books_configured': bool(self.google_books_api_key),
            'amazon_configured': bool(self.amazon_affiliate_tag),
            'flipkart_configured': bool(self.flipkart_affiliate_id),
            'barnes_noble_configured': bool(self.barnes_noble_affiliate_id),
            'cache_ttl': self.cache_ttl,
            'request_timeout': self.request_timeout,
            'max_retries': self.max_retries,
            'max_concurrent_requests': self.max_concurrent_requests,
            'log_level': self.log_level.value
        }

# Platform configurations with proper typing
SUPPORTED_PLATFORMS: Dict[str, PlatformConfig] = {
    'google_books': PlatformConfig(
        name='Google Books',
        icon='fab fa-google',
        color='#4285f4',
        priority=1,
        always_available=True,
        region_specific=False,
        requires_affiliate=False
    ),
    'amazon': PlatformConfig(
        name='Amazon',
        icon='fab fa-amazon',
        color='#ff9900',
        priority=2,
        always_available=False,
        region_specific=True,
        requires_affiliate=True
    ),
    'flipkart': PlatformConfig(
        name='Flipkart',
        icon='fas fa-shopping-cart',
        color='#047bd6',
        priority=3,
        always_available=False,
        region_specific=True,
        requires_affiliate=True
    ),
    'barnes_noble': PlatformConfig(
        name='Barnes & Noble',
        icon='fas fa-book',
        color='#00a651',
        priority=4,
        always_available=False,
        region_specific=True,
        requires_affiliate=False
    )
}

# Search patterns with proper typing
SEARCH_PATTERNS: Dict[str, Dict[str, str]] = {
    'amazon': {
        'isbn_search': '/s?k={isbn}&i=stripbooks',
        'title_author_search': '/s?k={title}+{author}&i=stripbooks',
        'title_search': '/s?k={title}&i=stripbooks'
    },
    'flipkart': {
        'isbn_search': '/search?q={isbn}&otracker=search',
        'title_author_search': '/search?q={title}+{author}&otracker=search',
        'title_search': '/search?q={title}&otracker=search'
    },
    'barnes_noble': {
        'isbn_search': '/s/{isbn}',
        'title_author_search': '/s/{title}-{author}',
        'title_search': '/s/{title}'
    }
}

# Global configuration instance
try:
    config = PurchaseLinksConfig()
except (ValueError, TypeError) as e:
    # Log error and create minimal config for graceful degradation
    logging.getLogger(__name__).error(f"Configuration error: {e}")
    config = PurchaseLinksConfig(
        cache_ttl=3600,
        request_timeout=10,
        max_retries=3,
        retry_delay=1.0,
        max_concurrent_requests=4,
        log_level=LogLevel.INFO
    )