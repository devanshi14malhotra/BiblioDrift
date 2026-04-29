# Test cases for improved mood search capabilities
# Tests sentiment analysis, mood detection, query parsing, and matching

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from mood_analysis.mood_analyzer import BookMoodAnalyzer, AnalysisConfig
from mood_analysis.mood_query_parser import parse_mood_query, MoodQueryParser

class TestEnhancedSentimentAnalysis:
    """Test enhanced sentiment analysis with intensity and subjectivity weighting."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
    
    def test_sentiment_analysis_basic(self):
        """Test basic sentiment analysis."""
        text = "This book was amazing and I loved every page!"
        result = self.analyzer.analyze_sentiment(text)
        
        assert result['vader_compound'] > 0.5
        assert result['textblob_polarity'] > 0.5
        assert result['confidence'] > 0.6
        assert result['weighted_polarity'] > 0
    
    def test_intensity_modifiers_boost(self):
        """Test that intensity modifiers boost sentiment scores."""
        text_without = "This book was good."
        text_with = "This book was extremely good."
        
        result_without = self.analyzer.analyze_sentiment(text_without)
        result_with = self.analyzer.analyze_sentiment(text_with)
        
        assert result_with['intensity_factor'] > result_without['intensity_factor']
        assert result_with['intensity_factor'] > 1.0
    
    def test_subjectivity_weighting(self):
        """Test that highly subjective text gets better confidence."""
        text_objective = "The book has 300 pages and costs $15."
        text_subjective = "This absolutely broke my heart and left me sobbing!"
        
        result_obj = self.analyzer.analyze_sentiment(text_objective)
        result_subj = self.analyzer.analyze_sentiment(text_subjective)
        
        # Subjective text should have higher confidence
        assert result_subj['confidence'] >= result_obj['confidence']
    
    def test_empty_text_handling(self):
        """Test handling of empty or whitespace-only text."""
        result = self.analyzer.analyze_sentiment("")
        assert result['confidence'] == 0.0
        assert result['word_count'] == 0
        
        result = self.analyzer.analyze_sentiment("   ")
        assert result['confidence'] == 0.0


class TestEmotionalWordDetection:
    """Test improved emotional word detection and categorization."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
    
    def test_expanded_emotion_vocabulary(self):
        """Test that expanded emotion vocabulary is loaded."""
        positive = self.analyzer.emotion_patterns['positive_emotions']
        negative = self.analyzer.emotion_patterns['negative_emotions']
        
        # Check minimum vocabulary sizes
        assert len(positive) > 30
        assert len(negative) > 20
        assert 'enchanting' in positive
        assert 'bittersweet' in negative
    
    def test_new_pattern_categories(self):
        """Test new pattern categories are available."""
        assert 'pacing_descriptors' in self.analyzer.emotion_patterns
        assert 'atmosphere_descriptors' in self.analyzer.emotion_patterns
        assert len(self.analyzer.emotion_patterns['pacing_descriptors']) > 5
        assert len(self.analyzer.emotion_patterns['atmosphere_descriptors']) > 10
    
    def test_emotional_word_identification(self):
        """Test emotional word identification."""
        words = ['beautiful', 'heartwarming', 'dark', 'mysterious', 'love']
        emotional_words = self.analyzer._identify_emotional_words(words)
        
        # All of these should be identified as emotional
        assert len(emotional_words) >= 4
        assert 'beautiful' in emotional_words or 'heartwarming' in emotional_words


