# GoodReads Review Scraper and Sentiment Analysis
# Production-grade scraper with proper error handling and rate limiting

import requests
from bs4 import BeautifulSoup
import time
import random
from urllib.parse import urljoin, quote
import re
import logging
import os
from typing import List, Dict, Optional
from dataclasses import dataclass
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

@dataclass
class ScrapingConfig:
    """Configuration for scraping behavior"""
    base_url: str = os.getenv('GOODREADS_BASE_URL', 'https://www.goodreads.com')
    min_delay: float = float(os.getenv('GOODREADS_MIN_DELAY', '2.0'))
    max_delay: float = float(os.getenv('GOODREADS_MAX_DELAY', '5.0'))
    max_retries: int = int(os.getenv('GOODREADS_MAX_RETRIES', '3'))
    timeout: int = int(os.getenv('GOODREADS_TIMEOUT', '30'))
    min_review_length: int = int(os.getenv('MIN_REVIEW_LENGTH', '50'))
    user_agent: str = os.getenv('USER_AGENT', 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')

class GoodReadsReviewScraper:
    """
    Production-grade GoodReads review scraper with proper error handling,
    rate limiting, and retry logic.
    """
    
    def __init__(self, config: Optional[ScrapingConfig] = None):
        self.config = config or ScrapingConfig()
        self.logger = self._setup_logging()
        self.session = self._setup_session()
        
    def _setup_logging(self) -> logging.Logger:
        """Setup structured logging"""
        logger = logging.getLogger(__name__)
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger
        
    def _setup_session(self) -> requests.Session:
        """Setup session with retry strategy and proper headers"""
        session = requests.Session()
        
        # Retry strategy
        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Headers
        session.headers.update({
            'User-Agent': self.config.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })
        
        return session
    def _rate_limit(self):
        """Implement respectful rate limiting"""
        delay = random.uniform(self.config.min_delay, self.config.max_delay)
        self.logger.debug(f"Rate limiting: waiting {delay:.2f} seconds")
        time.sleep(delay)
        
    def search_book_by_title(self, title: str, author: str = "") -> Optional[str]:
        """
        Search for a book on GoodReads and return the book URL.
        
        Args:
            title: Book title
            author: Author name (optional)
            
        Returns:
            Book URL if found, None otherwise
            
        Raises:
            requests.RequestException: If network request fails
        """
        try:
            self._rate_limit()
            
            # Sanitize and prepare query
            query = f"{title.strip()} {author.strip()}".strip()
            if not query:
                raise ValueError("Title cannot be empty")
                
            search_url = f"{self.config.base_url}/search?q={quote(query)}"
            self.logger.info(f"Searching for book: {query}")
            
            response = self.session.get(search_url, timeout=self.config.timeout)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try multiple selectors for robustness
            selectors = [
                'a.bookTitle',
                'a[href*="/book/show/"]',
                '.bookTitle a'
            ]
            
            book_link = None
            for selector in selectors:
                book_link = soup.select_one(selector)
                if book_link:
                    break
                    
            if book_link and book_link.get('href'):
                book_url = urljoin(self.config.base_url, book_link['href'])
                self.logger.info(f"Found book URL: {book_url}")
                return book_url
            else:
                self.logger.warning(f"No book found for query: {query}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Network error searching for book '{query}': {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error searching for book '{query}': {e}")
            return None
    def scrape_reviews(self, book_url: str, max_reviews: int = 20) -> List[Dict]:
        """
        Scrape reviews from a GoodReads book page with robust error handling.
        
        Args:
            book_url: URL of the book on GoodReads
            max_reviews: Maximum number of reviews to scrape
            
        Returns:
            List of review dictionaries with text, rating, etc.
            
        Raises:
            requests.RequestException: If network request fails
        """
        reviews = []
        
        try:
            self._rate_limit()
            
            self.logger.info(f"Scraping reviews from: {book_url}")
            response = self.session.get(book_url, timeout=self.config.timeout)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Multiple selectors for different GoodReads layouts
            review_selectors = [
                'div.review',
                'article.ReviewCard',
                'div[data-testid="review"]',
                '.ReviewText'
            ]
            
            review_elements = []
            for selector in review_selectors:
                elements = soup.select(selector)
                if elements:
                    review_elements = elements[:max_reviews]
                    self.logger.debug(f"Found reviews using selector: {selector}")
                    break
            
            if not review_elements:
                self.logger.warning("No review elements found with any selector")
                return reviews
            
            for i, review_elem in enumerate(review_elements):
                try:
                    review_data = self._extract_review_data(review_elem)
                    if review_data and len(review_data.get('text', '')) >= self.config.min_review_length:
                        reviews.append(review_data)
                        self.logger.debug(f"Extracted review {i+1}: {len(review_data['text'])} chars")
                    
                except Exception as e:
                    self.logger.warning(f"Error parsing review {i+1}: {e}")
                    continue
                    
            self.logger.info(f"Successfully scraped {len(reviews)} reviews")
            return reviews
            
        except requests.RequestException as e:
            self.logger.error(f"Network error scraping reviews from {book_url}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error scraping reviews: {e}")
            return reviews
    
    def _extract_review_data(self, review_elem) -> Optional[Dict]:
        """
        Extract review data from a review element with multiple fallback strategies.
        
        Args:
            review_elem: BeautifulSoup element containing review
            
        Returns:
            Dictionary with review data or None if extraction fails
        """
        try:
            # Multiple strategies for text extraction
            text_selectors = [
                '.reviewText',
                '.readable',
                '[data-testid="review-text"]',
                '.TruncatedContent',
                'span[style*="display:none"]'  # Hidden full text
            ]
            
            review_text = ""
            for selector in text_selectors:
                text_elem = review_elem.select_one(selector)
                if text_elem:
                    review_text = text_elem.get_text(strip=True)
                    if len(review_text) > 20:  # Minimum viable text
                        break
            
            if not review_text:
                # Fallback: get all text from review element
                review_text = review_elem.get_text(strip=True)
            
            # Extract rating with multiple strategies
            rating = None
            rating_selectors = [
                '.staticStars',
                '[data-testid="rating"]',
                '.rating .stars',
                'span[title*="star"]'
            ]
            
            for selector in rating_selectors:
                rating_elem = review_elem.select_one(selector)
                if rating_elem:
                    # Try different rating extraction methods
                    rating_text = rating_elem.get('title', '') or rating_elem.get_text()
                    rating_match = re.search(r'(\d+)', rating_text)
                    if rating_match:
                        rating = int(rating_match.group(1))
                        break
            
            # Extract helpful votes if available
            helpful_votes = 0
            helpful_selectors = [
                '.likesCount',
                '[data-testid="likes-count"]',
                '.helpfulVotes'
            ]
            
            for selector in helpful_selectors:
                helpful_elem = review_elem.select_one(selector)
                if helpful_elem:
                    helpful_text = helpful_elem.get_text()
                    helpful_match = re.search(r'(\d+)', helpful_text)
                    if helpful_match:
                        helpful_votes = int(helpful_match.group(1))
                        break
            
            return {
                'text': review_text,
                'rating': rating,
                'helpful_votes': helpful_votes,
                'length': len(review_text),
                'word_count': len(review_text.split())
            }
            
        except Exception as e:
            self.logger.debug(f"Error extracting review data: {e}")
            return None
    def get_book_reviews(self, title: str, author: str = "", max_reviews: int = 20) -> List[Dict]:
        """
        Complete workflow: search for book and scrape its reviews with full error handling.
        
        Args:
            title: Book title
            author: Author name
            max_reviews: Maximum reviews to scrape
            
        Returns:
            List of review dictionaries
            
        Raises:
            ValueError: If title is empty
            requests.RequestException: If network requests fail
        """
        if not title.strip():
            raise ValueError("Book title cannot be empty")
            
        self.logger.info(f"Starting review collection for: '{title}' by '{author}'")
        
        try:
            # Search for book
            book_url = self.search_book_by_title(title, author)
            if not book_url:
                self.logger.warning(f"Book not found: '{title}' by '{author}'")
                return []
            
            # Scrape reviews
            reviews = self.scrape_reviews(book_url, max_reviews)
            
            # Log summary statistics
            if reviews:
                avg_length = sum(r['length'] for r in reviews) / len(reviews)
                ratings = [r['rating'] for r in reviews if r['rating']]
                avg_rating = sum(ratings) / len(ratings) if ratings else None
                
                self.logger.info(
                    f"Collection complete: {len(reviews)} reviews, "
                    f"avg length: {avg_length:.0f} chars, "
                    f"avg rating: {avg_rating:.1f}" if avg_rating else "no ratings"
                )
            else:
                self.logger.warning("No reviews collected")
            
            return reviews
            
        except requests.RequestException:
            # Re-raise network errors for caller to handle
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error in review collection: {e}")
            return []

# Example usage with proper error handling
if __name__ == "__main__":
    import sys
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Configuration from environment
    config = ScrapingConfig()
    scraper = GoodReadsReviewScraper(config)
    
    try:
        # Test with a popular book
        reviews = scraper.get_book_reviews(
            "The Seven Husbands of Evelyn Hugo", 
            "Taylor Jenkins Reid",
            max_reviews=5
        )
        
        if reviews:
            print(f"\nSuccessfully collected {len(reviews)} reviews:")
            for i, review in enumerate(reviews[:2], 1):
                print(f"\nReview {i}:")
                print(f"Rating: {review.get('rating', 'N/A')}")
                print(f"Length: {review['length']} chars")
                print(f"Text: {review['text'][:150]}...")
        else:
            print("No reviews found")
            
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)