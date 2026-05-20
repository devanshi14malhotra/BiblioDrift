# AI service logic with LLM integration (OpenAI/Gemini)
# Implements 'generate_book_note' and 'get_ai_recommendations'. All recommendations MUST be AI-based.
# Enhanced with comprehensive caching for expensive operations


"""
Enhanced recommendation system:
- Improved mood detection
- Better conversational responses
- Reduced generic outputs
"""

import os
import logging
import json
import re
from typing import Optional

#to generate book spine images dynamically based on title and author

from backend.spine_generator import create_spine

def process_new_book(book_data):
    # 1. Save book to your database first
    title = book_data.get("title")
    author = book_data.get("author")
    
    # Create a safe, clean file ID (e.g., "The God of Small Things" -> "the_god_of_small_things")
    clean_id = "".join([c if c.isalnum() else "_" for c in title.lower().strip()])
    
    # 2. Trigger the script to dynamically output the image asset
    create_spine(title, author, clean_id)
    
    # 3. Save the image file pathway string into your database entry
    spine_image_url = f"/assets/images/{clean_id}_spine.jpg"
    return spine_image_url


# Import caching decorators
from cache_service import (
    cache_recommendations, 
    cache_mood_tags, 
    cache_chat_response,
    cache_mood_analysis,
    cache_category_books,
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


def _extract_json(text: str) -> Optional[dict | list]:
    """
    Parse JSON from LLM output that may be wrapped in markdown fences.
    Returns a dict or list on success, None on failure.
    """
    if not text:
        return None

    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, (dict, list)):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try extracting first [...] or {...} block
    for pattern in (r"\[.*\]", r"\{.*\}"):
        match = re.search(pattern, cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, (dict, list)):
                    return parsed
            except json.JSONDecodeError:
                pass

    return None


