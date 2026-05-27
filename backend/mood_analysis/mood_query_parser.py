# Advanced mood query parser for improved mood/vibe search
# Parses user mood queries and maps them to precise mood categories

import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import logging

@dataclass
class MoodQuery:
    """Parsed mood query with normalized components."""
    original_query: str
    primary_moods: List[str]  # e.g., ['cozy', 'mysterious']
    intensity: float  # 0-2, where values >1 indicate intensified mood
    negations: List[str]  # Moods to exclude, e.g., ['violent', 'sad']
    themes: List[str]  # Literary themes, e.g., ['romance', 'adventure', 'mystery']
    confidence: float  # 0-1, how well we understood the query
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses."""
        return {
            'original_query': self.original_query,
            'primary_moods': self.primary_moods,
            'intensity': self.intensity,
            'negations': self.negations,
            'themes': self.themes,
            'confidence': self.confidence
        }


class MoodQueryParser:
    """Parse and normalize mood queries for accurate book search."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._setup_mood_mappings()
        
    def _setup_mood_mappings(self):
        """Setup comprehensive mood keyword mappings."""
        
        # Primary mood categories and their variations
        self.mood_variations = {
            'cozy': {
                'keywords': ['cozy', 'warm', 'comfy', 'comfortable', 'snug', 'homey', 'intimate', 'gentle'],
                'intensity': 0.4,
                'theme_boost': ['comfort', 'slice of life', 'domestic']
            },
            'mysterious': {
                'keywords': ['mysterious', 'mystery', 'enigmatic', 'cryptic', 'puzzling', 'secretive', 'unknown'],
                'intensity': 0.6,
                'theme_boost': ['suspense', 'secrets', 'puzzle']
            },
            'dark': {
                'keywords': ['dark', 'gloomy', 'gothic', 'noir', 'bleak', 'grim', 'sinister', 'eerie'],
                'intensity': 0.7,
                'theme_boost': ['psychological', 'horror', 'tragedy']
            },
            'romantic': {
                'keywords': ['romantic', 'romance', 'love', 'passionate', 'tender', 'heartfelt', 'emotional'],
                'intensity': 0.6,
                'theme_boost': ['love', 'relationships', 'passion']
            },
            'uplifting': {
                'keywords': ['uplifting', 'inspiring', 'hopeful', 'positive', 'joyful', 'heartwarming', 'feel-good'],
                'intensity': 0.5,
                'theme_boost': ['hope', 'redemption', 'growth']
            },
            'intense': {
                'keywords': ['intense', 'gripping', 'thrilling', 'fast-paced', 'explosive', 'powerful', 'riveting'],
                'intensity': 0.8,
                'theme_boost': ['action', 'conflict', 'tension']
            },
            'atmospheric': {
                'keywords': ['atmospheric', 'immersive', 'vivid', 'cinematic', 'lyrical', 'poetic', 'lush'],
                'intensity': 0.5,
                'theme_boost': ['worldbuilding', 'setting', 'ambiance']
            },
            'thoughtful': {
                'keywords': ['thoughtful', 'profound', 'philosophical', 'intellectual', 'complex', 'nuanced', 'introspective'],
                'intensity': 0.5,
                'theme_boost': ['philosophy', 'society', 'meaning']
            },
            'whimsical': {
                'keywords': ['whimsical', 'magical', 'enchanting', 'fantastical', 'quirky', 'playful', 'lighthearted'],
                'intensity': 0.4,
                'theme_boost': ['fantasy', 'magic', 'wonder']
            },
            'melancholic': {
                'keywords': ['melancholic', 'melancholy', 'wistful', 'nostalgic', 'bittersweet', 'mournful', 'sorrowful'],
                'intensity': 0.6,
                'theme_boost': ['loss', 'memory', 'longing']
            }
        }
        
        # Intensity modifiers
        self.intensity_modifiers = {
            'very': 1.2,
            'extremely': 1.4,
            'incredibly': 1.4,
            'absolutely': 1.3,
            'deeply': 1.2,
            'profoundly': 1.2,
            'slightly': 0.7,
            'somewhat': 0.8,
            'a bit': 0.7,
            'kinda': 0.7,
        }
        
        # Negation words
        self.negation_words = [
            'not', 'no', 'without', 'avoiding', 'avoid', 'exclude', 'except',
            'never', 'nothing', 'no way', 'definitely not', 'anything but'
        ]
        
        # Mood synonyms and close variations
        self.mood_synonyms = {
            'peaceful': 'cozy',
            'relaxing': 'cozy',
            'calm': 'cozy',
            'quiet': 'cozy',
            'suspenseful': 'mysterious',
            'thriller': 'mysterious',
            'scary': 'dark',
            'frightening': 'dark',
            'terrifying': 'dark',
            'happy': 'uplifting',
            'cheerful': 'uplifting',
            'amusing': 'whimsical',
            'funny': 'whimsical',
            'sad': 'melancholic',
            'moody': 'melancholic',
        }
    
    def parse(self, query: str) -> MoodQuery:
        """
        Parse a mood query and extract components.
        
        Args:
            query: User's mood search query
            
        Returns:
            MoodQuery object with parsed components
        """
        query_lower = query.lower().strip()
        
        # Initialize result
        primary_moods = []
        intensity = 1.0
        negations = []
        themes = []
        confidence = 0.5
        
        try:
            # Extract negations
            negations, query_without_negations = self._extract_negations(query_lower)
            
            # Extract intensity modifiers and adjust intensity
            intensity = self._extract_intensity(query_without_negations)
            
            # Extract primary moods
            primary_moods, themes = self._extract_moods(query_without_negations)
            
            # Calculate confidence based on how well we parsed the query
            confidence = self._calculate_confidence(primary_moods, query_without_negations)
            
            self.logger.debug(f"Parsed mood query: {query} -> moods={primary_moods}, intensity={intensity}, confidence={confidence}")
            
        except Exception as e:
            self.logger.warning(f"Error parsing mood query '{query}': {e}")
            confidence = 0.1  # Low confidence for failed parses
        
        return MoodQuery(
            original_query=query,
            primary_moods=primary_moods or ['atmospheric'],  # Fallback mood
            intensity=min(intensity, 2.0),  # Allow intensity up to 2.0 to reflect modifiers
            negations=negations,
            themes=themes,
            confidence=confidence
        )
    
    def _extract_negations(self, query: str) -> Tuple[List[str], str]:
        """Extract negated moods from query."""
        negations = []
        query_without_negations = query
        
        # Find negation patterns: "not cozy", "without dark", etc.
        for negation_word in self.negation_words:
            pattern = rf'\b{re.escape(negation_word)}\s+(\w+)'
            matches = re.finditer(pattern, query)
            
            for match in matches:
                negated_term = match.group(1)
                
                # Check if it's a valid mood
                if negated_term in self.mood_variations or negated_term in self.mood_synonyms:
                    normalized = self.mood_synonyms.get(negated_term, negated_term)
                    if normalized in self.mood_variations:
                        negations.append(normalized)
                        # Remove from query
                        query_without_negations = re.sub(
                            rf'\b{re.escape(negation_word)}\s+{re.escape(negated_term)}\b',
                            '',
                            query_without_negations
                        )
        
        return negations, query_without_negations.strip()
    
    def _extract_intensity(self, query: str) -> float:
        """Extract intensity modifiers from query."""
        intensity = 1.0
        
        for modifier, multiplier in self.intensity_modifiers.items():
            if modifier in query:
                intensity *= multiplier
        
        return intensity
    
    def _extract_moods(self, query: str) -> Tuple[List[str], List[str]]:
        """Extract mood and theme keywords from query."""
        moods = []
        themes = set()
        
        # Check for direct mood matches
        for mood, mood_data in self.mood_variations.items():
            for keyword in mood_data['keywords']:
                if keyword in query:
                    moods.append(mood)
                    # Add associated themes
                    for theme in mood_data.get('theme_boost', []):
                        themes.add(theme)
                    break  # Don't count same mood twice
        
        # Check for synonyms
        for synonym, normalized_mood in self.mood_synonyms.items():
            if synonym in query and normalized_mood not in moods:
                moods.append(normalized_mood)
                mood_data = self.mood_variations[normalized_mood]
                for theme in mood_data.get('theme_boost', []):
                    themes.add(theme)
        
        # Remove duplicates while preserving order
        unique_moods = []
        seen = set()
        for mood in moods:
            if mood not in seen:
                unique_moods.append(mood)
                seen.add(mood)
        
        return unique_moods, list(themes)
    
    def _calculate_confidence(self, moods: List[str], query: str) -> float:
        """Calculate confidence in the mood parse."""
        base_confidence = 0.5
        
        # More moods identified = higher confidence
        if len(moods) >= 2:
            base_confidence += 0.2
        elif len(moods) == 1:
            base_confidence += 0.1
        
        # Query length affects confidence (longer queries might be more specific)
        word_count = len(query.split())
        if word_count > 5:
            base_confidence += 0.1
        
        # Check for explicit mood phrases (high confidence)
        if any(phrase in query for phrase in ['looking for', 'searching for', 'want', 'need', 'i like', 'i love']):
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    def get_recommendation_prompt(self, parsed_query: MoodQuery) -> str:
        """
        Generate an enhanced recommendation prompt based on parsed query.
        
        Args:
            parsed_query: Parsed mood query
            
        Returns:
            Enhanced prompt for LLM
        """
        moods_str = ', '.join(parsed_query.primary_moods)
        intensity_str = 'intense' if parsed_query.intensity > 0.7 else 'moderate' if parsed_query.intensity > 0.4 else 'subtle'
        
        negation_str = ''
        if parsed_query.negations:
            negation_str = f"\n\nImportant: Exclude books with these qualities: {', '.join(parsed_query.negations)}"
        
        prompt = f"""You are a knowledgeable librarian helping someone find books.

The reader is looking for: {parsed_query.original_query}

Based on this request, they want a {intensity_str} reading experience with these moods: {moods_str}

{negation_str}

Provide a brief, personalized book recommendation that captures:
1. The emotional atmosphere they're seeking
2. Why this mood combination works well together
3. What kind of reading experience to expect

Keep your response to 2-3 sentences. Be warm and enthusiastic.
Style: Like a trusted book friend giving a perfect recommendation."""
        
        return prompt
    
    def get_search_filter_keywords(self, parsed_query: MoodQuery) -> Dict[str, List[str]]:
        """
        Generate search filter keywords based on parsed query for database/API filtering.
        
        Args:
            parsed_query: Parsed mood query
            
        Returns:
            Dictionary with filter keywords
        """
        return {
            'moods': parsed_query.primary_moods,
            'exclude_moods': parsed_query.negations,
            'themes': parsed_query.themes,
            'intensity': 'high' if parsed_query.intensity > 0.7 else 'medium' if parsed_query.intensity > 0.4 else 'low'
        }


# Singleton instance
mood_parser = MoodQueryParser()


def parse_mood_query(query: str) -> MoodQuery:
    """Convenience function to parse a mood query."""
    return mood_parser.parse(query)


def get_recommendation_prompt(query: str) -> str:
    """Convenience function to get recommendation prompt from query."""
    parsed = mood_parser.parse(query)
    return mood_parser.get_recommendation_prompt(parsed)