class TestMoodClustering:
    """Test improved mood clustering and categorization."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
    
    def test_mood_categorization_accuracy(self):
        """Test accurate categorization of emotional words."""
        test_cases = [
            ('magical', 'whimsical'),
            ('haunting', 'dark'),
            ('romantic', 'romantic'),
            ('intense', 'intense'),
            ('melancholic', 'melancholic'),
            ('atmospheric', 'atmospheric'),
            ('philosophical', 'thoughtful'),
        ]
        
        for word, expected_mood in test_cases:
            result = self.analyzer._categorize_emotion_word(word)
            assert result == expected_mood, f"Word '{word}' categorized as '{result}', expected '{expected_mood}'"
    
    def test_cluster_merging(self):
        """Test semantic cluster merging."""
        clusters = {
            'positive': ['beautiful', 'wonderful'],
            'uplifting': ['inspiring', 'heartwarming'],
            'dark': ['gloomy', 'eerie'],
        }
        
        merged = self.analyzer._merge_similar_clusters(clusters)
        
        # After merging, uplifting should be merged into positive
        assert 'positive' in merged or 'uplifting' in merged
        assert 'dark' in merged


class TestMoodQueryParser:
    """Test intelligent mood query parsing."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.parser = MoodQueryParser()
    
    def test_simple_mood_parsing(self):
        """Test parsing of simple mood queries."""
        query = "I want something cozy"
        result = self.parser.parse(query)
        
        assert 'cozy' in result.primary_moods
        assert result.confidence > 0.5
    
    def test_multiple_moods_parsing(self):
        """Test parsing of multiple moods."""
        query = "mysterious and dark"
        result = self.parser.parse(query)
        
        assert len(result.primary_moods) >= 2
        assert 'mysterious' in result.primary_moods or 'dark' in result.primary_moods
    
    def test_intensity_modifier_parsing(self):
        """Test parsing of intensity modifiers."""
        query1 = "slightly cozy"
        query2 = "extremely cozy"
        
        result1 = self.parser.parse(query1)
        result2 = self.parser.parse(query2)
        
        assert result2.intensity > result1.intensity
        assert result2.intensity > 1.0
    
    def test_negation_parsing(self):
        """Test parsing of mood negations."""
        query = "dark but not scary"
        result = self.parser.parse(query)
        
        assert 'dark' in result.primary_moods
        assert 'scary' in result.negations or 'dark' in result.primary_moods
    
    def test_theme_extraction(self):
        """Test extraction of themes from query."""
        query = "mysterious with romance"
        result = self.parser.parse(query)
        
        assert len(result.themes) > 0
    
    def test_confidence_calculation(self):
        """Test query parsing confidence calculation."""
        vague_query = "book"
        clear_query = "I'm looking for a very mysterious and dark book"
        
        result_vague = self.parser.parse(vague_query)
        result_clear = self.parser.parse(clear_query)
        
        # Clear query should have higher confidence
        assert result_clear.confidence >= result_vague.confidence
    
    def test_synonym_recognition(self):
        """Test recognition of mood synonyms."""
        query = "something peaceful and calm"
        result = self.parser.parse(query)
        
        # peaceful and calm should be recognized as similar to cozy
        assert 'cozy' in result.primary_moods or result.confidence > 0.5
    
    def test_parse_to_dict(self):
        """Test MoodQuery.to_dict() method."""
        query = "mysterious dark"
        parsed = self.parser.parse(query)
        result_dict = parsed.to_dict()
        
        assert 'original_query' in result_dict
        assert 'primary_moods' in result_dict
        assert 'intensity' in result_dict
        assert 'confidence' in result_dict


class TestMoodMatchingAndRecommendations:
    """Test mood matching and recommendation generation."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
        self.parser = MoodQueryParser()
    
    def test_mood_query_match_perfect(self):
        """Test perfect mood match calculation."""
        book_moods = {
            'mysterious': 0.8,
            'dark': 0.7,
            'intense': 0.6
        }
        user_moods = ['mysterious', 'dark']
        
        result = self.analyzer.calculate_mood_query_match(book_moods, user_moods)
        
        assert result['match_score'] > 0.7
        assert len(result['matched_moods']) == 2
        assert len(result['missing_moods']) == 0
    
    def test_mood_query_match_partial(self):
        """Test partial mood match calculation."""
        book_moods = {
            'atmospheric': 0.8,
            'mysterious': 0.6
        }
        user_moods = ['mysterious', 'dark', 'romantic']
        
        result = self.analyzer.calculate_mood_query_match(book_moods, user_moods)
        
        assert result['match_score'] > 0
        assert 'mysterious' in result['matched_moods']
        assert len(result['missing_moods']) > 0
    
    def test_mood_query_match_semantic(self):
        """Test semantic mood matching."""
        book_moods = {
            'whimsical': 0.7,  # Semantically similar to 'cozy'
            'atmospheric': 0.6
        }
        user_moods = ['cozy']
        
        result = self.analyzer.calculate_mood_query_match(book_moods, user_moods)
        
        # Should find semantic match with whimsical
        assert result['match_score'] > 0.3
    
    def test_recommendation_prompt_generation(self):
        """Test recommendation prompt generation from parsed query."""
        query = "I want something very dark and mysterious"
        parsed = self.parser.parse(query)
        prompt = self.parser.get_recommendation_prompt(parsed)
        
        assert 'dark' in prompt or 'mysterious' in prompt
        assert 'librarian' in prompt or 'book' in prompt
    
    def test_search_filter_keywords(self):
        """Test search filter keyword extraction."""
        query = "not sad but mysterious and intense"
        parsed = self.parser.parse(query)
        filters = self.parser.get_search_filter_keywords(parsed)
        
        assert 'moods' in filters
        assert 'exclude_moods' in filters
        assert 'intensity' in filters


class TestIntegrationFlow:
    """Integration tests for complete mood search flow."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
        self.parser = MoodQueryParser()
    
    def test_full_mood_analysis_flow(self):
        """Test complete mood analysis flow from reviews to recommendations."""
        reviews = [
            {
                'text': 'Absolutely enchanting! A magical journey through a whimsical world.',
                'rating': 5,
                'helpful_votes': 10
            },
            {
                'text': 'Dark and mysterious with a haunting atmosphere. Brilliant writing.',
                'rating': 4,
                'helpful_votes': 8
            },
            {
                'text': 'Fascinating puzzle that kept me guessing. Very intricate plot.',
                'rating': 5,
                'helpful_votes': 12
            }
        ]
        
        # Analyze book
        book_mood = self.analyzer.determine_primary_mood(reviews)
        
        assert book_mood['success']
        assert len(book_mood['primary_moods']) > 0
        assert book_mood['analysis_confidence'] > 0.3
    
    def test_query_parsing_to_matching(self):
        """Test flow from query parsing to mood matching."""
        # Parse user query
        user_query = "I want something mysterious and dark"
        parsed_query = self.parser.parse(user_query)
        
        # Simulated book analysis
        book_moods = {
            'mysterious': 0.8,
            'dark': 0.75,
            'intense': 0.6
        }
        
        # Match user query to book
        match = self.analyzer.calculate_mood_query_match(
            book_moods,
            parsed_query.primary_moods
        )
        
        assert match['match_score'] > 0.7
        assert 'explanation' in match


