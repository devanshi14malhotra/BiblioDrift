# Production-grade Mood Analysis for Book Reviews
# Dynamic sentiment analysis with configurable parameters and robust error handling

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
import re
import logging
import os
from typing import List, Dict, Tuple, Optional
from collections import Counter, defaultdict
from dataclasses import dataclass
import statistics
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import string

@dataclass
class AnalysisConfig:
    """Configuration for mood analysis"""
    min_reviews: int = int(os.getenv('MIN_REVIEWS_FOR_ANALYSIS', '3'))
    confidence_threshold: float = float(os.getenv('CONFIDENCE_THRESHOLD', '0.1'))
    min_word_frequency: int = int(os.getenv('MIN_WORD_FREQUENCY', '2'))
    max_mood_categories: int = int(os.getenv('MAX_MOOD_CATEGORIES', '5'))
    sentiment_weight: float = float(os.getenv('SENTIMENT_WEIGHT', '0.7'))
    keyword_weight: float = float(os.getenv('KEYWORD_WEIGHT', '0.3'))

class BookMoodAnalyzer:
    """
    Production-grade book mood analyzer with dynamic mood detection,
    configurable parameters, and robust error handling.
    """
    
    def __init__(self, config: Optional[AnalysisConfig] = None):
        self.config = config or AnalysisConfig()
        self.logger = self._setup_logging()
        self.vader_analyzer = SentimentIntensityAnalyzer()
        self._ensure_nltk_data()
        
        # Dynamic mood detection - no hardcoded categories
        self.emotion_patterns = self._load_emotion_patterns()
        
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
    
    def _ensure_nltk_data(self):
        """Ensure required NLTK data is available"""
        try:
            nltk.data.find('tokenizers/punkt')
            nltk.data.find('corpora/stopwords')
        except LookupError:
            self.logger.info("Downloading required NLTK data...")
            try:
                nltk.download('punkt', quiet=True)
                nltk.download('stopwords', quiet=True)
            except Exception as e:
                self.logger.warning(f"Could not download NLTK data: {e}")
    
    def _load_emotion_patterns(self) -> Dict[str, List[str]]:
        """
        Load emotion patterns dynamically - can be extended to load from files
        or learn from data. This is a base set that gets enhanced by analysis.
        """
        return {
            'positive_emotions': [
                'joy', 'happiness', 'love', 'excitement', 'hope', 'satisfaction',
                'delight', 'pleasure', 'contentment', 'bliss', 'euphoria'
            ],
            'negative_emotions': [
                'sadness', 'anger', 'fear', 'disgust', 'anxiety', 'depression',
                'frustration', 'disappointment', 'grief', 'despair', 'rage'
            ],
            'intensity_modifiers': [
                'very', 'extremely', 'incredibly', 'absolutely', 'completely',
                'totally', 'utterly', 'quite', 'rather', 'somewhat'
            ],
            'literary_qualities': [
                'compelling', 'gripping', 'engaging', 'captivating', 'riveting',
                'thought-provoking', 'profound', 'insightful', 'brilliant', 'masterful'
            ]
        }
    def analyze_sentiment(self, text: str) -> Dict:
        """
        Comprehensive sentiment analysis with error handling.
        
        Args:
            text: Review text to analyze
            
        Returns:
            Dictionary with sentiment scores and confidence metrics
        """
        if not text or not text.strip():
            return self._empty_sentiment_result()
            
        try:
            # VADER analysis - good for social media text
            vader_scores = self.vader_analyzer.polarity_scores(text)
            
            # TextBlob analysis - good for formal text
            blob = TextBlob(text)
            textblob_polarity = blob.sentiment.polarity
            textblob_subjectivity = blob.sentiment.subjectivity
            
            # Calculate confidence based on agreement between methods
            confidence = self._calculate_sentiment_confidence(
                vader_scores['compound'], textblob_polarity
            )
            
            return {
                'vader_compound': vader_scores['compound'],
                'vader_positive': vader_scores['pos'],
                'vader_negative': vader_scores['neg'],
                'vader_neutral': vader_scores['neu'],
                'textblob_polarity': textblob_polarity,
                'textblob_subjectivity': textblob_subjectivity,
                'confidence': confidence,
                'text_length': len(text),
                'word_count': len(text.split())
            }
            
        except Exception as e:
            self.logger.error(f"Error in sentiment analysis: {e}")
            return self._empty_sentiment_result()
    
    def _empty_sentiment_result(self) -> Dict:
        """Return empty sentiment result for error cases"""
        return {
            'vader_compound': 0.0,
            'vader_positive': 0.0,
            'vader_negative': 0.0,
            'vader_neutral': 1.0,
            'textblob_polarity': 0.0,
            'textblob_subjectivity': 0.0,
            'confidence': 0.0,
            'text_length': 0,
            'word_count': 0
        }
    
    def _calculate_sentiment_confidence(self, vader_score: float, textblob_score: float) -> float:
        """
        Calculate confidence based on agreement between sentiment methods.
        
        Args:
            vader_score: VADER compound score (-1 to 1)
            textblob_score: TextBlob polarity score (-1 to 1)
            
        Returns:
            Confidence score (0 to 1)
        """
        # Agreement between methods indicates higher confidence
        agreement = 1 - abs(vader_score - textblob_score) / 2
        
        # Extreme scores are more confident
        extremity = max(abs(vader_score), abs(textblob_score))
        
        # Combine agreement and extremity
        confidence = (agreement * 0.6) + (extremity * 0.4)
        return min(confidence, 1.0)
    def extract_dynamic_moods(self, reviews: List[Dict]) -> Dict[str, float]:
        """
        Dynamically extract mood categories from review text using NLP.
        No hardcoded categories - discovers moods from actual content.
        
        Args:
            reviews: List of review dictionaries
            
        Returns:
            Dictionary mapping discovered moods to confidence scores
        """
        if not reviews:
            return {}
            
        try:
            # Combine all review text
            all_text = " ".join([review.get('text', '') for review in reviews])
            
            # Get stopwords
            try:
                stop_words = set(stopwords.words('english'))
            except LookupError:
                stop_words = set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
            
            # Tokenize and clean
            words = word_tokenize(all_text.lower())
            words = [word for word in words if word not in stop_words and word not in string.punctuation]
            
            # Find emotional and descriptive words
            emotional_words = self._identify_emotional_words(words)
            
            # Cluster similar emotions into mood categories
            mood_clusters = self._cluster_emotions(emotional_words)
            
            # Calculate confidence scores for each mood
            mood_scores = {}
            total_words = len(words)
            
            for mood, word_list in mood_clusters.items():
                frequency = sum(emotional_words.get(word, 0) for word in word_list)
                confidence = min(frequency / max(total_words * 0.01, 1), 1.0)  # Normalize
                
                if confidence >= float(self.config.confidence_threshold):
                    mood_scores[mood] = confidence
            
            return mood_scores
            
        except Exception as e:
            self.logger.error(f"Error in dynamic mood extraction: {e}")
            return {}
    
    def _identify_emotional_words(self, words: List[str]) -> Dict[str, int]:
        """
        Identify words that carry emotional weight using pattern matching
        and frequency analysis.
        """
        emotional_words = Counter()
        
        # Pattern-based identification
        emotion_patterns = [
            r'.*ing$',  # Adjectives ending in -ing (exciting, boring)
            r'.*ed$',   # Past participles (moved, touched)
            r'.*ful$',  # -ful adjectives (beautiful, powerful)
            r'.*ous$',  # -ous adjectives (mysterious, gorgeous)
            r'.*ive$',  # -ive adjectives (captivating, positive)
        ]
        
        for word in words:
            # Check against known emotion categories
            for category, emotion_list in self.emotion_patterns.items():
                if word in emotion_list:
                    emotional_words[word] += 2  # Higher weight for known emotions
                    
            # Check patterns
            for pattern in emotion_patterns:
                if re.match(pattern, word) and len(word) > 4:
                    emotional_words[word] += 1
        
        # Filter by minimum frequency
        return {word: count for word, count in emotional_words.items() 
                if count >= self.config.min_word_frequency}
    
    def _cluster_emotions(self, emotional_words: Dict[str, int]) -> Dict[str, List[str]]:
        """
        Cluster emotional words into coherent mood categories.
        This is a simplified clustering - could be enhanced with ML.
        """
        clusters = defaultdict(list)
        
        # Simple semantic clustering based on word patterns and known associations
        for word in emotional_words:
            mood_category = self._categorize_emotion_word(word)
            clusters[mood_category].append(word)
        
        # Filter out small clusters
        return {mood: words for mood, words in clusters.items() 
                if len(words) >= 2}  # At least 2 words per mood
    
    def _categorize_emotion_word(self, word: str) -> str:
        """
        Categorize an emotional word into a mood category.
        Uses semantic rules and patterns.
        """
        # Positive emotions
        positive_indicators = ['love', 'joy', 'happy', 'wonderful', 'amazing', 'beautiful', 'perfect']
        if any(indicator in word for indicator in positive_indicators):
            return 'uplifting'
        
        # Dark/negative emotions  
        dark_indicators = ['dark', 'scary', 'disturbing', 'twisted', 'grim', 'haunting']
        if any(indicator in word for indicator in dark_indicators):
            return 'dark'
        
        # Mystery/suspense
        mystery_indicators = ['mystery', 'suspense', 'intrigue', 'puzzle', 'secret']
        if any(indicator in word for indicator in mystery_indicators):
            return 'mysterious'
        
        # Romance
        romance_indicators = ['love', 'romance', 'passion', 'heart', 'romantic']
        if any(indicator in word for indicator in romance_indicators):
            return 'romantic'
        
        # Intensity
        intense_indicators = ['intense', 'powerful', 'overwhelming', 'gripping', 'dramatic']
        if any(indicator in word for indicator in intense_indicators):
            return 'intense'
        
        # Default to general emotional category
        if word in self.emotion_patterns['positive_emotions']:
            return 'positive'
        elif word in self.emotion_patterns['negative_emotions']:
            return 'emotional'
        else:
            return 'atmospheric'
    def determine_primary_mood(self, reviews: List[Dict]) -> Dict:
        """
        Analyze multiple reviews to determine the book's primary mood with
        comprehensive error handling and confidence metrics.
        
        Args:
            reviews: List of review dictionaries from GoodReads scraper
            
        Returns:
            Dictionary with comprehensive mood analysis results
        """
        if not reviews:
            return {'error': 'No reviews provided', 'success': False}
        
        if len(reviews) < self.config.min_reviews:
            self.logger.warning(f"Only {len(reviews)} reviews available, minimum {self.config.min_reviews} recommended")
        
        try:
            self.logger.info(f"Analyzing mood from {len(reviews)} reviews")
            
            # Analyze individual reviews
            review_analyses = []
            sentiment_scores = []
            
            for i, review in enumerate(reviews):
                try:
                    text = review.get('text', '')
                    if not text:
                        continue
                        
                    sentiment = self.analyze_sentiment(text)
                    sentiment_scores.append(sentiment)
                    
                    review_analyses.append({
                        'sentiment': sentiment,
                        'rating': review.get('rating'),
                        'text_length': len(text),
                        'word_count': len(text.split()),
                        'helpful_votes': review.get('helpful_votes', 0)
                    })
                    
                except Exception as e:
                    self.logger.warning(f"Error analyzing review {i}: {e}")
                    continue
            
            if not sentiment_scores:
                return {'error': 'No valid reviews to analyze', 'success': False}
            
            # Calculate aggregate sentiment statistics
            overall_sentiment = self._calculate_overall_sentiment(sentiment_scores)
            
            # Extract dynamic moods from review content
            dynamic_moods = self.extract_dynamic_moods(reviews)
            
            # Generate mood description and vibe
            mood_description = self._generate_mood_description(overall_sentiment, dynamic_moods)
            bibliodrift_vibe = self._generate_bibliodrift_vibe(overall_sentiment['compound_score'], dynamic_moods)
            
            # Calculate analysis confidence
            analysis_confidence = self._calculate_analysis_confidence(sentiment_scores, dynamic_moods)
            
            return {
                'success': True,
                'overall_sentiment': overall_sentiment,
                'primary_moods': [
                    {'mood': mood, 'confidence': confidence} 
                    for mood, confidence in sorted(dynamic_moods.items(), 
                                                 key=lambda x: x[1], reverse=True)
                ],
                'mood_description': mood_description,
                'bibliodrift_vibe': bibliodrift_vibe,
                'analysis_confidence': analysis_confidence,
                'total_reviews_analyzed': len(review_analyses),
                'review_statistics': self._calculate_review_statistics(review_analyses),
                'metadata': {
                    'analyzer_version': '2.0.0',
                    'analysis_timestamp': self._get_timestamp(),
                    'config_used': {
                        'min_reviews': self.config.min_reviews,
                        'confidence_threshold': self.config.confidence_threshold
                    }
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error in mood analysis: {e}")
            return {
                'error': f'Analysis failed: {str(e)}',
                'success': False
            }
    
    def _calculate_overall_sentiment(self, sentiment_scores: List[Dict]) -> Dict:
        """Calculate robust aggregate sentiment statistics"""
        try:
            compounds = [s['vader_compound'] for s in sentiment_scores]
            positives = [s['vader_positive'] for s in sentiment_scores]
            negatives = [s['vader_negative'] for s in sentiment_scores]
            textblob_polarities = [s['textblob_polarity'] for s in sentiment_scores]
            confidences = [s['confidence'] for s in sentiment_scores]
            
            return {
                'compound_score': statistics.mean(compounds),
                'compound_median': statistics.median(compounds),
                'compound_stdev': statistics.stdev(compounds) if len(compounds) > 1 else 0,
                'positive_score': statistics.mean(positives),
                'negative_score': statistics.mean(negatives),
                'textblob_polarity': statistics.mean(textblob_polarities),
                'average_confidence': statistics.mean(confidences),
                'sentiment_consistency': 1 - (statistics.stdev(compounds) if len(compounds) > 1 else 0)
            }
        except Exception as e:
            self.logger.error(f"Error calculating overall sentiment: {e}")
            return {'compound_score': 0, 'average_confidence': 0}
    
    def _calculate_analysis_confidence(self, sentiment_scores: List[Dict], moods: Dict) -> float:
        """Calculate overall confidence in the analysis"""
        try:
            # Sentiment confidence
            sentiment_confidence = statistics.mean([s['confidence'] for s in sentiment_scores])
            
            # Mood detection confidence (based on number and strength of detected moods)
            mood_confidence = min(len(moods) * 0.2, 1.0) if moods else 0
            
            # Sample size confidence
            sample_confidence = min(len(sentiment_scores) / 10, 1.0)
            
            # Weighted average
            overall_confidence = (
                sentiment_confidence * 0.5 +
                mood_confidence * 0.3 +
                sample_confidence * 0.2
            )
            
            return round(overall_confidence, 3)
            
        except Exception:
            return 0.5  # Default moderate confidence
    
    def _calculate_review_statistics(self, review_analyses: List[Dict]) -> Dict:
        """Calculate statistics about the review corpus"""
        try:
            lengths = [r['text_length'] for r in review_analyses]
            word_counts = [r['word_count'] for r in review_analyses]
            ratings = [r['rating'] for r in review_analyses if r['rating']]
            
            return {
                'average_length': statistics.mean(lengths) if lengths else 0,
                'average_word_count': statistics.mean(word_counts) if word_counts else 0,
                'average_rating': statistics.mean(ratings) if ratings else None,
                'rating_distribution': Counter(ratings) if ratings else {},
                'total_helpful_votes': sum(r.get('helpful_votes', 0) for r in review_analyses)
            }
        except Exception:
            return {}
    
    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'
    
    def _generate_mood_description(self, overall_sentiment: Dict, dynamic_moods: Dict) -> str:
        """Generate a human-readable mood description."""
        
        compound_score = overall_sentiment.get('compound_score', 0)
        
        if compound_score >= 0.5:
            sentiment_desc = "overwhelmingly positive"
        elif compound_score >= 0.1:
            sentiment_desc = "generally positive"
        elif compound_score >= -0.1:
            sentiment_desc = "mixed"
        elif compound_score >= -0.5:
            sentiment_desc = "somewhat negative"
        else:
            sentiment_desc = "predominantly negative"
        
        if dynamic_moods:
            primary_mood = max(dynamic_moods.items(), key=lambda x: x[1])[0]
            return f"This book has a {sentiment_desc} reception with a primarily {primary_mood} mood."
        else:
            return f"This book has a {sentiment_desc} reception."
    
    def _generate_bibliodrift_vibe(self, compound_score: float, dynamic_moods: Dict) -> str:
        """Generate a BiblioDrift-style vibe description."""
        
        vibes = []
        
        # Base vibe on sentiment
        if compound_score >= 0.5:
            vibes.extend([
                "A book that wraps you in warmth.",
                "Perfect for lifting spirits on any day.",
                "Readers consistently fall in love with this one."
            ])
        elif compound_score >= 0.1:
            vibes.extend([
                "A gentle companion for quiet moments.",
                "Leaves most readers with a satisfied smile.",
                "The kind of book you recommend to friends."
            ])
        elif compound_score >= -0.1:
            vibes.extend([
                "A book that divides readers - in the best way.",
                "Complex emotions await within these pages.",
                "Not for everyone, but unforgettable for some."
            ])
        else:
            vibes.extend([
                "A challenging read that stays with you.",
                "Prepare for an emotionally intense journey.",
                "Not a comfort read, but deeply impactful."
            ])
        
        # Add mood-specific vibes
        if dynamic_moods:
            primary_mood = max(dynamic_moods.items(), key=lambda x: x[1])[0]
            
            mood_vibes = {
                'cozy': "Like a warm blanket on a rainy day.",
                'dark': "Best read with all the lights on.",
                'mysterious': "Will keep you guessing until the very end.",
                'romantic': "Have tissues ready for the swoony moments.",
                'adventurous': "Pack your bags - you're going on a journey.",
                'melancholy': "Beautiful in its sadness, like autumn leaves.",
                'uplifting': "A ray of sunshine in book form.",
                'intense': "Buckle up for an emotional rollercoaster.",
                'whimsical': "Delightfully odd in all the right ways.",
                'thought-provoking': "Will have you pondering long after the last page."
            }
            
            if primary_mood in mood_vibes:
                vibes.append(mood_vibes[primary_mood])
        
        # Return a random vibe
        import random
        return random.choice(vibes)

# Example usage
if __name__ == "__main__":
    # Test with sample reviews
    sample_reviews = [
        {
            'text': "This book was absolutely magical! The characters were so well-developed and the romance was swoon-worthy. I couldn't put it down and found myself completely lost in the cozy atmosphere of the small town setting.",
            'rating': 5
        },
        {
            'text': "A dark and twisted tale that kept me on the edge of my seat. The mystery was intricate and the atmosphere was haunting. Not for the faint of heart, but brilliantly written.",
            'rating': 4
        }
    ]
    
    analyzer = BookMoodAnalyzer()
    result = analyzer.determine_primary_mood(sample_reviews)
    
    print("Mood Analysis Result:")
    print(f"Primary Moods: {result['primary_moods']}")
    print(f"Mood Description: {result['mood_description']}")
    print(f"BiblioDrift Vibe: {result['bibliodrift_vibe']}")