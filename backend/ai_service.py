# AI service logic with LLM integration (OpenAI/Gemini)
# Implements 'generate_book_note' and 'get_ai_recommendations'. All recommendations MUST be AI-based.
# Enhanced with comprehensive caching for expensive operations

import os
import logging
import json
import re
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

        # Build a combined prompt for providers that don't have native chat API
        def _build_flat_prompt(system: str, msgs: list) -> str:
            lines = [system, ""]
            for m in msgs:
                role = "You" if m.get("role") == "assistant" else "Customer"
                lines.append(f"{role}: {m.get('content', '')}")            
            lines.append("You:")
            return "\n".join(lines)

        try:
            # --- Gemini (preferred for persona chat) ---
            if self.gemini_client and (self.preferred_llm == 'gemini' or not self.groq_client):
                try:
                    # Universal AI Mode: Simplest possible call
                    response = self.gemini_client.models.generate_content(
                        model=self.config['gemini_model'],
                        contents=f"{system_prompt}\n\nCustomer: {user_message}\nElara:"
                    )
                    if response and response.text:
                        return response.text.strip()
                    if response and response.text:
                        return response.text.strip()
                    else:
                        print(f"[DIAGNOSTIC] Gemini response empty. Status: {getattr(response, 'status', 'unknown')}")
                except Exception as e:
                    print(f"[DIAGNOSTIC] Gemini chat failed: {type(e).__name__} - {str(e)}")
                    logger.warning(f"Gemini multi-turn chat failed, falling back: {e}")

            # --- Groq (OpenAI-compatible chat API) ---
            if self.groq_client:
                try:
                    groq_messages = [{"role": "system", "content": system_prompt}] + [
                        {"role": m.get("role", "user"), "content": m.get("content", "")}
                        for m in messages
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
                oai_messages = [{"role": "system", "content": system_prompt}] + [
                    {"role": m.get("role", "user"), "content": m.get("content", "")}
                    for m in messages
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


def generate_book_note(description, title="", author="", vibe=""):
    """Generate book note using LLM with vibe-based recommendations."""
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
                try:
                    import json
                    parsed_response = json.loads(llm_response)
                    if isinstance(parsed_response, dict) and all(key in parsed_response for key in ['title', 'author', 'bookseller_note']):
                        logger.info(f"Successfully generated structured recommendation for vibe: {vibe}")
                        return parsed_response
                except (json.JSONDecodeError, TypeError):
                    logger.warning("LLM response was not valid JSON, using as plain text")
                    return {
                        "vibe": llm_response,
                        "title": title or "A Perfect Match",
                        "author": author or "Recommended Author"
                    }
                
        except Exception as e:
            logger.error(f"LLM book note generation failed: {e}")
    
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            return generate_enhanced_book_note(description, title, author)
        except Exception as e:
            logger.debug(f"Mood analysis fallback failed: {e}")
    
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
    """Generate AI-powered book recommendations based on query."""
    if llm_service.is_available():
        try:
            prompt = PromptTemplates.get_recommendation_prompt(query)
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

    # Build conversation messages for the LLM
    # We keep only the last 8 exchanges to stay within token limits
    recent_history = conversation_history[-8:] if conversation_history else []

    # Normalise history into role/content format
    messages = []
    for msg in recent_history:
        role = msg.get("type", msg.get("role", "user"))
        # Map chat UI types to LLM roles
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
