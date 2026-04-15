# AI service logic with LLM integration (OpenAI/Gemini)
# Implements 'generate_book_note' and 'get_ai_recommendations'. All recommendations MUST be AI-based.
# Enhanced with comprehensive caching for expensive operations

import os
import logging
from typing import Optional

# Import caching decorators
from cache_service import (
    cache_recommendations, 
    cache_mood_tags, 
    cache_chat_response,
    cache_mood_analysis
)

# Setup logging from environment
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Try to import LLM clients
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# Try to import mood analysis
try:
    from mood_analysis.ai_service_enhanced import get_book_mood_tags, generate_enhanced_book_note
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False

# Setup logger
logger = logging.getLogger(__name__)

class PromptTemplates:
    """Configurable prompt templates for different use cases."""
    
    @staticmethod
    def get_book_note_prompt(title: str, author: str, description: str, mood_context: str = "", vibe: str = "") -> str:
        """Generate book note prompt template with vibe support."""
        template = os.getenv('BOOK_NOTE_PROMPT_TEMPLATE', 
            """You are a cozy, knowledgeable bookseller in a quiet shop. A customer is looking for a book recommendation based on their current vibe: "{vibe}".

Book: "{title}" by {author}
Description: {description}
{mood_context}

IMPORTANT: Do NOT use hardcoded lists. Generate a recommendation dynamically based purely on the provided vibe: "{vibe}".

Output a JSON object with the following structure:
{{
  "title": "A compelling book title that matches the vibe",
  "author": "Author name that fits the recommendation", 
  "cover_url": "URL or placeholder for book cover image",
  "bookseller_note": "A warm, 3-4 sentence paragraph describing the reading experience for this specific vibe"
}}

Constraint: Keep the bookseller_note under 50 words and make it feel personal and atmospheric.
Style: Warm, insightful, like a trusted bookseller sharing a hidden gem.""")
        
        max_words = os.getenv('BOOK_NOTE_MAX_WORDS', '30')
        
        return template.format(
            title=title,
            author=author, 
            description=description,
            mood_context=mood_context,
            vibe=vibe,
            max_words=max_words
        )
    
    @staticmethod
    def get_recommendation_prompt(query: str) -> str:
        """Generate recommendation prompt template."""
        template = os.getenv('RECOMMENDATION_PROMPT_TEMPLATE',
            """You are a knowledgeable librarian helping someone find books.
            
User is looking for: "{query}"

Provide book recommendation guidance that captures the mood and feeling they're seeking.
Focus on the emotional experience and atmosphere rather than specific titles.
Keep response under {max_words} words and make it warm and helpful.
Style: Personal, insightful, like talking to a trusted book friend.""")
        
        max_words = os.getenv('RECOMMENDATION_MAX_WORDS', '100')
        
        return template.format(query=query, max_words=max_words)

