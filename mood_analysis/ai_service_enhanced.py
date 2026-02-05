# Enhanced AI service logic with GoodReads sentiment analysis integration
# Implements mood analysis functionality for BiblioDrift

from .goodreads_scraper import GoodReadsReviewScraper
from .mood_analyzer import BookMoodAnalyzer
import json
import os
import logging
from typing import Dict, Optional

class AIBookService:
    """Enhanced AI service with GoodReads mood analysis integration."""
    
    def __init__(self):
        self.scraper = GoodReadsReviewScraper()
        self.mood_analyzer = BookMoodAnalyzer()
        self.cache_file = os.path.join(os.path.dirname(__file__), 'mood_cache.json')
        self.mood_cache = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Load cached mood analyses to avoid re-scraping."""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _save_cache(self):
        """Save mood analyses to cache."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.mood_cache, f, indent=2)
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Error saving cache: {e}")
    
    def _get_cache_key(self, title: str, author: str = "") -> str:
        """Generate cache key for book."""
        return f"{title.lower().strip()}|{author.lower().strip()}"
    
    def analyze_book_mood(self, title: str, author: str = "") -> Optional[Dict]:
        """
        Analyze book mood using GoodReads reviews.
        
        Args:
            title: Book title
            author: Author name
            
        Returns:
            Mood analysis results or None if failed
        """
        cache_key = self._get_cache_key(title, author)
        
        # Check cache first
        if cache_key in self.mood_cache:
            logger = logging.getLogger(__name__)
            logger.info(f"Using cached mood analysis for: {title}")
            return self.mood_cache[cache_key]
        
        try:
            # Scrape reviews
            reviews = self.scraper.get_book_reviews(title, author, max_reviews=15)
            
            if not reviews:
                logger = logging.getLogger(__name__)
                logger.warning(f"No reviews found for: {title}")
                return None
            
            # Analyze mood
            mood_analysis = self.mood_analyzer.determine_primary_mood(reviews)
            
            # Cache the result
            self.mood_cache[cache_key] = mood_analysis
            self._save_cache()
            
            return mood_analysis
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Error analyzing book mood: {e}")
            return None

def get_book_mood_tags(title: str, author: str = "") -> list:
    """
    Get mood tags for a specific book.
    
    Args:
        title: Book title
        author: Author name
        
    Returns:
        List of mood tags
    """
    ai_service = AIBookService()
    mood_analysis = ai_service.analyze_book_mood(title, author)
    
    if mood_analysis and 'primary_moods' in mood_analysis:
        return [mood['mood'] for mood in mood_analysis['primary_moods'][:3]]
    
    return []

def generate_enhanced_book_note(description, title="", author=""):
    """
    Enhanced book note generation with mood analysis.
    """
    ai_service = AIBookService()
    
    # Try to get mood analysis from GoodReads if we have title/author
    if title and author:
        mood_analysis = ai_service.analyze_book_mood(title, author)
        if mood_analysis and 'bibliodrift_vibe' in mood_analysis:
            return mood_analysis['bibliodrift_vibe']
    
    # Fallback to description-based analysis
    if len(description) > 200:
        return "A deep, complex narrative that readers find emotionally resonant."
    elif len(description) > 100:
        return "A compelling story with layers waiting to be discovered."
    elif "mystery" in description.lower():
        return "A mysterious tale that will keep you guessing."
    elif "romance" in description.lower():
        return "A heartwarming story perfect for cozy reading."
    else:
        return "A delightful read for any quiet moment."