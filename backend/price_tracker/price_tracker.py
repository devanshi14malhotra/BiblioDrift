"""
Price Tracking Service Module
Tracks book prices across different retailers and alerts users when prices drop.
"""

import os
import logging
import requests
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Supported retailers
RETAILERS = {
    'google_books': 'Google Books',
    'amazon': 'Amazon',
    'barnes_noble': 'Barnes & Noble',
    'flipkart': 'Flipkart'
}

# Google Books API configuration
GOOGLE_BOOKS_API_KEY = os.getenv('GOOGLE_BOOKS_API_KEY', '')
GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes'


class PriceTracker:
    """
    Service for tracking book prices across different retailers.
    Uses Google Books API as the primary price source.
    """
    
    def __init__(self, db=None):
        """
        Initialize the price tracker.
        
        Args:
            db: SQLAlchemy database instance (optional, can be set later)
        """
        self.db = db
        self.api_key = GOOGLE_BOOKS_API_KEY
        self.base_url = GOOGLE_BOOKS_BASE_URL
        self.request_cache = {}  # Simple in-memory cache
        self.cache_ttl = 300  # 5 minutes cache TTL
        
    def set_db(self, db):
        """Set the database instance after initialization."""
        self.db = db
    
    def _make_request(self, url: str, params: Dict[str, str] = None) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to Google Books API with caching and error handling.
        
        Args:
            url: API endpoint URL
            params: Query parameters
            
        Returns:
            JSON response as dictionary or None on failure
        """
        # Check cache first
        cache_key = f"{url}:{str(params)}"
        if cache_key in self.request_cache:
            cached_data = self.request_cache[cache_key]
            if time.time() - cached_data['timestamp'] < self.cache_ttl:
                logger.debug("Using cached price data")
                return cached_data['data']
        
        headers = {
            'User-Agent': 'BiblioDrift/1.0 (Price Tracking Service)',
            'Accept': 'application/json'
        }
        
        try:
            response = requests.get(
                url, 
                params=params, 
                headers=headers, 
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            # Cache the response
            self.request_cache[cache_key] = {
                'data': data,
                'timestamp': time.time()
            }
            
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error making request to {url}: {e}")
            return None
    
    def get_book_price(self, google_books_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current price information for a book from Google Books API.
        
        Args:
            google_books_id: Google Books ID (e.g., 'zyTCAlFPjgYC')
            
        Returns:
            Dictionary with price information or None on failure
        """
        url = f"{self.base_url}/{google_books_id}"
        params = {}
        if self.api_key:
            params['key'] = self.api_key
            
        data = self._make_request(url, params)
        
        if not data or 'saleInfo' not in data:
            return None
            
        sale_info = data.get('saleInfo', {})
        volume_info = data.get('volumeInfo', {})
        
        # Extract price information
        retail_price = sale_info.get('retailPrice')
        if retail_price:
            price = retail_price.get('amount')
            currency = retail_price.get('currencyCode', 'USD')
        else:
            # Try to get list price
            list_price = sale_info.get('listPrice')
            if list_price:
                price = list_price.get('amount')
                currency = list_price.get('currencyCode', 'USD')
            else:
                price = None
                currency = 'USD'
        
        return {
            'book_id': None,  # Will be set when saving to database
            'google_books_id': google_books_id,
            'title': volume_info.get('title'),
            'authors': volume_info.get('authors', []),
            'retailer': 'google_books',
            'price': price,
            'currency': currency,
            'available': sale_info.get('saleability') == 'FOR_SALE',
            'buy_link': sale_info.get('buyLink'),
            'checked_at': datetime.now(timezone.utc).isoformat()
        }
    
    def get_prices_by_title_author(
        self, 
        title: str, 
        author: str = "",
        isbn: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Search for a book and get price information.
        
        Args:
            title: Book title (required)
            author: Book author (optional)
            isbn: Book ISBN (optional)
            
        Returns:
            List of price information dictionaries
        """
        # Build search query
        if isbn:
            query = f"isbn:{isbn}"
        elif author:
            query = f"intitle:{title}+inauthor:{author}"
        else:
            query = f"intitle:{title}"
        
        params = {
            'q': query,
            'maxResults': 5,
            'printType': 'books',
            'projection': 'full'
        }
        
        if self.api_key:
            params['key'] = self.api_key
            
        data = self._make_request(GOOGLE_BOOKS_BASE_URL, params)
        
        if not data or 'items' not in data:
            return []
        
        prices = []
        for item in data['items']:
            sale_info = item.get('saleInfo', {})
            volume_info = item.get('volumeInfo', {})
            
            # Extract price
            retail_price = sale_info.get('retailPrice')
            if retail_price:
                price = retail_price.get('amount')
                currency = retail_price.get('currencyCode', 'USD')
            else:
                price = None
                currency = 'USD'
            
            prices.append({
                'google_books_id': item.get('id'),
                'title': volume_info.get('title'),
                'authors': volume_info.get('authors', []),
                'retailer': 'google_books',
                'price': price,
                'currency': currency,
                'available': sale_info.get('saleability') == 'FOR_SALE',
                'buy_link': sale_info.get('buyLink'),
                'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail'),
                'checked_at': datetime.now(timezone.utc).isoformat()
            })
        
        return prices
    
    def save_price_history(
        self, 
        book_id: int, 
        retailer: str, 
        price: float, 
        currency: str = 'USD'
    ) -> bool:
        """
        Save price history to database.
        
        Args:
            book_id: Database book ID
            retailer: Retailer name
            price: Price value
            currency: Currency code
            
        Returns:
            True if successful, False otherwise
        """
        if not self.db:
            logger.error("Database not initialized")
            return False
            
        try:
            from models import PriceHistory
            
            price_history = PriceHistory(
                book_id=book_id,
                retailer=retailer,
                price=price,
                currency=currency,
                checked_at=datetime.now(timezone.utc)
            )
            
            self.db.session.add(price_history)
            self.db.session.commit()
            logger.info(f"Saved price history for book {book_id}: {price} {currency} at {retailer}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving price history: {e}")
            self.db.session.rollback()
            return False
    
    def get_price_history(
        self, 
        book_id: int, 
        retailer: Optional[str] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get price history for a book.
        
        Args:
            book_id: Database book ID
            retailer: Optional retailer filter
            limit: Maximum number of records to return
            
        Returns:
            List of price history dictionaries
        """
        if not self.db:
            logger.error("Database not initialized")
            return []
            
        try:
            from models import PriceHistory
            
            query = PriceHistory.query.filter_by(book_id=book_id)
            
            if retailer:
                query = query.filter_by(retailer=retailer)
                
            history = query.order_by(PriceHistory.checked_at.desc()).limit(limit).all()
            
            return [h.to_dict() for h in history]
            
        except Exception as e:
            logger.error(f"Error getting price history: {e}")
            return []
    
    def get_latest_prices(self, book_id: int) -> List[Dict[str, Any]]:
        """
        Get the latest price from each retailer for a book.
        
        Args:
            book_id: Database book ID
            
        Returns:
            List of latest price dictionaries
        """
        if not self.db:
            logger.error("Database not initialized")
            return []
            
        try:
            from models import PriceHistory
            from sqlalchemy import func
            
            # Get latest price from each retailer
            subquery = self.db.session.query(
                PriceHistory.retailer,
                func.max(PriceHistory.checked_at).label('max_date')
            ).filter(
                PriceHistory.book_id == book_id
            ).group_by(
                PriceHistory.retailer
            ).subquery()
            
            latest_prices = self.db.session.query(PriceHistory).join(
                subquery,
                (PriceHistory.retailer == subquery.c.retailer) &
                (PriceHistory.checked_at == subquery.c.max_date)
            ).filter(
                PriceHistory.book_id == book_id
            ).all()
            
            return [p.to_dict() for p in latest_prices]
            
        except Exception as e:
            logger.error(f"Error getting latest prices: {e}")
            return []
    
    def check_price_alerts(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Check for price drops for user's active alerts.
        
        Args:
            user_id: User ID
            
        Returns:
            List of triggered alerts with price information
        """
        if not self.db:
            logger.error("Database not initialized")
            return []
            
        try:
            from models import PriceAlert, ShelfItem, Book
            
            # Get all active alerts for user
            alerts = PriceAlert.query.filter_by(
                user_id=user_id, 
                is_active=True
            ).all()
            
            triggered_alerts = []
            
            for alert in alerts:
                shelf_item = alert.shelf_item
                if not shelf_item or not shelf_item.book:
                    continue
                
                book = shelf_item.book
                target_price = alert.target_price
                
                # Get latest prices for this book
                latest_prices = self.get_latest_prices(book.id)
                
                for price_data in latest_prices:
                    current_price = price_data.get('price')
                    if current_price and current_price <= target_price:
                        triggered_alerts.append({
                            'alert_id': alert.id,
                            'shelf_item_id': alert.shelf_item_id,
                            'book_id': book.id,
                            'google_books_id': book.google_books_id,
                            'title': book.title,
                            'authors': book.authors,
                            'thumbnail': book.thumbnail,
                            'target_price': target_price,
                            'current_price': current_price,
                            'currency': price_data.get('currency', 'USD'),
                            'retailer': price_data.get('retailer'),
                            'buy_link': price_data.get('buy_link'),
                            'price_drop_percentage': round((target_price - current_price) / target_price * 100, 1)
                        })
            
            return triggered_alerts
            
        except Exception as e:
            logger.error(f"Error checking price alerts: {e}")
            return []
    
    def create_price_alert(
        self, 
        user_id: int, 
        shelf_item_id: int, 
        target_price: float
    ) -> Dict[str, Any]:
        """
        Create a new price alert for a book.
        
        Args:
            user_id: User ID
            shelf_item_id: Shelf item ID
            target_price: Target price for alert
            
        Returns:
            Dictionary with result information
        """
        if not self.db:
            return {'success': False, 'error': 'Database not initialized'}
            
        try:
            from models import PriceAlert, ShelfItem
            
            # Verify shelf item belongs to user
            shelf_item = ShelfItem.query.get(shelf_item_id)
            if not shelf_item:
                return {'success': False, 'error': 'Shelf item not found'}
            
            if shelf_item.user_id != user_id:
                return {'success': False, 'error': 'Unauthorized'}
            
            # Check if alert already exists
            existing_alert = PriceAlert.query.filter_by(
                user_id=user_id,
                shelf_item_id=shelf_item_id
            ).first()
            
            if existing_alert:
                # Update existing alert
                existing_alert.target_price = target_price
                existing_alert.is_active = True
                alert = existing_alert
            else:
                # Create new alert
                alert = PriceAlert(
                    user_id=user_id,
                    shelf_item_id=shelf_item_id,
                    target_price=target_price,
                    is_active=True
                )
                self.db.session.add(alert)
            
            # Update shelf item
            shelf_item.price_alert = True
            shelf_item.target_price = target_price
            
            self.db.session.commit()
            
            return {
                'success': True,
                'alert': alert.to_dict()
            }
            
        except Exception as e:
            logger.error(f"Error creating price alert: {e}")
            self.db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    def delete_price_alert(self, alert_id: int, user_id: int) -> Dict[str, Any]:
        """
        Delete a price alert.
        
        Args:
            alert_id: Alert ID
            user_id: User ID (for authorization)
            
        Returns:
            Dictionary with result information
        """
        if not self.db:
            return {'success': False, 'error': 'Database not initialized'}
            
        try:
            from models import PriceAlert
            
            alert = PriceAlert.query.get(alert_id)
            if not alert:
                return {'success': False, 'error': 'Alert not found'}
            
            if alert.user_id != user_id:
                return {'success': False, 'error': 'Unauthorized'}
            
            # Check if there are other alerts for this shelf item
            shelf_item_id = alert.shelf_item_id
            other_alerts = PriceAlert.query.filter(
                PriceAlert.shelf_item_id == shelf_item_id,
                PriceAlert.id != alert_id,
                PriceAlert.is_active == True
            ).count()
            
            # If no other active alerts, update shelf item
            if other_alerts == 0:
                from models import ShelfItem
                shelf_item = ShelfItem.query.get(shelf_item_id)
                if shelf_item:
                    shelf_item.price_alert = False
            
            self.db.session.delete(alert)
            self.db.session.commit()
            
            return {'success': True, 'message': 'Alert deleted'}
            
        except Exception as e:
            logger.error(f"Error deleting price alert: {e}")
            self.db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    def get_user_alerts(
        self, 
        user_id: int, 
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get all price alerts for a user.
        
        Args:
            user_id: User ID
            active_only: If True, return only active alerts
            
        Returns:
            List of alert dictionaries
        """
        if not self.db:
            logger.error("Database not initialized")
            return []
            
        try:
            from models import PriceAlert
            
            query = PriceAlert.query.filter_by(user_id=user_id)
            
            if active_only:
                query = query.filter_by(is_active=True)
                
            alerts = query.order_by(PriceAlert.created_at.desc()).all()
            
            return [a.to_dict() for a in alerts]
            
        except Exception as e:
            logger.error(f"Error getting user alerts: {e}")
            return []
    
    def update_prices_for_book(
        self, 
        book_id: int, 
        google_books_id: str
    ) -> Dict[str, Any]:
        """
        Update prices for a book and save to history.
        
        Args:
            book_id: Database book ID
            google_books_id: Google Books ID
            
        Returns:
            Dictionary with update results
        """
        try:
            # Get current prices
            price_data = self.get_book_price(google_books_id)
            
            if not price_data:
                return {'success': False, 'error': 'Could not fetch price data'}
            
            if not price_data.get('price'):
                return {'success': False, 'error': 'No price available for this book'}
            
            # Save to history
            success = self.save_price_history(
                book_id=book_id,
                retailer=price_data['retailer'],
                price=price_data['price'],
                currency=price_data.get('currency', 'USD')
            )
            
            if success:
                return {
                    'success': True,
                    'price': price_data
                }
            else:
                return {'success': False, 'error': 'Failed to save price history'}
                
        except Exception as e:
            logger.error(f"Error updating prices for book: {e}")
            return {'success': False, 'error': str(e)}


# Singleton instance
_price_tracker = None

def get_price_tracker(db=None) -> PriceTracker:
    """
    Get or create the singleton PriceTracker instance.
    
    Args:
        db: Optional database instance
        
    Returns:
        PriceTracker instance
    """
    global _price_tracker
    
    if _price_tracker is None:
        _price_tracker = PriceTracker(db)
    elif db is not None:
        _price_tracker.set_db(db)
    
    return _price_tracker
