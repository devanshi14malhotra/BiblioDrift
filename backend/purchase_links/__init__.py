# Purchase Links Package
# Production-grade book purchase link generation system

"""
BiblioDrift Purchase Links Package

This package provides comprehensive book purchase link generation
for multiple platforms including Google Books, Amazon, Flipkart, and Barnes & Noble.

Main Components:
- config: Environment-based configuration management
- link_generators: Platform-specific link generators
- purchase_service: Core service with caching and error handling
- purchase_manager: High-level interface for frontend integration

Usage:
    from purchase_links import PurchaseManager
    
    manager = PurchaseManager()
    links = manager.get_purchase_links(book_data)
"""

from .config import config, SUPPORTED_PLATFORMS
from .link_generators import get_all_generators, PurchaseLink
from .purchase_service import PurchaseLinkService
from .purchase_manager import PurchaseManager, get_purchase_links_for_book, get_quick_purchase_links

__version__ = "1.0.0"
__author__ = "BiblioDrift Team"

__all__ = [
    'config',
    'SUPPORTED_PLATFORMS', 
    'PurchaseLink',
    'PurchaseLinkService',
    'PurchaseManager',
    'get_all_generators',
    'get_purchase_links_for_book',
    'get_quick_purchase_links'
]