"""
BiblioDrift Mood Analysis Package

This package provides GoodReads review scraping and sentiment analysis
to determine book "mood" for enhanced book discovery.

Components:
- goodreads_scraper: Scrapes reviews from GoodReads
- mood_analyzer: Analyzes sentiment and determines mood
- ai_service: Enhanced AI service with mood integration
"""

from .goodreads_scraper import GoodReadsReviewScraper
from .mood_analyzer import BookMoodAnalyzer

__version__ = "1.0.0"
__author__ = "BiblioDrift Contributors"

# Export main classes for easy importing
__all__ = [
    'GoodReadsReviewScraper',
    'BookMoodAnalyzer'
]