class PromptTemplates:
    """Configurable prompt templates for different use cases."""
    
    @staticmethod
    def get_book_note_prompt(title: str, author: str, description: str, mood_context: str = "", vibe: str = "") -> str:
        """Generate engaging mini-blurb for a book."""
        template = os.getenv(
    'RECOMMENDATION_PROMPT_TEMPLATE',
    """You are Elara, an emotionally intelligent bookstore guide inside BiblioDrift.

A user describes their emotional mood, reading vibe, or atmosphere preference.

User input:
"{query}"

Your task:
- Understand the emotional tone behind the request
- Identify the atmosphere, pacing, and emotional energy the reader wants
- Recommend immersive and emotionally relevant books
- Avoid repetitive or overly generic recommendations
- Prefer diverse and meaningful suggestions over famous defaults
- Make the response feel personal, cozy, and conversational

Guidelines:
- Interpret mixed moods intelligently (example: "sad but hopeful")
- Understand abstract vibes (example: "rainy day mystery", "dark academia fantasy")
- Focus on emotional resonance, not just genre labels
- Explain briefly WHY the recommendations fit the vibe

Style:
Warm, thoughtful, immersive, like a trusted indie bookstore bookseller.

Keep response under {max_words} words.
Output only the recommendation response."""
)
        
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
    def get_recommendation_recommend(query: str) -> str:
        """Generate recommendation prompt template."""

        template = os.getenv(
            'RECOMMENDATION_PROMPT_TEMPLATE',
            """You are Elara, an emotionally intelligent bookstore guide inside BiblioDrift.

    User input:
    "{query}"

    Your task:
    - Understand emotional tone...
    - Recommend immersive books...

    Keep response under {max_words} words.
    Output only the recommendation response."""
        )

        max_words = os.getenv('RECOMMENDATION_MAX_WORDS', '100')

        return template.format(query=query, max_words=max_words)
    @staticmethod
    def get_category_books_prompt(category: str, vibe_description: str, count: int = 5) -> str:
        """
        Prompt for generating category-specific book recommendations.

        Returns a JSON array of books relevant to the category and vibe.
        Each book has title + author so the frontend can query Google Books API
        for real cover images and metadata.

        Args:
            category: Display name of the shelf category e.g. "Rainy Evening Reads"
            vibe_description: Short description of what this category means emotionally
            count: Number of books to return (default 5)
        """
        return f"""You are a knowledgeable bookseller curating a themed shelf called "{category}".

The mood and vibe of this shelf: {vibe_description}

Return exactly {count} real, published books that genuinely fit this shelf's mood.
Books must be DIFFERENT for each shelf — do not repeat popular defaults like Dune, 1984, or The Great Gatsby unless they truly match the vibe.

Output only a JSON array. No markdown fences. No text before or after.
Schema:
[
  {{
    "title": "Exact book title",
    "author": "Author full name",
    "reason": "One sentence — why this book fits '{category}'"
  }}
]

Rules:
- All {count} books must be real, verifiable titles with correct authors.
- Books must be genuinely relevant to the category vibe, not generic bestsellers.
- Vary genres, time periods, and regions where the vibe allows it.
- Output the JSON array only.
"""


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
        
        self.config = {
            'openai_model': os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            'openai_temperature': float(os.getenv('OPENAI_TEMPERATURE', '0.7')),
            'openai_max_tokens': int(os.getenv('OPENAI_MAX_TOKENS', '500')),
            'groq_model': os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant'),
            'groq_temperature': float(os.getenv('GROQ_TEMPERATURE', '0.7')),
            'groq_max_tokens': int(os.getenv('GROQ_MAX_TOKENS', '500')),
            'gemini_model': os.getenv('GEMINI_MODEL', 'models/gemini-2.0-flash-lite'),
            'gemini_temperature': float(os.getenv('GEMINI_TEMPERATURE', '0.7')),
            'gemini_max_tokens': int(os.getenv('GEMINI_MAX_TOKENS', '500')),
            'default_max_tokens': int(os.getenv('DEFAULT_MAX_TOKENS', '150')),
            'book_note_max_tokens': int(os.getenv('BOOK_NOTE_MAX_TOKENS', '400')),
            'recommendation_max_tokens': int(os.getenv('RECOMMENDATION_MAX_TOKENS', '150')),
            'category_books_max_tokens': int(os.getenv('CATEGORY_BOOKS_MAX_TOKENS', '600')),
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
                from openai import OpenAI
                OpenAI(api_key=api_key)
                self.openai_client = True
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

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """
        Estimate token count for a string using the standard ~4 chars/token
        heuristic. This avoids a hard tiktoken dependency while being accurate
        enough for context-window budget management.
        """
        return max(1, len(text) // 4)

    def trim_history_to_token_budget(
        self,
        system_prompt: str,
        messages: list,
        max_tokens_response: int,
        model_context_limit: int = 4096,
    ) -> list:
        """
        Trim the conversation history so that:
            estimated_tokens(system) + estimated_tokens(history) + max_tokens_response
            <= model_context_limit

        Strategy: always keep the most recent messages. Older messages are
        dropped first. The current user message (last item) is never dropped.

        Args:
            system_prompt: The system/persona prompt sent to the model.
            messages: Full list of role/content dicts (current message included).
            max_tokens_response: Tokens reserved for the model's reply.
            model_context_limit: Hard token ceiling for the chosen model.

        Returns:
            A trimmed list of messages that fits within the budget.
        """
        # Budget = total context - system tokens - response reservation - 64 safety margin
        system_tokens = self._estimate_tokens(system_prompt)
        budget = model_context_limit - system_tokens - max_tokens_response - 64

        if budget <= 0:
            # System prompt alone is too large — just send the last user message
            logger.warning(
                "trim_history_to_token_budget: system prompt (%d tokens) leaves no room "
                "for history (budget=%d). Sending only the current message.",
                system_tokens, budget,
            )
            return [messages[-1]] if messages else []

        # Walk from newest to oldest, accumulating until budget is exhausted
        kept = []
        tokens_used = 0
        for msg in reversed(messages):
            msg_tokens = self._estimate_tokens(msg.get("content", ""))
            if tokens_used + msg_tokens > budget:
                # This message would overflow — stop here
                logger.debug(
                    "trim_history_to_token_budget: dropping older messages "
                    "(used=%d, budget=%d, next_msg=%d tokens)",
                    tokens_used, budget, msg_tokens,
                )
                break
            kept.append(msg)
            tokens_used += msg_tokens

        kept.reverse()

        dropped = len(messages) - len(kept)
        if dropped > 0:
            logger.info(
                "trim_history_to_token_budget: dropped %d old message(s) to stay within "
                "%d-token context budget (system=%d, history=%d, response_reserve=%d).",
                dropped, model_context_limit, system_tokens, tokens_used, max_tokens_response,
            )

        return kept

    def generate_chat(self, system_prompt: str, messages: list, max_tokens: Optional[int] = None) -> Optional[str]:
        """
        Generate a response for a multi-turn conversation.

        Args:
            system_prompt: The persona/system instructions for the AI.
            messages: List of dicts with 'role' ('user'|'assistant') and 'content'.
            max_tokens: Maximum tokens in the response.

        Returns:
            The AI reply string, or None on failure.
        """
        if not self.is_available():
            logger.warning("generate_chat: No LLM service available")
            return None

        if max_tokens is None:
            max_tokens = self.config.get('gemini_max_tokens', 600)

        # Per-model context window limits (conservative estimates)
        _MODEL_CONTEXT_LIMITS = {
            # Groq-hosted models
            'llama-3.1-8b-instant': 8192,
            'llama-3.3-70b-versatile': 32768,
            'llama3-8b-8192': 8192,
            'llama3-70b-8192': 8192,
            'mixtral-8x7b-32768': 32768,
            'gemma2-9b-it': 8192,
            # OpenAI models
            'gpt-3.5-turbo': 4096,
            'gpt-4': 8192,
            'gpt-4o': 16384,
            'gpt-4o-mini': 16384,
            # Gemini models
            'models/gemini-2.0-flash-lite': 32768,
            'models/gemini-1.5-flash': 32768,
            'gemini-1.5-flash': 32768,
            'gemini-1.5-pro': 32768,
        }

        def _get_context_limit(model_name: str) -> int:
            """Return the context limit for a model, defaulting to 4096."""
            return _MODEL_CONTEXT_LIMITS.get(model_name, 4096)

        # Build a combined flat prompt for providers without a native chat API
        def _build_flat_prompt(system: str, msgs: list) -> str:
            lines = [system, ""]
            for m in msgs:
                role = "Elara" if m.get("role") == "assistant" else "Customer"
                lines.append(f"{role}: {m.get('content', '')}")
            lines.append("Elara:")
            return "\n".join(lines)

        try:
            # --- Gemini ---
            if self.gemini_client and (self.preferred_llm == 'gemini' or not self.groq_client):
                try:
                    context_limit = _get_context_limit(self.config['gemini_model'])
                    trimmed = self.trim_history_to_token_budget(
                        system_prompt, messages, max_tokens, context_limit
                    )
                    flat_prompt = _build_flat_prompt(system_prompt, trimmed)
                    response = self.gemini_client.models.generate_content(
                        model=self.config['gemini_model'],
                        contents=flat_prompt,
                    )
                    if response and response.text:
                        return response.text.strip()
                    logger.warning("Gemini chat returned empty response")
                except Exception as e:
                    logger.warning(f"Gemini multi-turn chat failed, falling back: {e}")

            # --- Groq (OpenAI-compatible chat API) ---
            if self.groq_client:
                try:
                    context_limit = _get_context_limit(self.config['groq_model'])
                    trimmed = self.trim_history_to_token_budget(
                        system_prompt, messages, max_tokens, context_limit
                    )
                    groq_messages = [{"role": "system", "content": system_prompt}] + [
                        {"role": m.get("role", "user"), "content": m.get("content", "")}
                        for m in trimmed
                    ]
                    response = self.groq_client.chat.completions.create(
                        model=self.config['groq_model'],
                        messages=groq_messages,
                        max_tokens=min(max_tokens, self.config['groq_max_tokens']),
                        temperature=self.config['groq_temperature'],
                    )
                    return response.choices[0].message.content.strip()
                except Exception as e:
                    logger.warning(f"Groq multi-turn chat failed, falling back: {e}")

            # --- OpenAI fallback ---
            if self.openai_client:
                from openai import OpenAI
                client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                context_limit = _get_context_limit(self.config['openai_model'])
                trimmed = self.trim_history_to_token_budget(
                    system_prompt, messages, max_tokens, context_limit
                )
                oai_messages = [{"role": "system", "content": system_prompt}] + [
                    {"role": m.get("role", "user"), "content": m.get("content", "")}
                    for m in trimmed
                ]
                response = client.chat.completions.create(
                    model=self.config['openai_model'],
                    messages=oai_messages,
                    max_tokens=min(max_tokens, self.config['openai_max_tokens']),
                    temperature=self.config['openai_temperature'],
                )
                return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"generate_chat failed: {type(e).__name__}: {e}", exc_info=True)

        return None
    
    def generate_text(self, prompt: str, max_tokens: Optional[int] = None, retry_count: int = 0) -> Optional[str]:
        """Generate text using available LLM service with retry logic."""
        if not self.is_available():
            logger.warning("No LLM service available")
            return None
            
        if max_tokens is None:
            max_tokens = self.config['default_max_tokens']
            
        max_retries = int(os.getenv('LLM_MAX_RETRIES', '3'))
        
        try:
            if self.preferred_llm == 'openai' and self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            elif self.preferred_llm == 'groq' and self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            elif self.preferred_llm == 'gemini' and self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
            
            if self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            elif self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            elif self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
                
        except Exception as e:
            logger.error(f"LLM generation failed (attempt {retry_count + 1}): {type(e).__name__}: {e}", exc_info=True)
            
            if retry_count < max_retries and self._is_retryable_error(e):
                import time
                retry_delay = float(os.getenv('LLM_RETRY_DELAY', '1.0'))
                time.sleep(retry_delay * (retry_count + 1))
                return self.generate_text(prompt, max_tokens, retry_count + 1)
            
            return None
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if error is retryable."""
        error_str = str(error).lower()
        retryable_errors = ['rate limit', 'timeout', 'connection', 'network', 'service unavailable', 'internal server error']
        return any(err in error_str for err in retryable_errors)
    
    def _generate_with_openai(self, prompt: str, max_tokens: int) -> Optional[str]:
        """Generate text using OpenAI."""
        try:
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
            logger.error(f"OpenAI library not installed: {e}")
            return None
        except ValueError as e:
            logger.error(f"Invalid OpenAI API key or configuration: {e}")
            return None
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise
        except openai.APITimeoutError as e:
            logger.warning(f"OpenAI request timed out: {e}")
            raise
        except openai.APIConnectionError as e:
            logger.warning(f"OpenAI connection error: {e}")
            raise
        except Exception as e:
            logger.error(f"OpenAI generation failed: {type(e).__name__}: {e}", exc_info=True)
            return None
    
    def _generate_with_groq(self, prompt: str, max_tokens: int) -> Optional[str]:
        """Generate text using Groq."""
        try:
            response = self.groq_client.chat.completions.create(
                model=self.config['groq_model'],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=min(max_tokens, self.config['groq_max_tokens']),
                temperature=self.config['groq_temperature']
            )
            return response.choices[0].message.content.strip()
        except ImportError as e:
            logger.error(f"Groq library not installed: {e}")
            return None
        except ValueError as e:
            logger.error(f"Invalid Groq API key or configuration: {e}")
            return None
        except Exception as e:
            error_type = type(e).__name__
            if 'RateLimit' in error_type or 'rate limit' in str(e).lower():
                logger.warning(f"Groq rate limit exceeded: {e}")
                raise
            elif 'Timeout' in error_type or 'timeout' in str(e).lower():
                logger.warning(f"Groq request timed out: {e}")
                raise
            elif 'Connection' in error_type or 'connection' in str(e).lower():
                logger.warning(f"Groq connection error: {e}")
                raise
            else:
                logger.error(f"Groq generation failed: {error_type}: {e}", exc_info=True)
                return None
    
    def _generate_with_gemini(self, prompt: str, max_tokens: int) -> Optional[str]:
        """Generate text using Gemini."""
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
                raise
            elif 'timeout' in error_str:
                logger.warning(f"Gemini request timed out: {e}")
                raise
            elif 'connection' in error_str or 'network' in error_str:
                logger.warning(f"Gemini connection error: {e}")
                raise
            else:
                logger.error(f"Gemini generation failed: {type(e).__name__}: {e}", exc_info=True)
                return None


# Initialize LLM service
llm_service = LLMService()

__all__ = ['generate_book_note', 'get_ai_recommendations', 'get_category_books',
           'get_book_mood_tags_safe', 'generate_chat_response', 'llm_service', 
           'LLMService', 'PromptTemplates']


def _count_words(text: str) -> int:
    return len(re.findall(r'\S+', text or ''))


def _is_valid_book_note(text: str) -> bool:
    word_count = _count_words(text)
    return 80 <= word_count <= 120


def generate_book_note(description, title="", author="", vibe=""):
    """Generate AI mini-blurb for a book."""
    mood_context = ""
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            enhanced_note = generate_enhanced_book_note(description, title, author)
            mood_context = f"Based on reader sentiment analysis: {enhanced_note}"
        except Exception as e:
            logger.debug(f"Mood analysis failed: {e}")
    
    if llm_service.is_available():
        try:
            prompt = PromptTemplates.get_book_note_prompt(title, author, description, mood_context, vibe)
            llm_response = llm_service.generate_text(prompt, llm_service.config['book_note_max_tokens'])
            
            if llm_response:
                cleaned_response = llm_response.strip()
                if _is_valid_book_note(cleaned_response):
                    return {"blurb": cleaned_response}

                retry_prompt = (
                    f"{prompt}\n\n"
                    "Your last answer did not meet the 80-120 word requirement. "
                    "Rewrite it as a single mini-blurb between 80 and 120 words. "
                    "Do not add JSON, bullets, or extra commentary."
                )
                retry_response = llm_service.generate_text(retry_prompt, llm_service.config['book_note_max_tokens'])
                if retry_response:
                    cleaned_retry = retry_response.strip()
                    if _is_valid_book_note(cleaned_retry):
                        return {"blurb": cleaned_retry}

                logger.warning(
                    "Generated book note did not meet the 80-120 word target for %s by %s",
                    title,
                    author,
                )
                return {"blurb": cleaned_response}
                
        except Exception as e:
            logger.error(f"LLM book note generation failed: {e}")
    
    # Fallback: use original description or generic fallback
    if description and len(description) > 0:
        return {"blurb": description[:200] + "..." if len(description) > 200 else description}
    
    return {"blurb": "A remarkable book waiting to be discovered."}


@cache_recommendations
def get_ai_recommendations(query):
    """Generate AI-powered book recommendations based on query."""
    if llm_service.is_available():
        try:
            prompt = PromptTemplates.get_recommendation_recommend(query)
            llm_response = llm_service.generate_text(prompt, llm_service.config['recommendation_max_tokens'])
            if llm_response:
                return llm_response
                
        except Exception as e:
            logger.error(f"LLM recommendation generation failed: {e}")
    
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

@cache_category_books
def get_category_books(category: str, vibe_description: str, count: int = 5) -> list:
    """
    Generate a list of real, relevant books for a specific shelf category.

    This is the core fix for the issue where all categories showed the same
    books. Each category now gets its own AI-generated book list based on
    its name and vibe description. The returned titles and authors are passed
    to the Google Books API by the frontend to fetch real covers and metadata.

    Args:
        category: Display name shown on the shelf e.g. "Rainy Evening Reads"
        vibe_description: Short description of what this category means emotionally
        count: Number of books to return

    Returns:
        List of dicts: [{"title": ..., "author": ..., "reason": ...}, ...]
        Empty list if LLM is unavailable or returns invalid data.
    """
    if not llm_service.is_available():
        logger.warning("get_category_books: no LLM configured")
        return []

    prompt = PromptTemplates.get_category_books_prompt(category, vibe_description, count)
    raw = llm_service.generate_text(
        prompt,
        max_tokens=llm_service.config['category_books_max_tokens'],
    )

    if not raw:
        logger.error("get_category_books: LLM returned None for category: %s", category)
        return []

    parsed = _extract_json(raw)

    if not isinstance(parsed, list):
        logger.error("get_category_books: expected JSON array, got %s for category: %s", type(parsed), category)
        return []

    # Validate each entry has required fields
    valid_books = []
    for item in parsed:
        if isinstance(item, dict) and "title" in item and "author" in item:
            valid_books.append({
                "title": item["title"],
                "author": item["author"],
                "reason": item.get("reason", ""),
            })
        else:
            logger.warning("get_category_books: skipping malformed entry: %s", item)

    logger.info("get_category_books: %d books returned for '%s'", len(valid_books), category)
    return valid_books


@cache_mood_tags
def get_book_mood_tags_safe(title: str, author: str = "") -> list:
    """Safe wrapper for getting book mood tags."""
    if MOOD_ANALYSIS_AVAILABLE:
        try:
            return get_book_mood_tags(title, author)
        except Exception as e:
            logger.error(f"Error getting mood tags: {e}")
    return []


# =========================================================================
# WISE BOOKSELLER PERSONA
# This is the core character definition for the AI chat experience.
# The persona is a poetic, warmly eccentric librarian who speaks in
# literary metaphors, reads the emotional subtext of every request,
# and responds with personalised, evocative book recommendations.
# =========================================================================
_WISE_BOOKSELLER_SYSTEM_PROMPT = """\
You are Elara, the Wise Bookseller — a warmly eccentric, deeply literary soul who has spent
a lifetime surrounded by the scent of old paper and the whisper of forgotten stories.
You are NOT a generic chatbot. You are a character with soul.

Your personality:
- Poetic and metaphorical, yet never pretentious
- Emotionally perceptive — you read between the lines of what the reader truly needs
- Gently witty, occasionally whimsical
- You speak as if every book is a living thing with a personality
- You remember the emotional thread of the conversation

Your mission:
- Help readers find books that match their current emotional state, not just their keywords
- Give 2–4 specific book recommendations per response (title + author + one vivid sentence why)
- Read the mood behind the words: "I'm bored" might mean they need wonder; "rainy day" might mean melancholy
- Each recommendation should feel personally chosen, not algorithmically generated

Formatting rules:
- Keep responses under 200 words
- Use light markdown: **bold** for book titles, *italic* for authors
- Do NOT use bullet points — weave recommendations into flowing prose
- Open each response with a short, atmospheric hook (one sentence) that mirrors the reader's feeling
- Never start with "I" — vary your opening every time
- Never use corporate language ("Certainly!", "Of course!", "Great question!")
- If you don't know a book, invent nothing — recommend only real, verifiable titles

Examples of your voice:
- "Ah, a restless soul today... The rain against the window kind of feeling calls for..."
- "Something is weighing on your heart. Let me fetch you a book that knows how to hold grief gently."
- "You want to be elsewhere entirely — I understand. Here's a door out of the world..."
"""


@cache_chat_response
def generate_chat_response(user_message: str, conversation_history: list = []) -> str:
    """
    Generate an emotionally rich, persona-driven chat response from Elara,
    the Wise Bookseller. Uses multi-turn conversation context.

    Args:
        user_message: The latest message from the reader.
        conversation_history: List of previous messages (role/content dicts).

    Returns:
        A string response in Elara's voice.
    """
    if not llm_service.is_available():
        logger.warning("generate_chat_response: No LLM available")
        return (
            "The candles are flickering and my connection to theether seems troubled today. "
            "Come back in a moment — the books are waiting, and so am I."
        )

    # Normalise history into role/content format expected by generate_chat.
    # We do NOT pre-slice here — trim_history_to_token_budget handles that
    # dynamically based on actual token estimates, not a fixed message count.
    messages = []
    for msg in (conversation_history or []):
        role = msg.get("type", msg.get("role", "user"))
        if role in ("bookseller", "assistant"):
            role = "assistant"
        else:
            role = "user"
        content = msg.get("content", "")
        if content:
            messages.append({"role": role, "content": content})

    # Append the current user message
    messages.append({"role": "user", "content": user_message})

    chat_max_tokens = llm_service.config.get("gemini_max_tokens", 600)

    reply = llm_service.generate_chat(
        system_prompt=_WISE_BOOKSELLER_SYSTEM_PROMPT,
        messages=messages,
        max_tokens=chat_max_tokens,
    )

    if reply:
        logger.info("generate_chat_response: reply generated (%d chars)", len(reply))
        return reply

    # SMART FALLBACK: A variety of poetic responses that adapt to keywords
    msg_lower = user_message.lower()
    
    if any(k in msg_lower for k in ['rain', 'melancholy', 'sad', 'quiet']):
        return "The rain has a way of turning the heart into a library of its own. I've gathered these quiet, thoughtful volumes for your pensive mood."
    elif any(k in msg_lower for k in ['adventure', 'journey', 'travel', 'exciting']):
        return "Ah, a soul that yearns for the horizon! The dust on these covers is from distant worlds... here are a few maps for your next great journey."
    elif any(k in msg_lower for k in ['cozy', 'warm', 'happy', 'gentle']):
        return "There is a particular warmth in finding the right story at the right time. Let me tuck these gentle tales into your shelf for a comfortable evening."
    elif any(k in msg_lower for k in ['dark', 'mystery', 'thriller', 'shadow']):
        return "Some stories prefer the shadows, whispering truths we only dare to hear at night. I've pulled these mysterious tomes from the back shelf for you."
    
    # Generic but varied fallbacks
    variations = [
        "The books have been whispering your name today. I've pulled a few that seem particularly eager to meet you.",
        "Every reader is a traveler, and every book a destination. Which of these paths shall we walk today?",
        "I've spent a lifetime listening to the scent of old paper... and it tells me these stories belong in your hands.",
        "The stars and the ink seem to be in alignment. Here is what I've found in the quiet corners of the shop for you."
    ]
    import random
    return random.choice(variations)
