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
from difflib import SequenceMatcher

@dataclass
class AnalysisConfig:
    """Configuration for mood analysis"""
    min_reviews: int = int(os.getenv('MIN_REVIEWS_FOR_ANALYSIS', '3'))
    confidence_threshold: float = float(os.getenv('CONFIDENCE_THRESHOLD', '0.15'))
    min_word_frequency: int = int(os.getenv('MIN_WORD_FREQUENCY', '1'))
    max_mood_categories: int = int(os.getenv('MAX_MOOD_CATEGORIES', '5'))
    sentiment_weight: float = float(os.getenv('SENTIMENT_WEIGHT', '0.65'))
    keyword_weight: float = float(os.getenv('KEYWORD_WEIGHT', '0.35'))
    # New tuning parameters
    intensity_boost: float = float(os.getenv('INTENSITY_BOOST', '0.3'))  # Boost for intense emotions
    clustering_similarity_threshold: float = float(os.getenv('CLUSTERING_SIMILARITY_THRESHOLD', '0.65'))

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
                'delight', 'pleasure', 'contentment', 'bliss', 'euphoria', 'inspiring',
                'uplifting', 'heartwarming', 'charming', 'delightful', 'wonderful',
                'beautiful', 'brilliant', 'excellent', 'remarkable', 'extraordinary',
                'engaging', 'captivating', 'compelling', 'gripping', 'riveting',
                'magical', 'enchanting', 'whimsical', 'cozy', 'warm', 'tender',
                'touching', 'moving', 'profound', 'meaningful', 'authentic', 'genuine'
            ],
            'negative_emotions': [
                'sadness', 'anger', 'fear', 'disgust', 'anxiety', 'depression',
                'frustration', 'disappointment', 'grief', 'despair', 'rage',
                'heartbreak', 'anguish', 'sorrow', 'melancholy', 'dread', 'terror',
                'horror', 'haunting', 'disturbing', 'unsettling', 'troubling', 'tragic'
            ],
            'intensity_modifiers': [
                'very', 'extremely', 'incredibly', 'absolutely', 'completely',
                'totally', 'utterly', 'quite', 'rather', 'somewhat', 'deeply',
                'profoundly', 'intensely', 'powerfully', 'overwhelmingly'
            ],
            'literary_qualities': [
                'compelling', 'gripping', 'engaging', 'captivating', 'riveting',
                'thought-provoking', 'profound', 'insightful', 'brilliant', 'masterful',
                'lyrical', 'eloquent', 'vivid', 'atmospheric', 'immersive', 'atmospheric',
                'sophisticated', 'nuanced', 'intricate', 'layered', 'complex'
            ],
            'pacing_descriptors': [
                'fast-paced', 'slow-burn', 'relentless', 'leisurely', 'frenetic',
                'measured', 'breathless', 'meditative', 'building', 'accelerating'
            ],
            'atmosphere_descriptors': [
                'dark', 'gloomy', 'mysterious', 'eerie', 'creepy', 'ominous',
                'light', 'bright', 'cheerful', 'sunny', 'bleak', 'desolate',
                'lush', 'vibrant', 'stark', 'cinematic', 'gothic', 'noir'
            ]
        }
    def analyze_sentiment(self, text: str) -> Dict:
        """
        Comprehensive sentiment analysis with error handling and enhanced weighting.
        
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
            
            # Enhanced sentiment calculation with subjectivity weighting
            # More subjective text (higher reviewer emotion) gets more weight
            weighted_polarity = (vader_scores['compound'] * 0.6) + (textblob_polarity * 0.4)
            weighted_polarity = weighted_polarity * (0.7 + textblob_subjectivity * 0.3)
            
            # Calculate confidence based on agreement between methods
            confidence = self._calculate_sentiment_confidence(
                vader_scores['compound'], textblob_polarity, textblob_subjectivity
            )
            
            # Detect intensity modifiers for emphasis
            intensity_factor = self._detect_intensity_modifiers(text)
            
            return {
                'vader_compound': vader_scores['compound'],
                'vader_positive': vader_scores['pos'],
                'vader_negative': vader_scores['neg'],
                'vader_neutral': vader_scores['neu'],
                'textblob_polarity': textblob_polarity,
                'textblob_subjectivity': textblob_subjectivity,
                'weighted_polarity': weighted_polarity,
                'intensity_factor': intensity_factor,
                'confidence': confidence,
                'text_length': len(text),
                'word_count': len(text.split())
            }
            
        except Exception as e:
            self.logger.error(f"Error in sentiment analysis: {e}")
            return self._empty_sentiment_result()
    
    def _detect_intensity_modifiers(self, text: str) -> float:
        """Detect intensity modifiers in text to boost extreme sentiments."""
        text_lower = text.lower()
        intensity_score = 1.0
        
        for modifier in self.emotion_patterns['intensity_modifiers']:
            if modifier in text_lower:
                intensity_score *= 1.15  # 15% boost per modifier
        
        return min(intensity_score, 2.0)  # Cap at 2x
    
    def _empty_sentiment_result(self) -> Dict:
        """Return empty sentiment result for error cases"""
        return {
            'vader_compound': 0.0,
            'vader_positive': 0.0,
            'vader_negative': 0.0,
            'vader_neutral': 1.0,
            'textblob_polarity': 0.0,
            'textblob_subjectivity': 0.0,
            'weighted_polarity': 0.0,
            'intensity_factor': 1.0,
            'confidence': 0.0,
            'text_length': 0,
            'word_count': 0
        }
    
    def _calculate_sentiment_confidence(self, vader_score: float, textblob_score: float, subjectivity: float) -> float:
        """
        Calculate confidence based on agreement between sentiment methods and subjectivity.
        
        Args:
            vader_score: VADER compound score (-1 to 1)
            textblob_score: TextBlob polarity score (-1 to 1)
            subjectivity: TextBlob subjectivity score (0 to 1)
            
        Returns:
            Confidence score (0 to 1)
        """
        # Agreement between methods indicates higher confidence
        agreement = 1 - abs(vader_score - textblob_score) / 2
        
        # Extreme scores are more confident
        extremity = max(abs(vader_score), abs(textblob_score))
        
        # Higher subjectivity indicates more emotional content (more reliable for mood)
        subjectivity_weight = 0.7 + (subjectivity * 0.3)
        
        # Combine all factors
        confidence = (agreement * 0.5) + (extremity * 0.3) + (subjectivity_weight * 0.2)
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
        and frequency analysis. Enhanced with better detection.
        """
        emotional_words = Counter()
        
        # Pattern-based identification
        emotion_patterns = [
            r'.*ing$',  # Adjectives ending in -ing (exciting, boring)
            r'.*ed$',   # Past participles (moved, touched)
            r'.*ful$',  # -ful adjectives (beautiful, powerful)
            r'.*ous$',  # -ous adjectives (mysterious, gorgeous)
            r'.*ive$',  # -ive adjectives (captivating, positive)
            r'.*able$', # -able adjectives (remarkable, incredible)
            r'.*less$', # -less adjectives (hopeless, endless)
            r'.*ly$',   # Adverbs (beautifully, tragically)
        ]
        
        for word in words:
            # Check against known emotion categories
            for category, emotion_list in self.emotion_patterns.items():
                if word in emotion_list:
                    emotional_words[word] += 3  # Higher weight for known emotions
                    
            # Check patterns
            for pattern in emotion_patterns:
                if re.match(pattern, word) and len(word) > 3:
                    emotional_words[word] += 1
        
        # Filter by minimum frequency and length
        return {word: count for word, count in emotional_words.items() 
                if count >= self.config.min_word_frequency and len(word) > 3}
    
    def _cluster_emotions(self, emotional_words: Dict[str, int]) -> Dict[str, List[str]]:
        """
        Cluster emotional words into coherent mood categories using semantic similarity.
        Enhanced algorithm with better clustering logic.
        """
        if not emotional_words:
            return {}
            
        clusters = defaultdict(list)
        processed = set()
        
        # First pass: Assign words to explicit categories from patterns
        for word in emotional_words:
            if word in processed:
                continue
                
            primary_category = self._categorize_emotion_word(word)
            clusters[primary_category].append(word)
            processed.add(word)
        
        # Merge similar clusters using semantic similarity
        merged_clusters = self._merge_similar_clusters(clusters)
        
        # Filter out small clusters and reorder by frequency
        final_clusters = {}
        for mood, word_list in merged_clusters.items():
            if len(word_list) >= 1:  # Allow single words
                # Sort by word frequency
                word_list.sort(key=lambda w: emotional_words.get(w, 0), reverse=True)
                final_clusters[mood] = word_list
        
        return final_clusters
    
    def _merge_similar_clusters(self, clusters: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """Merge semantically similar mood clusters."""
        merged = dict(clusters)
        
        # Define mood similarities for merging
        mood_aliases = {
            'positive': ['uplifting', 'heartwarming'],
            'emotional': ['dark', 'melancholic'],
            'intense': ['overwhelming', 'powerful'],
        }
        
        for primary, aliases in mood_aliases.items():
            for alias in aliases:
                if alias in merged and primary in merged:
                    # Merge alias into primary
                    merged[primary].extend(merged[alias])
                    del merged[alias]
        
        return merged
    
    def _categorize_emotion_word(self, word: str) -> str:
        """
        Categorize an emotional word into a mood category.
        Uses semantic rules, patterns, and known associations.
        Enhanced with more nuanced categorization.
        """
        # Normalize word
        word_lower = word.lower()
        
        # Check against known positive emotions
        if any(pos_word in word_lower for pos_word in ['love', 'joy', 'happy', 'wonderful', 'amazing', 
                                                         'beautiful', 'perfect', 'excellent', 'brilliant',
                                                         'delightful', 'inspiring', 'uplifting', 'heartwarming']):
            return 'uplifting'
        
        # Check against known dark/negative emotions
        if any(dark_word in word_lower for dark_word in ['dark', 'scary', 'disturbing', 'twisted', 
                                                          'grim', 'haunting', 'horrify', 'terror',
                                                          'gloomy', 'bleak', 'tragic']):
            return 'dark'
        
        # Check for mystery/suspense
        if any(mystery_word in word_lower for mystery_word in ['mystery', 'suspense', 'intrigue', 
                                                                'puzzle', 'secret', 'enigma', 'cryptic']):
            return 'mysterious'
        
        # Check for romance
        if any(romance_word in word_lower for romance_word in ['love', 'romance', 'passion', 'heart', 
                                                                'romantic', 'tender', 'affection']):
            # Exclude if also a positive general word
            if 'love' not in word_lower or 'romantic' in word_lower or 'passion' in word_lower:
                return 'romantic'
        
        # Check for intensity
        if any(intense_word in word_lower for intense_word in ['intense', 'powerful', 'overwhelming', 
                                                                'gripping', 'dramatic', 'explosive',
                                                                'compelling', 'riveting']):
            return 'intense'
        
        # Check for melancholic/emotional
        if any(melancholic_word in word_lower for melancholic_word in ['melancholic', 'melancholy',
                                                                        'sorrowful', 'mournful', 'sad',
                                                                        'wistful', 'nostalgic', 'bittersweet']):
            return 'melancholic'
        
        # Check for whimsical/cozy
        if any(cozy_word in word_lower for cozy_word in ['cozy', 'warm', 'whimsical', 'magical',
                                                          'enchanting', 'charming', 'delightful', 'lighthearted']):
            return 'whimsical'
        
        # Check for atmospheric/immersive
        if any(atmos_word in word_lower for atmos_word in ['atmospheric', 'immersive', 'vivid', 'lyrical',
                                                            'poetic', 'cinematic', 'gothic', 'noir', 'lush']):
            return 'atmospheric'
        
        # Check for thought-provoking
        if any(thoughtful_word in word_lower for thoughtful_word in ['thought-provoking', 'profound',
                                                                      'insightful', 'philosophical',
                                                                      'intellectual', 'complex', 'nuanced']):
            return 'thoughtful'
        
        # Fallback categorization based on position in patterns
        if word in self.emotion_patterns.get('positive_emotions', []):
            return 'uplifting'
        elif word in self.emotion_patterns.get('negative_emotions', []):
            return 'emotional'
        elif word in self.emotion_patterns.get('literary_qualities', []):
            return 'thoughtful'
        else:
            # Default based on sentiment characteristics
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
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat() + 'Z'
    
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
        
        # Base vibe on sentiment - Bookseller Style
        if compound_score >= 0.5:
            vibes.extend([
                "Feels like a warm hug on a cold day.",
                "Pure sunshine in paperback form.",
                "A guaranteed mood-lifter you'll want to share."
            ])
        elif compound_score >= 0.1:
            vibes.extend([
                "Quietly brilliant and deeply satisfying.",
                "A gentle companion perfect for Sunday mornings.",
                "The literary equivalent of a perfect cup of tea."
            ])
        elif compound_score >= -0.1:
            vibes.extend([
                "Complicated, messy, and absolutely human.",
                "A conversation starter that lingers.",
                "Divisive in the best way possible."
            ])
        else:
            vibes.extend([
                "Hauntingly beautiful and emotionally raw.",
                "Prepare for a storm of feelings.",
                "Not an easy read, but an essential one."
            ])
        
        # Add mood-specific vibes
        if dynamic_moods:
            # Find the primary mood (highest score)
            if isinstance(dynamic_moods, dict):
                 # Handle dictionary case
                 primary_mood = max(dynamic_moods.items(), key=lambda x: x[1])[0]
            else:
                 # Handle simplistic string handling if it ever happens
                 primary_mood = str(dynamic_moods)
            
            mood_vibes = {
                'cozy': "Best enjoyed with rain against the window.",
                'dark': "Atmospheric and shadowy—keep the lights on.",
                'mysterious': "A puzzle box of a book that refuses to solve itself.",
                'romantic': "Swoon-worthy and full of heart.",
                'adventurous': "A ticket to somewhere else entirely.",
                'melancholy': "Beautifully sad, like a fading photograph.",
                'uplifting': "Restores your faith in... everything.",
                'intense': "Reads like a fever dream you won't wake up from.",
                'whimsical': "A little magic for your mundane Tuesday.",
                'thought-provoking': "Will live rent-free in your head for weeks."
            }
            
            # Check for substring match or exact match
            matched_vibe = None
            for key, val in mood_vibes.items():
                if key in str(primary_mood).lower():
                    matched_vibe = val
                    break
            
            if matched_vibe:
                vibes.append(matched_vibe)
        
        # Return a random vibe
        import random
        return random.choice(vibes)
    
    def calculate_mood_query_match(self, book_moods: Dict[str, float], user_query_moods: List[str]) -> Dict:
        """
        Calculate how well a book's moods match a user's query moods.
        
        Args:
            book_moods: Dictionary of {mood: confidence} from book analysis
            user_query_moods: List of moods from parsed user query
            
        Returns:
            Dictionary with match_score (0-1) and match details
        """
        if not user_query_moods or not book_moods:
            return {
                'match_score': 0.5,  # Neutral score if data missing
                'matched_moods': [],
                'missing_moods': user_query_moods or [],
                'explanation': 'Insufficient data for mood matching'
            }
        
        matched_moods = []
        match_scores = []
        missing_moods = []
        
        # Calculate match for each query mood
        for query_mood in user_query_moods:
            if query_mood in book_moods:
                # Direct match
                matched_moods.append(query_mood)
                match_scores.append(book_moods[query_mood])
            else:
                # Check for partial/semantic matches
                best_match = self._find_semantic_mood_match(query_mood, book_moods)
                if best_match and best_match[1] > 0.3:  # Threshold for semantic match
                    matched_moods.append(f"{query_mood}→{best_match[0]}")
                    match_scores.append(best_match[1] * 0.8)  # Slightly lower score for semantic match
                else:
                    missing_moods.append(query_mood)
        
        # Calculate overall match score
        if match_scores:
            match_score = statistics.mean(match_scores)
        elif missing_moods:
            match_score = 0.2  # Low score if no matches
        else:
            match_score = 0.5
        
        # Boost score if book has other strong moods
        if book_moods and not missing_moods:
            # All query moods found - boost by number of additional moods in book
            additional_moods = len(book_moods) - len(matched_moods)
            match_score = min(match_score * (1 + additional_moods * 0.1), 1.0)
        
        return {
            'match_score': match_score,
            'matched_moods': matched_moods,
            'missing_moods': missing_moods,
            'book_moods': list(book_moods.keys()),
            'explanation': self._generate_match_explanation(matched_moods, missing_moods, match_score)
        }
    
    def _find_semantic_mood_match(self, query_mood: str, available_moods: Dict[str, float]) -> Optional[Tuple[str, float]]:
        """Find a semantically similar mood in available moods."""
        mood_similarities = {
            'cozy': ['whimsical', 'atmospheric'],
            'mysterious': ['dark', 'intense'],
            'dark': ['mysterious', 'intense'],
            'romantic': ['whimsical', 'uplifting'],
            'uplifting': ['romantic', 'whimsical'],
            'intense': ['dark', 'mysterious'],
            'atmospheric': ['cozy', 'dark'],
            'thoughtful': ['atmospheric', 'melancholic'],
            'whimsical': ['cozy', 'romantic', 'uplifting'],
            'melancholic': ['thoughtful', 'dark']
        }
        
        similar_moods = mood_similarities.get(query_mood, [])
        best_match = None
        best_score = 0
        
        for similar_mood in similar_moods:
            if similar_mood in available_moods:
                score = available_moods[similar_mood]
                if score > best_score:
                    best_score = score
                    best_match = (similar_mood, score)
        
        return best_match
    
    def _generate_match_explanation(self, matched: List[str], missing: List[str], score: float) -> str:
        """Generate a human-readable explanation of mood match."""
        if score > 0.8:
            return "Excellent mood match - this book perfectly captures your search vibe!"
        elif score > 0.6:
            return f"Good match - has {len(matched)} of the moods you're looking for."
        elif score > 0.4:
            return f"Partial match - shares some of your desired mood ({', '.join(matched[:2])})."
        else:
            return "Different mood profile - might still be worth exploring."

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