# Platform-specific link generators for book purchases
# Production-grade generators with comprehensive error handling and validation

import os
import logging
import requests
import urllib.parse
import time
from abc import ABC, abstractmethod
from typing import Dict, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import re

from .config import config, SEARCH_PATTERNS, PlatformConfig

# Setup logging
logger = logging.getLogger(__name__)

class SearchType(Enum):
    """Types of book searches supported."""
    ISBN = "isbn"
    TITLE_AUTHOR = "title_author"
    TITLE_ONLY = "title"

class LinkStatus(Enum):
    """Status of generated links."""
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    ERROR = "error"
    TIMEOUT = "timeout"

@dataclass(frozen=True)
class PurchaseLink:
    """
    Immutable data class representing a purchase link with comprehensive metadata.
    
    Attributes:
        url: The purchase URL
        platform: Platform identifier
        price: Price as string (e.g., "19.99")
        currency: ISO currency code (e.g., "USD")
        available: Whether the link is available
        is_ebook: Whether this is an ebook link
        is_affiliate: Whether this is an affiliate link
        status: Link generation status
        search_type: Type of search used
        metadata: Additional platform-specific data
        generated_at: Timestamp when link was generated
        expires_at: When this link data expires
    """
    url: str
    platform: str
    price: Optional[str] = None
    currency: Optional[str] = None
    available: bool = True
    is_ebook: bool = False
    is_affiliate: bool = False
    status: LinkStatus = LinkStatus.AVAILABLE
    search_type: SearchType = SearchType.TITLE_ONLY
    metadata: Dict[str, Any] = field(default_factory=dict)
    generated_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None
    
    def __post_init__(self) -> None:
        """Validate the purchase link after creation."""
        if not self.url:
            raise ValueError("Purchase link URL cannot be empty")
        
        if not self.platform:
            raise ValueError("Platform identifier cannot be empty")
        
        # Validate URL format
        if not self._is_valid_url(self.url):
            raise ValueError(f"Invalid URL format: {self.url}")
        
        # Set expiration if not provided
        if self.expires_at is None:
            object.__setattr__(self, 'expires_at', self.generated_at + config.cache_ttl)
    
    def _is_valid_url(self, url: str) -> bool:
        """Validate URL format."""
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        return bool(url_pattern.match(url))
    
    def is_expired(self) -> bool:
        """Check if this link data has expired."""
        return self.expires_at is not None and time.time() > self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'url': self.url,
            'platform': self.platform,
            'price': self.price,
            'currency': self.currency,
            'available': self.available,
            'is_ebook': self.is_ebook,
            'is_affiliate': self.is_affiliate,
            'status': self.status.value,
            'search_type': self.search_type.value,
            'metadata': self.metadata,
            'generated_at': self.generated_at,
            'expires_at': self.expires_at
        }