class LLMService:
    """
    Production-grade LLM service supporting OpenAI, Groq, and Google Gemini.
    All configuration via environment variables.
    """
    
    def __init__(self):
        self.openai_client = None
        self.groq_client = None
        self.gemini_client = None
        self.preferred_llm = os.getenv('PREFERRED_LLM', 'groq').lower()
        
        # Configuration from environment
        self.config = {
            'openai_model': os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            'openai_temperature': float(os.getenv('OPENAI_TEMPERATURE', '0.7')),
            'openai_max_tokens': int(os.getenv('OPENAI_MAX_TOKENS', '150')),
            'groq_model': os.getenv('GROQ_MODEL', 'openai/gpt-oss-20b'),
            'groq_temperature': float(os.getenv('GROQ_TEMPERATURE', '0.7')),
            'groq_max_tokens': int(os.getenv('GROQ_MAX_TOKENS', '150')),
            'gemini_model': os.getenv('GEMINI_MODEL', 'gemini-2.0-flash'),
            'gemini_temperature': float(os.getenv('GEMINI_TEMPERATURE', '0.7')),
            'gemini_max_tokens': int(os.getenv('GEMINI_MAX_TOKENS', '150')),
            'default_max_tokens': int(os.getenv('DEFAULT_MAX_TOKENS', '150')),
            'book_note_max_tokens': int(os.getenv('BOOK_NOTE_MAX_TOKENS', '100')),
            'recommendation_max_tokens': int(os.getenv('RECOMMENDATION_MAX_TOKENS', '150')),
            'test_max_tokens': int(os.getenv('TEST_MAX_TOKENS', '10'))
        }
        
        self._setup_openai()
        self._setup_groq()
        self._setup_gemini()
        
    def _setup_openai(self):
        """Setup OpenAI client if API key available."""
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key and OPENAI_AVAILABLE:
            try:
                # Test if we can create a client
                from openai import OpenAI
                OpenAI(api_key=api_key)  # Test client creation
                self.openai_client = True  # Just mark as available
                logger.info(f"OpenAI client initialized with model: {self.config['openai_model']}")
            except Exception as e:
                logger.error(f"Failed to setup OpenAI: {e}")
    def _setup_groq(self):
        """Setup Groq client if API key available."""
        api_key = os.getenv('GROQ_API_KEY')
        if api_key and GROQ_AVAILABLE:
            try:
                self.groq_client = Groq(api_key=api_key)
                logger.info(f"Groq client initialized with model: {self.config['groq_model']}")
            except Exception as e:
                logger.error(f"Failed to setup Groq: {e}")
                self.groq_client = None
                
    def _setup_gemini(self):
        """Setup Gemini client if API key available."""
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key and GEMINI_AVAILABLE:
            try:
                self.gemini_client = genai.Client(api_key=api_key)
                logger.info(f"Gemini client initialized. configured model: {self.config['gemini_model']}")
            except ImportError as e:
                logger.warning(f"Google GenAI library not installed: {e}. Install with: pip install google-genai")
                self.gemini_client = None
            except ValueError as e:
                logger.error(f"Invalid Gemini API key configuration: {e}")
                self.gemini_client = None
            except Exception as e:
                logger.error(f"Failed to setup Gemini: {e}", exc_info=True)
                self.gemini_client = None
    
    def is_available(self) -> bool:
        """Check if any LLM service is available."""
        return (self.openai_client is not None) or (self.groq_client is not None) or (self.gemini_client is not None)
    
    def generate_text(self, prompt: str, max_tokens: Optional[int] = None, retry_count: int = 0) -> Optional[str]:
        """
        Generate text using available LLM service with retry logic.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate (uses config default if None)
            retry_count: Current retry attempt
            
        Returns:
            Generated text or None if failed
        """
        if not self.is_available():
            return None
            
        if max_tokens is None:
            max_tokens = self.config['default_max_tokens']
            
        max_retries = int(os.getenv('LLM_MAX_RETRIES', '3'))
        
        try:
            # Try preferred LLM first
            if self.preferred_llm == 'openai' and self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            elif self.preferred_llm == 'groq' and self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            elif self.preferred_llm == 'gemini' and self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
            
            # Fallback to any available LLM (priority: Groq > OpenAI > Gemini)
            if self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            elif self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            elif self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
                
        except Exception as e:
            logger.error(f"LLM generation failed (attempt {retry_count + 1}): {type(e).__name__}: {e}", exc_info=True)
            
            # Retry logic for transient errors
            if retry_count < max_retries and self._is_retryable_error(e):
                import time
                retry_delay = float(os.getenv('LLM_RETRY_DELAY', '1.0'))
                time.sleep(retry_delay * (retry_count + 1))  # Exponential backoff
                return self.generate_text(prompt, max_tokens, retry_count + 1)
            
            return None
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if error is retryable (network, rate limit, etc.)."""
        error_str = str(error).lower()
        retryable_errors = [
            'rate limit',
            'timeout',
            'connection',
            'network',
            'service unavailable',
            'internal server error'
        ]
        return any(err in error_str for err in retryable_errors)
    
    def _generate_with_openai(self, prompt: str, max_tokens: int) -> Optional[str]:
        """Generate text using OpenAI."""
        try:
            # Use the new OpenAI client API (v1.0+)
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            
            response = client.chat.completions.create(
                model=self.config['openai_model'],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=min(max_tokens, self.config['openai_max_tokens']),
                temperature=self.config['openai_temperature']
            )
            return response.choices[0].message.content.strip()
        except ImportError as e:
            logger.error(f"OpenAI library not installed: {e}. Install with: pip install openai")
            return None
        except ValueError as e:
            logger.error(f"Invalid OpenAI API key or configuration: {e}")
            return None
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise  # Re-raise for retry handling
        except openai.APITimeoutError as e:
            logger.warning(f"OpenAI request timed out: {e}")
            raise  # Re-raise for retry handling
        except openai.APIConnectionError as e:
            logger.warning(f"OpenAI connection error: {e}")
            raise  # Re-raise for retry handling
        except Exception as e:
            logger.error(f"OpenAI generation failed: {type(e).__name__}: {e}", exc_info=True)
            return None
    
    def _generate_with_groq(self, prompt: str, max_tokens: int) -> Optional[str]:
        """
        Generate text using Groq LLM service.
        
        Args:
            prompt (str): The input text prompt for the model.
            max_tokens (int): Maximum number of tokens to generate.
            
        Returns:
            Optional[str]: The generated text response, or None if generation fails.
        """
        try:
            response = self.groq_client.chat.completions.create(
                model=self.config['groq_model'],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=min(max_tokens, self.config['groq_max_tokens']),
                temperature=self.config['groq_temperature']
            )
            return response.choices[0].message.content.strip()
        except ImportError as e:
            logger.error(f"Groq library not installed: {e}. Install with: pip install groq")
            return None
        except ValueError as e:
            logger.error(f"Invalid Groq API key or configuration: {e}")
            return None
        except Exception as e:
            # Check for specific Groq error types
            error_type = type(e).__name__
            if 'RateLimit' in error_type or 'rate limit' in str(e).lower():
                logger.warning(f"Groq rate limit exceeded: {e}")
                raise  # Re-raise for retry handling
            elif 'Timeout' in error_type or 'timeout' in str(e).lower():
                logger.warning(f"Groq request timed out: {e}")
                raise  # Re-raise for retry handling
            elif 'Connection' in error_type or 'connection' in str(e).lower():
                logger.warning(f"Groq connection error: {e}")
                raise  # Re-raise for retry handling
            else:
                logger.error(f"Groq generation failed: {error_type}: {e}", exc_info=True)
                return None
    
    def _generate_with_gemini(self, prompt: str, max_tokens: int) -> Optional[str]:
        """
        Generate text using Google Gemini LLM service.
        
        Args:
            prompt (str): The input text prompt for the model.
            max_tokens (int): Maximum number of tokens to generate.
            
        Returns:
            Optional[str]: The generated text response, or None if generation fails.
        """
        try:
            from google.genai import types
            response = self.gemini_client.models.generate_content(
                model=self.config['gemini_model'],
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=min(max_tokens, self.config['gemini_max_tokens']),
                    temperature=self.config['gemini_temperature']
                )
            )
            return response.text.strip()
        except ImportError as e:
            logger.error(f"Google GenAI library not installed: {e}")
            return None
        except ValueError as e:
            logger.error(f"Invalid Gemini API key or configuration: {e}")
            return None
        except Exception as e:
            error_str = str(e).lower()
            if 'rate limit' in error_str or 'quota' in error_str:
                logger.warning(f"Gemini rate limit exceeded: {e}")
                raise  # Re-raise for retry handling
            elif 'timeout' in error_str:
                logger.warning(f"Gemini request timed out: {e}")
                raise  # Re-raise for retry handling
            elif 'connection' in error_str or 'network' in error_str:
                logger.warning(f"Gemini connection error: {e}")
                raise  # Re-raise for retry handling
            else:
                logger.error(f"Gemini generation failed: {type(e).__name__}: {e}", exc_info=True)
                return None

# Initialize LLM service
llm_service = LLMService()

# Export for external use
__all__ = ['generate_book_note', 'get_ai_recommendations', 'get_book_mood_tags_safe', 'generate_chat_response', 'llm_service', 'LLMService', 'PromptTemplates']

def generate_book_note(description, title="", author="", vibe=""):
    """
    Generate book note using LLM with vibe-based recommendations.
    
    Args:
        description: Book description
        title: Book title
        author: Book author
        vibe: User's current vibe for recommendation
        
    Returns:
        Generated book recommendation as JSON object or fallback text
    """
    # Try mood analysis first for context
    mood_context = ""
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            enhanced_note = generate_enhanced_book_note(description, title, author)
            mood_context = f"Based on reader sentiment analysis: {enhanced_note}"
        except Exception as e:
            logger.debug(f"Mood analysis failed: {e}")
    
    # Use LLM if available
    if llm_service.is_available():
        try:
            prompt = PromptTemplates.get_book_note_prompt(title, author, description, mood_context, vibe)
            llm_response = llm_service.generate_text(prompt, llm_service.config['book_note_max_tokens'])
            
            if llm_response:
                # Try to parse as JSON first
                try:
                    import json
                    parsed_response = json.loads(llm_response)
                    if isinstance(parsed_response, dict) and all(key in parsed_response for key in ['title', 'author', 'bookseller_note']):
                        logger.info(f"Successfully generated structured recommendation for vibe: {vibe}")
                        return parsed_response
                except (json.JSONDecodeError, TypeError):
                    # Fallback to plain text if JSON parsing fails
                    logger.warning("LLM response was not valid JSON, using as plain text")
                    return {
                        "vibe": llm_response,
                        "title": title or "A Perfect Match",
                        "author": author or "Recommended Author"
                    }
                
        except Exception as e:
            logger.error(f"LLM book note generation failed: {e}")
    
    # Enhanced fallback with mood analysis
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            return generate_enhanced_book_note(description, title, author)
        except Exception as e:
            logger.debug(f"Mood analysis fallback failed: {e}")
    
    # Basic fallback
    if len(description) > 200:
        return {"vibe": "A deep, complex narrative that readers find emotionally resonant."}
    elif len(description) > 100:
        return {"vibe": "A compelling story with layers waiting to be discovered."}
    elif "mystery" in description.lower():
        return {"vibe": "A mysterious tale that will keep you guessing."}
    elif "romance" in description.lower():
        return {"vibe": "A heartwarming story perfect for cozy reading."}
    else:
        return {"vibe": "A delightful read for any quiet moment."}

@cache_recommendations
def get_ai_recommendations(query):
    """
    Generate AI-powered book recommendations based on query.
    
