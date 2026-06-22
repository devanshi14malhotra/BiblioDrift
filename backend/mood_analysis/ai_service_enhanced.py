# Enhanced AI service logic with GoodReads sentiment analysis integration
# Implements mood analysis functionality for BiblioDrift
# Enhanced with comprehensive caching system

from .goodreads_scraper import GoodReadsReviewScraper
from .mood_analyzer import BookMoodAnalyzer
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from pydantic import BaseModel, Field, ValidationError

# Import caching decorators
try:
    from cache_service import cache_mood_tags, CacheConfig
except ImportError:
    # Fallback if cache_service is not available
    def cache_mood_tags(func):
        return func
    class CacheConfig:
        MOOD_ANALYSIS_TTL = 86400

try:
    from backend.models import db, MoodCache
except ImportError:
    from models import db, MoodCache


logger = logging.getLogger(__name__)


class MoodPrimaryMood(BaseModel):
    mood: str
    confidence: Optional[float] = None


class MoodAnalysisResponse(BaseModel):
    success: bool = True
    overall_sentiment: Optional[Dict] = None
    primary_moods: list[MoodPrimaryMood] = Field(default_factory=list)
    mood_description: Optional[str] = None
    bibliodrift_vibe: Optional[str] = None
    analysis_confidence: Optional[float] = None
    total_reviews_analyzed: Optional[int] = None
    review_statistics: Optional[Dict] = None
    metadata: Optional[Dict] = None
    error: Optional[str] = None


class AIBookService:
    """Enhanced AI service with GoodReads mood analysis integration."""
    
    def __init__(self):
        self.scraper = GoodReadsReviewScraper()
        self.mood_analyzer = BookMoodAnalyzer()
    
    def _get_cache_key(self, title: str, author: str = "") -> str:
        """Generate cache key for book."""
        return f"{title.lower().strip()}|{author.lower().strip()}"

    def _is_cache_fresh(self, cached_entry: MoodCache) -> bool:
        """Check whether a cache entry is still valid."""
        updated_at = cached_entry.updated_at
        if updated_at is None:
            return False

        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)

        age = datetime.now(timezone.utc) - updated_at
        return age <= timedelta(seconds=CacheConfig.MOOD_ANALYSIS_TTL)

    def _load_cached_analysis(self, cache_key: str) -> Optional[Dict]:
        """Load cached mood analysis from the database."""
        cached_entry = MoodCache.query.filter_by(cache_key=cache_key).first()
        if not cached_entry or not self._is_cache_fresh(cached_entry):
            return None

        try:
            return json.loads(cached_entry.analysis_json)
        except (TypeError, json.JSONDecodeError):
            logger.warning("Invalid mood cache payload for key: %s", cache_key)
            return None

    def _validate_mood_analysis(self, mood_analysis: Dict) -> Optional[Dict]:
        """Validate raw mood analysis against the expected response schema."""
        try:
            validated = MoodAnalysisResponse.model_validate(mood_analysis)
            return validated.model_dump(exclude_unset=True)
        except ValidationError as exc:
            logger.error("Mood analysis validation failed: %s", exc)
            return None

    def _store_cached_analysis(self, cache_key: str, title: str, author: str, mood_analysis: Dict) -> None:
        """Persist mood analysis in the database cache."""
        try:
            cached_entry = MoodCache.query.filter_by(cache_key=cache_key).first()
            payload = json.dumps(mood_analysis)

            if cached_entry is None:
                cached_entry = MoodCache(
                    cache_key=cache_key,
                    book_title=title.strip(),
                    book_author=author.strip(),
                    analysis_json=payload,
                )
                db.session.add(cached_entry)
            else:
                cached_entry.book_title = title.strip()
                cached_entry.book_author = author.strip()
                cached_entry.analysis_json = payload
                cached_entry.updated_at = datetime.now(timezone.utc)

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Error saving mood cache for %s: %s", cache_key, e)
    
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
        cached_analysis = self._load_cached_analysis(cache_key)
        if cached_analysis is not None:
            logger.info(f"Using cached mood analysis for: {title}")
            return cached_analysis
        
        try:
            # Scrape reviews
            reviews = self.scraper.get_book_reviews(title, author, max_reviews=15)
            
            if not reviews:
                logger.warning(f"No reviews found for: {title}")
                return None
            
            # Analyze mood
            mood_analysis = self.mood_analyzer.determine_primary_mood(reviews)
            mood_analysis = self._validate_mood_analysis(mood_analysis)
            if mood_analysis is None:
                return None

            # Cache the result
            self._store_cached_analysis(cache_key, title, author, mood_analysis)
            return mood_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing book mood: {e}")
            return None

@cache_mood_tags
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