class BaseLinkGenerator(ABC):
    """
    Abstract base class for all link generators.
    Provides common functionality and enforces interface contract.
    """
    
    def __init__(self, platform_name: str, platform_config: PlatformConfig):
        if not platform_name:
            raise ValueError("Platform name cannot be empty")
        
        self.platform_name = platform_name
        self.platform_config = platform_config
        self.logger = logging.getLogger(f"{__name__}.{platform_name}")
        self._request_count = 0
        self._last_request_time = 0.0
    
    @abstractmethod
    def generate_link(self, title: str, author: str = "", isbn: str = "") -> Optional[PurchaseLink]:
        """
        Generate a purchase link for the given book.
        
        Args:
            title: Book title (required)
            author: Book author (optional)
            isbn: Book ISBN (optional but preferred)
            
        Returns:
            PurchaseLink object or None if generation failed
            
        Raises:
            ValueError: If required parameters are invalid
            requests.RequestException: If network request fails
        """
        pass
    
    def _validate_inputs(self, title: str, author: str = "", isbn: str = "") -> None:
        """Validate input parameters."""
        if not title or not title.strip():
            raise ValueError("Book title cannot be empty")
        
        if isbn and not self._is_valid_isbn(isbn):
            self.logger.warning(f"Invalid ISBN format: {isbn}")
    
    def _is_valid_isbn(self, isbn: str) -> bool:
        """Validate ISBN format (ISBN-10 or ISBN-13)."""
        # Remove hyphens and spaces
        clean_isbn = re.sub(r'[-\s]', '', isbn)
        
        # Check ISBN-10 or ISBN-13 format
        isbn_pattern = re.compile(r'^(?:97[89])?\d{9}[\dX]$', re.IGNORECASE)
        return bool(isbn_pattern.match(clean_isbn))
    
    def _clean_search_term(self, term: str) -> str:
        """Clean and encode search terms for URLs."""
        if not term:
            return ""
        
        # Remove special characters that might break URLs
        cleaned = re.sub(r'[^\w\s-]', '', term.strip())
        # Encode for URL
        return urllib.parse.quote_plus(cleaned)
    
    def _rate_limit_check(self) -> None:
        """Implement basic rate limiting."""
        current_time = time.time()
        
        # Reset counter if window has passed
        if current_time - self._last_request_time > config.rate_limit_window:
            self._request_count = 0
            self._last_request_time = current_time
        
        # Check rate limit
        if self._request_count >= config.rate_limit_requests:
            sleep_time = config.rate_limit_window - (current_time - self._last_request_time)
            if sleep_time > 0:
                self.logger.info(f"Rate limit reached, sleeping for {sleep_time:.2f} seconds")
                time.sleep(sleep_time)
                self._request_count = 0
                self._last_request_time = time.time()
        
        self._request_count += 1
    
    def _make_request(self, url: str, params: Optional[Dict[str, str]] = None) -> requests.Response:
        """Make HTTP request with proper error handling and retries."""
        self._rate_limit_check()
        
        headers = {
            'User-Agent': 'BiblioDrift/1.0 (Book Purchase Link Service)',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }
        
        for attempt in range(config.max_retries + 1):
            try:
                response = requests.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=config.request_timeout,
                    allow_redirects=True
                )
                response.raise_for_status()
                return response
                
            except requests.exceptions.Timeout:
                self.logger.warning(f"Request timeout for {url} (attempt {attempt + 1})")
                if attempt == config.max_retries:
                    raise
                    
            except requests.exceptions.RequestException as e:
                self.logger.error(f"Request failed for {url}: {e} (attempt {attempt + 1})")
                if attempt == config.max_retries:
                    raise
                    
            # Exponential backoff
            if attempt < config.max_retries:
                sleep_time = config.retry_delay * (2 ** attempt)
                time.sleep(sleep_time)
        
        raise requests.RequestException(f"Failed to make request after {config.max_retries + 1} attempts")