{{ ... }
        query: User's search query or mood
        
    Returns:
        AI-generated recommendation text
    """
    # Use LLM if available
    if llm_service.is_available():
        try:
            prompt = PromptTemplates.get_recommendation_prompt(query)
            llm_response = llm_service.generate_text(prompt, llm_service.config['recommendation_max_tokens'])
            if llm_response:
                return llm_response
                
        except Exception as e:
            logger.error(f"LLM recommendation generation failed: {e}")
    
    # Fallback mood-based mapping
    mood_queries = {
        'cozy': 'comfort reads with warm atmosphere and gentle pacing',
        'dark': 'psychological thrillers with mysterious undertones',
        'romantic': 'love stories with emotional depth and chemistry',
        'mysterious': 'suspenseful tales with intriguing puzzles',
        'uplifting': 'inspiring stories that restore faith in humanity',
        'melancholy': 'literary fiction exploring complex emotions',
        'adventurous': 'epic journeys and thrilling escapades'
    }
    
    query_lower = query.lower()
    for mood, description in mood_queries.items():
        if mood in query_lower:
            return f"For {mood} reads, I'd suggest exploring {description}. These books tend to resonate with readers seeking that particular emotional experience."
    
    return f"Based on your interest in '{query}', I'd recommend exploring books that capture similar themes and emotional resonance."

@cache_mood_tags
def get_book_mood_tags_safe(title: str, author: str = "") -> list:
    """
    Safe wrapper for getting book mood tags.
    
    Args:
        title: Book title
        author: Author name
        
    Returns:
        List of mood tags or empty list if not available
    """
    if MOOD_ANALYSIS_AVAILABLE:
        try:
            return get_book_mood_tags(title, author)
        except Exception as e:
            logger.error(f"Error getting mood tags: {e}")
    
    return []

@cache_chat_response
def generate_chat_response(user_message, conversation_history=[]):
    """
    Generate truly AI-driven chat responses for the bookseller interface.
    Returns generic, non-hardcoded responses that rely on the frontend to provide context.
    
    Args:
        user_message: The user's current message
        conversation_history: Previous conversation messages
        
    Returns:
        String response from the bookseller
    """
    # Use LLM if available for more natural responses
    if llm_service.is_available():
        try:
            prompt = f"You are a knowledgeable, friendly bookseller. A customer says: '{user_message}'. Respond warmly and helpfully in under 50 words."
            llm_response = llm_service.generate_text(prompt, 100)
            if llm_response:
                return llm_response
        except Exception as e:
            logger.error(f"LLM chat response failed: {e}")
    
    # Simple fallback response
    return "I'd be happy to help you find the perfect book! Let me search for some great recommendations based on what you're looking for."