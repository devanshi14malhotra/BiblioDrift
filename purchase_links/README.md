# Purchase Links Module

This module handles book purchase link generation and management for BiblioDrift.

## Features

- **Multi-Platform Support**: Google Books, Amazon, Flipkart, and more
- **Smart Link Generation**: ISBN-based and title/author-based search
- **Configurable Affiliate Links**: Support for affiliate programs
- **Caching**: Efficient link caching to reduce API calls
- **Error Handling**: Graceful fallbacks when links are unavailable

## Structure

```
purchase_links/
├── __init__.py              # Package initialization
├── README.md               # This file
├── purchase_service.py     # Main service class
├── link_generators.py      # Platform-specific link generators
├── purchase_manager.py     # High-level purchase management
└── config.py              # Configuration and constants
```

## Usage

```python
from purchase_links import PurchaseManager

# Initialize manager
manager = PurchaseManager()

# Get purchase links for a book
links = manager.get_purchase_links(
    title="The Great Gatsby",
    author="F. Scott Fitzgerald",
    isbn="9780743273565"
)

# Returns:
# {
#     "google_books": {"url": "...", "price": "...", "available": True},
#     "amazon": {"url": "...", "price": "...", "available": True},
#     "flipkart": {"url": "...", "price": "...", "available": False}
# }
```

## Configuration

All configuration is done via environment variables:

```bash
# Google Books (always available)
GOOGLE_BOOKS_API_KEY=your_api_key_here

# Amazon Affiliate (optional)
AMAZON_AFFILIATE_TAG=your_affiliate_tag
AMAZON_ACCESS_KEY=your_access_key
AMAZON_SECRET_KEY=your_secret_key

# Flipkart Affiliate (optional)
FLIPKART_AFFILIATE_ID=your_affiliate_id
FLIPKART_AFFILIATE_TOKEN=your_affiliate_token

# General settings
PURCHASE_LINKS_CACHE_TTL=3600  # Cache time in seconds
PURCHASE_LINKS_TIMEOUT=10      # Request timeout in seconds
```

## API Endpoints

The module integrates with Flask to provide REST endpoints:

- `POST /api/v1/purchase-links` - Get purchase links for a book
- `GET /api/v1/purchase-links/health` - Check service health

## Error Handling

The module gracefully handles:
- Missing ISBNs (falls back to title/author search)
- Unavailable platforms (returns available links only)
- Network timeouts (uses cached data when possible)
- Invalid book data (returns appropriate error messages)