class GoogleBooksLinkGenerator(BaseLinkGenerator):
    """
    Production-grade Google Books API link generator.
    Handles API authentication, rate limiting, and comprehensive error handling.
    """
    
    def __init__(self):
        from .config import SUPPORTED_PLATFORMS
        super().__init__("google_books", SUPPORTED_PLATFORMS['google_books'])
        self.api_key = config.google_books_api_key
        self.base_url = config.google_books_base_url
        
        if not self.api_key:
            self.logger.warning("Google Books API key not configured - requests may be rate limited")
    
    def generate_link(self, title: str, author: str = "", isbn: str = "") -> Optional[PurchaseLink]:
        """Generate Google Books purchase link with comprehensive error handling."""
        try:
            self._validate_inputs(title, author, isbn)
            
            # Build search query with priority: ISBN > Title+Author > Title
            search_type, query = self._build_search_query(title, author, isbn)
            
            # Make API request
            response = self._query_google_books_api(query)
            
            if not response or not response.get('items'):
                self.logger.info(f"No Google Books results for: {title}")
                return self._create_unavailable_link(search_type, "No results found")
            
            # Process the best match
            book_data = response['items'][0]
            return self._process_book_data(book_data, search_type)
            
        except ValueError as e:
            self.logger.error(f"Validation error: {e}")
            return None
            
        except requests.RequestException as e:
            self.logger.error(f"Google Books API error: {e}")
            return self._create_error_link(SearchType.TITLE_ONLY, str(e))
            
        except Exception as e:
            self.logger.error(f"Unexpected error in Google Books generator: {e}")
            return self._create_error_link(SearchType.TITLE_ONLY, str(e))
    
    def _build_search_query(self, title: str, author: str, isbn: str) -> tuple[SearchType, str]:
        """Build optimized search query for Google Books API."""
        if isbn and self._is_valid_isbn(isbn):
            return SearchType.ISBN, f"isbn:{isbn}"
        elif title and author:
            return SearchType.TITLE_AUTHOR, f"intitle:{title}+inauthor:{author}"
        else:
            return SearchType.TITLE_ONLY, f"intitle:{title}"
    
    def _query_google_books_api(self, query: str) -> Optional[Dict[str, Any]]:
        """Query Google Books API with proper error handling."""
        url = f"{self.base_url}/volumes"
        params = {
            'q': query,
            'maxResults': 1,
            'printType': 'books',
            'projection': 'full'  # Get complete data including sale info
        }
        
        if self.api_key:
            params['key'] = self.api_key
        
        response = self._make_request(url, params)
        return response.json()
    
    def _process_book_data(self, book_data: Dict[str, Any], search_type: SearchType) -> PurchaseLink:
        """Process Google Books API response into PurchaseLink."""
        volume_info = book_data.get('volumeInfo', {})
        sale_info = book_data.get('saleInfo', {})
        
        # Extract purchase URL (prefer buyLink over infoLink)
        buy_link = sale_info.get('buyLink') or volume_info.get('infoLink')
        
        if not buy_link:
            return self._create_unavailable_link(search_type, "No purchase link available")
        
        # Extract price information
        price, currency = self._extract_price_info(sale_info)
        
        # Determine availability
        saleability = sale_info.get('saleability', 'NOT_FOR_SALE')
        available = saleability in ['FOR_SALE', 'FREE']
        
        return PurchaseLink(
            url=buy_link,
            platform="google_books",
            price=price,
            currency=currency,
            available=available,
            is_ebook=sale_info.get('isEbook', False),
            is_affiliate=False,
            status=LinkStatus.AVAILABLE if available else LinkStatus.UNAVAILABLE,
            search_type=search_type,
            metadata={
                'title': volume_info.get('title'),
                'authors': volume_info.get('authors', []),
                'publisher': volume_info.get('publisher'),
                'published_date': volume_info.get('publishedDate'),
                'page_count': volume_info.get('pageCount'),
                'categories': volume_info.get('categories', []),
                'average_rating': volume_info.get('averageRating'),
                'ratings_count': volume_info.get('ratingsCount'),
                'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail'),
                'saleability': saleability,
                'google_books_id': book_data.get('id')
            }
        )
    
    def _extract_price_info(self, sale_info: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract price and currency from sale info."""
        retail_price = sale_info.get('retailPrice')
        if retail_price and isinstance(retail_price, dict):
            amount = retail_price.get('amount')
            currency = retail_price.get('currencyCode', 'USD')
            
            if amount is not None:
                return f"{amount:.2f}", currency
        
        return None, None
    
    def _create_unavailable_link(self, search_type: SearchType, reason: str) -> PurchaseLink:
        """Create an unavailable link with error information."""
        return PurchaseLink(
            url="",
            platform="google_books",
            available=False,
            status=LinkStatus.UNAVAILABLE,
            search_type=search_type,
            metadata={'error_reason': reason}
        )
    
    def _create_error_link(self, search_type: SearchType, error: str) -> PurchaseLink:
        """Create an error link with error information."""
        return PurchaseLink(
            url="",
            platform="google_books",
            available=False,
            status=LinkStatus.ERROR,
            search_type=search_type,
            metadata={'error': error}
        )

class AmazonLinkGenerator(BaseLinkGenerator):
    """Production-grade Amazon link generator with affiliate support."""
    
    def __init__(self):
        from .config import SUPPORTED_PLATFORMS
        super().__init__("amazon", SUPPORTED_PLATFORMS['amazon'])
        self.affiliate_tag = config.amazon_affiliate_tag
        self.base_url = config.amazon_base_url
        self.patterns = SEARCH_PATTERNS.get('amazon', {})
        
        if not self.affiliate_tag:
            self.logger.info("Amazon affiliate tag not configured - no affiliate revenue")
    
    def generate_link(self, title: str, author: str = "", isbn: str = "") -> Optional[PurchaseLink]:
        """Generate Amazon purchase link with affiliate support."""
        try:
            self._validate_inputs(title, author, isbn)
            
            search_type, search_path = self._build_search_path(title, author, isbn)
            url = self._build_final_url(search_path)
            
            return PurchaseLink(
                url=url,
                platform="amazon",
                available=True,  # Amazon has extensive catalog
                is_affiliate=bool(self.affiliate_tag),
                status=LinkStatus.AVAILABLE,
                search_type=search_type,
                metadata={
                    'affiliate_enabled': bool(self.affiliate_tag),
                    'region': config.amazon_region.value,
                    'search_method': search_type.value
                }
            )
            
        except ValueError as e:
            self.logger.error(f"Amazon link generation validation error: {e}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error generating Amazon link: {e}")
            return self._create_error_link(SearchType.TITLE_ONLY, str(e))
    
    def _build_search_path(self, title: str, author: str, isbn: str) -> tuple[SearchType, str]:
        """Build Amazon search path based on available information."""
        if isbn and self._is_valid_isbn(isbn):
            search_type = SearchType.ISBN
            pattern = self.patterns.get('isbn_search', '/s?k={isbn}&i=stripbooks')
            path = pattern.format(isbn=self._clean_search_term(isbn))
        elif title and author:
            search_type = SearchType.TITLE_AUTHOR
            pattern = self.patterns.get('title_author_search', '/s?k={title}+{author}&i=stripbooks')
            path = pattern.format(
                title=self._clean_search_term(title),
                author=self._clean_search_term(author)
            )
        else:
            search_type = SearchType.TITLE_ONLY
            pattern = self.patterns.get('title_search', '/s?k={title}&i=stripbooks')
            path = pattern.format(title=self._clean_search_term(title))
        
        return search_type, path
    
    def _build_final_url(self, search_path: str) -> str:
        """Build final URL with affiliate tag if available."""
        url = f"{self.base_url}{search_path}"
        
        if self.affiliate_tag:
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}tag={self.affiliate_tag}"
        
        return url
    
    def _create_error_link(self, search_type: SearchType, error: str) -> PurchaseLink:
        """Create an error link for Amazon."""
        return PurchaseLink(
            url="",
            platform="amazon",
            available=False,
            status=LinkStatus.ERROR,
            search_type=search_type,
            metadata={'error': error}
        )

class FlipkartLinkGenerator(BaseLinkGenerator):
    """Production-grade Flipkart link generator for Indian market."""
    
    def __init__(self):
        from .config import SUPPORTED_PLATFORMS
        super().__init__("flipkart", SUPPORTED_PLATFORMS['flipkart'])
        self.affiliate_id = config.flipkart_affiliate_id
        self.base_url = config.flipkart_base_url
        self.patterns = SEARCH_PATTERNS.get('flipkart', {})
    
    def generate_link(self, title: str, author: str = "", isbn: str = "") -> Optional[PurchaseLink]:
        """Generate Flipkart purchase link."""
        try:
            self._validate_inputs(title, author, isbn)
            
            search_type, search_path = self._build_search_path(title, author, isbn)
            url = self._build_final_url(search_path)
            
            return PurchaseLink(
                url=url,
                platform="flipkart",
                available=True,
                is_affiliate=bool(self.affiliate_id),
                status=LinkStatus.AVAILABLE,
                search_type=search_type,
                metadata={
                    'affiliate_enabled': bool(self.affiliate_id),
                    'region': 'IN',
                    'search_method': search_type.value
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error generating Flipkart link: {e}")
            return None
    
    def _build_search_path(self, title: str, author: str, isbn: str) -> tuple[SearchType, str]:
        """Build Flipkart search path."""
        if isbn and self._is_valid_isbn(isbn):
            search_type = SearchType.ISBN
            pattern = self.patterns.get('isbn_search', '/search?q={isbn}&otracker=search')
            path = pattern.format(isbn=self._clean_search_term(isbn))
        elif title and author:
            search_type = SearchType.TITLE_AUTHOR
            pattern = self.patterns.get('title_author_search', '/search?q={title}+{author}&otracker=search')
            path = pattern.format(
                title=self._clean_search_term(title),
                author=self._clean_search_term(author)
            )
        else:
            search_type = SearchType.TITLE_ONLY
            pattern = self.patterns.get('title_search', '/search?q={title}&otracker=search')
            path = pattern.format(title=self._clean_search_term(title))
        
        return search_type, path
    
    def _build_final_url(self, search_path: str) -> str:
        """Build final URL with affiliate ID if available."""
        url = f"{self.base_url}{search_path}"
        
        if self.affiliate_id:
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}affid={self.affiliate_id}"
        
        return url

class BarnesNobleLinkGenerator(BaseLinkGenerator):
    """Production-grade Barnes & Noble link generator."""
    
    def __init__(self):
        from .config import SUPPORTED_PLATFORMS
        super().__init__("barnes_noble", SUPPORTED_PLATFORMS['barnes_noble'])
        self.affiliate_id = config.barnes_noble_affiliate_id
        self.base_url = config.barnes_noble_base_url
        self.patterns = SEARCH_PATTERNS.get('barnes_noble', {})
    
    def generate_link(self, title: str, author: str = "", isbn: str = "") -> Optional[PurchaseLink]:
        """Generate Barnes & Noble purchase link."""
        try:
            self._validate_inputs(title, author, isbn)
            
            search_type, search_path = self._build_search_path(title, author, isbn)
            url = f"{self.base_url}{search_path}"
            
            return PurchaseLink(
                url=url,
                platform="barnes_noble",
                available=True,
                is_affiliate=bool(self.affiliate_id),
                status=LinkStatus.AVAILABLE,
                search_type=search_type,
                metadata={
                    'affiliate_enabled': bool(self.affiliate_id),
                    'search_method': search_type.value
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error generating Barnes & Noble link: {e}")
            return None
    
    def _build_search_path(self, title: str, author: str, isbn: str) -> tuple[SearchType, str]:
        """Build Barnes & Noble search path (uses dashes instead of plus signs)."""
        if isbn and self._is_valid_isbn(isbn):
            search_type = SearchType.ISBN
            pattern = self.patterns.get('isbn_search', '/s/{isbn}')
            path = pattern.format(isbn=isbn)
        elif title and author:
            search_type = SearchType.TITLE_AUTHOR
            pattern = self.patterns.get('title_author_search', '/s/{title}-{author}')
            # B&N uses dashes in URLs
            clean_title = self._clean_search_term(title).replace('+', '-')
            clean_author = self._clean_search_term(author).replace('+', '-')
            path = pattern.format(title=clean_title, author=clean_author)
        else:
            search_type = SearchType.TITLE_ONLY
            pattern = self.patterns.get('title_search', '/s/{title}')
            clean_title = self._clean_search_term(title).replace('+', '-')
            path = pattern.format(title=clean_title)
        
        return search_type, path

def get_all_generators() -> Dict[str, BaseLinkGenerator]:
    """
    Factory function to get all available and configured link generators.
    Only returns generators for platforms that are properly configured.
    """
    generators = {}
    
    # Always include Google Books (works without API key, just with rate limits)
    generators['google_books'] = GoogleBooksLinkGenerator()
    
    # Include other platforms only if configured
    if config.amazon_affiliate_tag or config.amazon_access_key:
        generators['amazon'] = AmazonLinkGenerator()
    
    if config.flipkart_affiliate_id:
        generators['flipkart'] = FlipkartLinkGenerator()
    
    # Barnes & Noble doesn't require special configuration
    generators['barnes_noble'] = BarnesNobleLinkGenerator()
    
    logger.info(f"Initialized {len(generators)} link generators: {list(generators.keys())}")
    return generators