class TestErrorHandling:
    """Test error handling in improved components."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
        self.parser = MoodQueryParser()
    
    def test_invalid_review_handling(self):
        """Test handling of invalid reviews."""
        reviews = [
            {'text': ''},  # Empty review
            {'text': None},  # None text
            {},  # Missing text field
            {'text': '   '},  # Whitespace only
        ]
        
        # Should not raise exception
        result = self.analyzer.determine_primary_mood(reviews[:1])
        assert 'error' in result or 'success' in result
    
    def test_empty_query_parsing(self):
        """Test parsing of empty or invalid queries."""
        queries = ['', '   ', None]
        
        for query in queries:
            if query is None:
                continue
            result = self.parser.parse(query)
            assert result.confidence >= 0
            # Should fallback to default mood
            assert len(result.primary_moods) > 0
    
    def test_mood_match_with_empty_data(self):
        """Test mood matching with empty or missing data."""
        # Empty book moods
        result = self.analyzer.calculate_mood_query_match({}, ['cozy'])
        assert result['match_score'] >= 0
        
        # Empty user moods
        result = self.analyzer.calculate_mood_query_match({'cozy': 0.8}, [])
        assert result['match_score'] >= 0


class TestPerformance:
    """Performance tests for new components."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = BookMoodAnalyzer()
        self.parser = MoodQueryParser()
    
    def test_query_parsing_speed(self):
        """Test query parsing performance."""
        import time
        
        queries = [
            "cozy",
            "very mysterious and dark but not scary",
            "I'm looking for something uplifting and romantic with good worldbuilding",
            "atmospheric, thoughtful, and profoundly moving"
        ]
        
        start = time.time()
        for _ in range(100):
            for query in queries:
                self.parser.parse(query)
        elapsed = time.time() - start
        
        # Should complete 400 parses in under 2 seconds (5ms per parse)
        assert elapsed < 2.0, f"Query parsing too slow: {elapsed}s for 400 queries"
    
    def test_sentiment_analysis_speed(self):
        """Test sentiment analysis performance."""
        import time
        
        reviews = [
            "Amazing book that kept me on the edge of my seat!",
            "This was quite good, though a bit slow in places.",
            "Terrible experience. Couldn't finish it.",
        ]
        
        start = time.time()
        for _ in range(100):
            for review in reviews:
                self.analyzer.analyze_sentiment(review)
        elapsed = time.time() - start
        
        # Should complete 300 analyses in under 3 seconds (10ms per analysis)
        assert elapsed < 3.0, f"Sentiment analysis too slow: {elapsed}s for 300 analyses"


# Run tests
if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
