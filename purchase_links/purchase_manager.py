# High-level purchase management interface
# Provides simplified API for the frontend and integrates with existing book data

import logging
from typing import Dict, List, Optional, Any

from .purchase_service import PurchaseLinkService
from .config import config, SUPPORTED_PLATFORMS, PlatformConfig

# Setup logging
logger = logging.getLogger(__name__)

class PurchaseManager:
    """
    High-level manager for book purchase links.
    Provides simplified interface for frontend integration.
    """
    
    def __init__(self):
        self.service = PurchaseLinkService()
        self.logger = logging.getLogger(__name__)
    
    def get_purchase_links(
        self, 
        book_data: Dict[str, Any],
        preferred_platforms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get purchase links for a book using Google Books API data structure.
        
        Args:
            book_data: Book data from Google Books API (volumeInfo structure)
            preferred_platforms: List of preferred platforms (optional)
            
        Returns:
            Formatted purchase links ready for frontend consumption
        """
        try:
            # Extract book information from Google Books structure
            volume_info = book_data.get('volumeInfo', {})
            
            title = volume_info.get('title', '')
            authors = volume_info.get('authors', [])
            author = authors[0] if authors else ''
            
            # Try to get ISBN
            isbn = self._extract_isbn(volume_info.get('industryIdentifiers', []))
            
            if not title:
                return {
                    'success': False,
                    'error': 'Book title not found in provided data',
                    'links': {}
                }
            
            # Get purchase links
            result = self.service.get_purchase_links(
                title=title,
                author=author,
                isbn=isbn,
                platforms=preferred_platforms
            )
            
            if not result.get('success'):
                return result
            
            # Format for frontend consumption
            formatted_links = self._format_links_for_frontend(result['links'])
            
            return {
                'success': True,
                'book_info': {
                    'title': title,
                    'author': author,
                    'isbn': isbn,
                    'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail')
                },
                'purchase_links': formatted_links,
                'metadata': result.get('metadata', {}),
                'total_available': len([l for l in formatted_links if l['available']])
            }
            
        except Exception as e:
            self.logger.error(f"Error getting purchase links: {e}")
            return {
                'success': False,
                'error': str(e),
                'links': {}
            }
    
    def get_quick_links(
        self, 
        title: str, 
        author: str = "", 
        isbn: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Get quick purchase links for simple title/author queries.
        Returns only available links in a simplified format.
        
        Args:
            title: Book title
            author: Book author (optional)
            isbn: Book ISBN (optional)
            
        Returns:
            List of available purchase links
        """
        try:
            result = self.service.get_purchase_links(title, author, isbn)
            
            if not result.get('success'):
                return []
            
            # Return only available links
            formatted_links = self._format_links_for_frontend(result['links'])
            return [link for link in formatted_links if link['available']]
            
        except Exception as e:
            self.logger.error(f"Error getting quick links: {e}")
            return []
    
    def _extract_isbn(self, industry_identifiers: List[Dict[str, str]]) -> str:
        """Extract ISBN from Google Books industry identifiers."""
        if not industry_identifiers:
            return ""
        
        # Prefer ISBN_13, then ISBN_10
        for identifier in industry_identifiers:
            if identifier.get('type') == 'ISBN_13':
                return identifier.get('identifier', '')
        
        for identifier in industry_identifiers:
            if identifier.get('type') == 'ISBN_10':
                return identifier.get('identifier', '')
        
        # Return first available identifier as fallback
        return industry_identifiers[0].get('identifier', '')
    
    def _format_links_for_frontend(self, links: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format purchase links for frontend consumption."""
        formatted_links = []
        
        # Sort by platform priority
        sorted_platforms = sorted(
            links.items(),
            key=lambda x: SUPPORTED_PLATFORMS.get(x[0], PlatformConfig(
                name='Unknown', icon='', color='', priority=999, always_available=False
            )).priority
        )
        
        for platform_id, link_data in sorted_platforms:
            platform_info = SUPPORTED_PLATFORMS.get(platform_id, PlatformConfig(
                name='Unknown', icon='fas fa-book', color='#000000', priority=999, always_available=False
            ))
            
            formatted_link = {
                'platform': platform_id,
                'name': platform_info.name,
                'url': link_data.get('url', ''),
                'available': link_data.get('available', False),
                'price': link_data.get('price'),
                'currency': link_data.get('currency'),
                'is_ebook': link_data.get('is_ebook', False),
                'is_affiliate': link_data.get('is_affiliate', False),
                'icon': platform_info.icon,
                'color': platform_info.color,
                'priority': platform_info.priority
            }
            
            # Add error information if not available
            if not formatted_link['available']:
                formatted_link['error'] = link_data.get('error', 'Link not available')
            
            formatted_links.append(formatted_link)
        
        return formatted_links
    
    def get_platform_info(self) -> Dict[str, Any]:
        """Get information about supported platforms."""
        return self.service.get_platform_status()
    
    def clear_cache(self):
        """Clear the purchase links cache."""
        self.service.clear_cache()
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check."""
        return self.service.health_check()

# Convenience functions for direct use
def get_purchase_links_for_book(book_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to get purchase links for a book."""
    manager = PurchaseManager()
    return manager.get_purchase_links(book_data)

def get_quick_purchase_links(title: str, author: str = "", isbn: str = "") -> List[Dict[str, Any]]:
    """Convenience function to get quick purchase links."""
    manager = PurchaseManager()
    return manager.get_quick_links(title, author, isbn)