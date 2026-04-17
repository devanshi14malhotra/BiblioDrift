# ai_service.py — fixed
# Changes from original:
#   1. PromptTemplates: chain-of-thought prompts, higher token budgets
#   2. _extract_json(): strips markdown fences before JSON.loads()
#   3. generate_book_note(): uses corrected token budget, cleaner fallback
#   4. get_ai_recommendations(): no hardcoded mood dict — returns service error on LLM failure
#   5. generate_chat_response(): injects conversation_history as proper multi-turn messages

import os
import json
import logging
import re
from typing import Optional

from cache_service import (
    cache_recommendations,
    cache_mood_tags,
    cache_chat_response,
    cache_mood_analysis,
)

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

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

try:
    from mood_analysis.ai_service_enhanced import get_book_mood_tags, generate_enhanced_book_note
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Optional[dict]:
    """
    Parse a JSON object from LLM output that may be wrapped in markdown fences.

    Handles all of these real-world LLM output patterns:
        ```json { ... } ```
        ```{ ... }```
        { ... }         (bare JSON)
        some prose\n{ ... }\nmore prose
    Returns a dict on success, None on failure.
    """
    if not text:
        return None

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()

    # Attempt 1: the whole cleaned string is valid JSON
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Attempt 2: find the first { ... } block in the string
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

class PromptTemplates:
    """
    Prompt templates for every AI call in BiblioDrift.

    Design principles:
    - Chain-of-thought: ask the model to reason first, then output.
    - Constrained output: explicit JSON schema with field-level instructions.
    - Vibe-first: emotional/atmospheric language precedes factual details.
    - Token-aware: each template is calibrated to its token budget.
    """

    @staticmethod
    def get_book_note_prompt(
        title: str,
        author: str,
        description: str,
        mood_context: str = "",
        vibe: str = "cozy discovery",
    ) -> str:
        """
        Build a book-note prompt.

        Token budget: 350–400 tokens output (set BOOK_NOTE_MAX_TOKENS=400).
        Chain-of-thought step keeps the model grounded before it writes JSON.
        """
        mood_line = f"\nReader sentiment context: {mood_context}" if mood_context else ""

        return f"""You are a knowledgeable bookseller in a quiet, warm shop.
A customer describes their current mood as: "{vibe}"

Book details:
  Title: {title}
  Author: {author}
  Description: {description}{mood_line}

Step 1 — Reasoning (internal, do not output):
Identify the emotional core of "{vibe}". What feeling is the reader seeking?
Does this book deliver that feeling? Why or why not?

Step 2 — Output only valid JSON, no markdown fences, matching this schema exactly:
{{
  "title": "{title}",
  "author": "{author}",
  "vibe_match": "one sentence — does this book match the reader's vibe and why",
  "bookseller_note": "2–3 warm sentences describing the reading experience for someone in a '{vibe}' mood. Atmospheric, personal, under 60 words.",
  "mood_tags": ["tag1", "tag2", "tag3"]
}}

Rules:
- bookseller_note must be original prose, not a synopsis.
- mood_tags should be lowercase single-word descriptors (e.g. "melancholy", "hopeful").
- Output only the JSON object. No preamble, no explanation after.
"""

    @staticmethod
    def get_recommendation_prompt(query: str) -> str:
        """
        Build a vibe-based recommendation prompt.

        Token budget: 200 tokens output (set RECOMMENDATION_MAX_TOKENS=200).
        Returns plain text, not JSON — used directly as a chat-style response.
        """
        return f"""You are a thoughtful librarian helping someone find their next book.

The reader is looking for: "{query}"

Respond in 2–3 sentences. Focus on the emotional experience and atmosphere
they are seeking — not on a specific title. Be warm and specific about the
kind of story, pacing, and mood that would satisfy this request.
Do not use bullet points. Do not list book titles. Write as if speaking directly to the reader.
"""

    @staticmethod
    def get_chat_system_prompt() -> str:
        """System prompt for the bookseller chat interface."""
        return (
            "You are a warm, knowledgeable bookseller named Wren working in a cozy independent bookshop. "
            "You speak in a calm, personal tone — never salesy. "
            "You ask one clarifying question at most per reply. "
            "Keep replies under 80 words unless the customer asks for detail. "
            "You never list more than 3 book suggestions at once. "
            "If you do not know a book, say so honestly."
        )


# ---------------------------------------------------------------------------
# LLM service
# ---------------------------------------------------------------------------

class LLMService:
    """
    Multi-provider LLM service: OpenAI, Groq, Gemini.
    All config via environment variables.

    Token budget env vars (with corrected defaults):
        BOOK_NOTE_MAX_TOKENS       = 400   (was 100 — too small for JSON output)
        RECOMMENDATION_MAX_TOKENS  = 200   (was 150 — fine, kept)
        CHAT_MAX_TOKENS            = 150   (unchanged)
        DEFAULT_MAX_TOKENS         = 200
    """

    def __init__(self):
        self.openai_client = None
        self.groq_client = None
        self.gemini_client = None
        self.preferred_llm = os.getenv("PREFERRED_LLM", "groq").lower()

        self.config = {
            "openai_model":     os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            "openai_temperature":  float(os.getenv("OPENAI_TEMPERATURE", "0.7")),
            "openai_max_tokens":   int(os.getenv("OPENAI_MAX_TOKENS", "500")),

            "groq_model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            "groq_temperature":    float(os.getenv("GROQ_TEMPERATURE", "0.7")),
            "groq_max_tokens":     int(os.getenv("GROQ_MAX_TOKENS", "500")),

            "gemini_model":     os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "gemini_temperature":  float(os.getenv("GEMINI_TEMPERATURE", "0.7")),
            "gemini_max_tokens":   int(os.getenv("GEMINI_MAX_TOKENS", "500")),

            # Per-function token budgets (corrected)
            "book_note_max_tokens":     int(os.getenv("BOOK_NOTE_MAX_TOKENS", "400")),
            "recommendation_max_tokens": int(os.getenv("RECOMMENDATION_MAX_TOKENS", "200")),
            "chat_max_tokens":          int(os.getenv("CHAT_MAX_TOKENS", "150")),
            "default_max_tokens":       int(os.getenv("DEFAULT_MAX_TOKENS", "200")),
        }

        self._setup_openai()
        self._setup_groq()
        self._setup_gemini()

    # -- setup --

    def _setup_openai(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and OPENAI_AVAILABLE:
            try:
                from openai import OpenAI
                OpenAI(api_key=api_key)
                self.openai_client = True
                logger.info("OpenAI ready: %s", self.config["openai_model"])
            except Exception as e:
                logger.error("OpenAI setup failed: %s", e)

    def _setup_groq(self):
        api_key = os.getenv("GROQ_API_KEY")
        if api_key and GROQ_AVAILABLE:
            try:
                self.groq_client = Groq(api_key=api_key)
                logger.info("Groq ready: %s", self.config["groq_model"])
            except Exception as e:
                logger.error("Groq setup failed: %s", e)

    def _setup_gemini(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and GEMINI_AVAILABLE:
            try:
                self.gemini_client = genai.Client(api_key=api_key)
                logger.info("Gemini ready: %s", self.config["gemini_model"])
            except Exception as e:
                logger.error("Gemini setup failed: %s", e)

    def is_available(self) -> bool:
        return any([self.openai_client, self.groq_client, self.gemini_client])

    # -- single-turn text generation --

    def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        retry_count: int = 0,
    ) -> Optional[str]:
        if not self.is_available():
            return None
        if max_tokens is None:
            max_tokens = self.config["default_max_tokens"]

        max_retries = int(os.getenv("LLM_MAX_RETRIES", "3"))

        try:
            if self.preferred_llm == "openai" and self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            if self.preferred_llm == "groq" and self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            if self.preferred_llm == "gemini" and self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
            # Fallback priority: Groq → OpenAI → Gemini
            if self.groq_client:
                return self._generate_with_groq(prompt, max_tokens)
            if self.openai_client:
                return self._generate_with_openai(prompt, max_tokens)
            if self.gemini_client:
                return self._generate_with_gemini(prompt, max_tokens)
        except Exception as e:
            logger.error("LLM attempt %d failed: %s: %s", retry_count + 1, type(e).__name__, e)
            if retry_count < max_retries and self._is_retryable(e):
                import time
                time.sleep(float(os.getenv("LLM_RETRY_DELAY", "1.0")) * (retry_count + 1))
                return self.generate_text(prompt, max_tokens, retry_count + 1)
        return None

    # -- multi-turn chat (NEW) --

    def generate_chat(
        self,
        system_prompt: str,
        messages: list[dict],
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Generate a response in a multi-turn conversation.

        Args:
            system_prompt: The bookseller persona / instructions.
            messages: List of {"role": "user"|"assistant", "content": str} dicts,
                      ordered oldest-first. The last message is the user's current turn.
            max_tokens: Token budget for the response.

        Returns:
            Assistant reply string, or None on failure.
        """
        if not self.is_available():
            return None
        if max_tokens is None:
            max_tokens = self.config["chat_max_tokens"]

        try:
            if self.preferred_llm == "groq" and self.groq_client:
                return self._chat_with_groq(system_prompt, messages, max_tokens)
            if self.preferred_llm == "openai" and self.openai_client:
                return self._chat_with_openai(system_prompt, messages, max_tokens)
            if self.preferred_llm == "gemini" and self.gemini_client:
                return self._chat_with_gemini(system_prompt, messages, max_tokens)
            if self.groq_client:
                return self._chat_with_groq(system_prompt, messages, max_tokens)
            if self.openai_client:
                return self._chat_with_openai(system_prompt, messages, max_tokens)
            if self.gemini_client:
                return self._chat_with_gemini(system_prompt, messages, max_tokens)
        except Exception as e:
            logger.error("Multi-turn chat failed: %s: %s", type(e).__name__, e)
        return None

    # -- provider implementations (single-turn) --

    def _generate_with_openai(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            resp = client.chat.completions.create(
                model=self.config["openai_model"],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=min(max_tokens, self.config["openai_max_tokens"]),
                temperature=self.config["openai_temperature"],
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error("OpenAI single-turn failed: %s", e)
            if self._is_retryable(e):
                raise
            return None

    def _generate_with_groq(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            resp = self.groq_client.chat.completions.create(
                model=self.config["groq_model"],
                messages=[{"role": "user", "content": prompt}],
                max_tokens=min(max_tokens, self.config["groq_max_tokens"]),
                temperature=self.config["groq_temperature"],
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error("Groq single-turn failed: %s", e)
            if self._is_retryable(e):
                raise
            return None

    def _generate_with_gemini(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            resp = self.gemini_client.models.generate_content(
                model=self.config["gemini_model"],
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=min(max_tokens, self.config["gemini_max_tokens"]),
                    temperature=self.config["gemini_temperature"],
                ),
            )
            return resp.text.strip()
        except Exception as e:
            logger.error("Gemini single-turn failed: %s", e)
            if self._is_retryable(e):
                raise
            return None

    # -- provider implementations (multi-turn) --

    def _chat_with_openai(
        self, system_prompt: str, messages: list[dict], max_tokens: int
    ) -> Optional[str]:
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        payload = [{"role": "system", "content": system_prompt}] + messages
        resp = client.chat.completions.create(
            model=self.config["openai_model"],
            messages=payload,
            max_tokens=min(max_tokens, self.config["openai_max_tokens"]),
            temperature=self.config["openai_temperature"],
        )
        return resp.choices[0].message.content.strip()

    def _chat_with_groq(
        self, system_prompt: str, messages: list[dict], max_tokens: int
    ) -> Optional[str]:
        payload = [{"role": "system", "content": system_prompt}] + messages
        resp = self.groq_client.chat.completions.create(
            model=self.config["groq_model"],
            messages=payload,
            max_tokens=min(max_tokens, self.config["groq_max_tokens"]),
            temperature=self.config["groq_temperature"],
        )
        return resp.choices[0].message.content.strip()

    def _chat_with_gemini(
        self, system_prompt: str, messages: list[dict], max_tokens: int
    ) -> Optional[str]:
        # Gemini doesn't have a native system role in all versions —
        # prepend it as the first user turn with a clear separator.
        gemini_messages = [
            {"role": "user", "parts": [{"text": f"[System instructions]\n{system_prompt}\n[End instructions]"}]},
            {"role": "model", "parts": [{"text": "Understood. I am Wren, your bookseller."}]},
        ]
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({"role": role, "parts": [{"text": msg["content"]}]})
        resp = self.gemini_client.models.generate_content(
            model=self.config["gemini_model"],
            contents=gemini_messages,
            config=types.GenerateContentConfig(
                max_output_tokens=min(max_tokens, self.config["gemini_max_tokens"]),
                temperature=self.config["gemini_temperature"],
            ),
        )
        return resp.text.strip()

    # -- helpers --

    def _is_retryable(self, error: Exception) -> bool:
        keywords = ["rate limit", "timeout", "connection", "network", "service unavailable"]
        return any(k in str(error).lower() for k in keywords)


# Singleton
llm_service = LLMService()

__all__ = [
    "generate_book_note",
    "get_ai_recommendations",
    "get_book_mood_tags_safe",
    "generate_chat_response",
    "llm_service",
    "LLMService",
    "PromptTemplates",
]


# ---------------------------------------------------------------------------
# Public API functions
# ---------------------------------------------------------------------------

@cache_recommendations
def generate_book_note(description, title="", author="", vibe=""):
    """
    Generate an AI-powered bookseller note for a book.

    Returns a dict with keys: title, author, vibe_match, bookseller_note, mood_tags.
    Falls back to a minimal dict if LLM is unavailable — never returns hardcoded text.

    Fix summary:
    - Token budget raised to BOOK_NOTE_MAX_TOKENS (default 400) so JSON is never truncated.
    - _extract_json() handles markdown fences before JSON.loads().
    - Chain-of-thought prompt improves vibe alignment.
    """
    mood_context = ""
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            enhanced = generate_enhanced_book_note(description, title, author)
            mood_context = str(enhanced)
        except Exception as e:
            logger.debug("Mood analysis context failed: %s", e)

    if llm_service.is_available():
        prompt = PromptTemplates.get_book_note_prompt(
            title, author, description, mood_context, vibe
        )
        raw = llm_service.generate_text(
            prompt,
            max_tokens=llm_service.config["book_note_max_tokens"],
        )
        if raw:
            parsed = _extract_json(raw)
            if parsed and "bookseller_note" in parsed:
                logger.info("Structured bookseller note generated for: %s", title)
                return parsed
            # LLM responded but not valid JSON — wrap as plain vibe note
            logger.warning("LLM response was not valid JSON; wrapping as vibe note")
            return {
                "title": title,
                "author": author,
                "bookseller_note": raw,
                "mood_tags": [],
                "vibe_match": "",
            }

    # Mood-analysis fallback (no LLM)
    if MOOD_ANALYSIS_AVAILABLE and title and author:
        try:
            return generate_enhanced_book_note(description, title, author)
        except Exception as e:
            logger.debug("Mood analysis fallback failed: %s", e)

    # Minimal honest fallback — not fake AI text
    return {
        "title": title,
        "author": author,
        "bookseller_note": None,
        "mood_tags": [],
        "vibe_match": None,
        "error": "AI service unavailable",
    }


@cache_recommendations
def get_ai_recommendations(query: str) -> Optional[str]:
    """
    Generate vibe-based book recommendation guidance via LLM.

    Fix summary:
    - Removed hardcoded mood keyword dict — it violated the AI-only policy.
    - On LLM failure, returns None (caller handles the error response).
    - Prompt restructured to produce atmospheric guidance, not a list of titles.
    """
    if llm_service.is_available():
        prompt = PromptTemplates.get_recommendation_prompt(query)
        result = llm_service.generate_text(
            prompt,
            max_tokens=llm_service.config["recommendation_max_tokens"],
        )
        if result:
            return result
        logger.error("LLM recommendation call returned None for query: %s", query)
    else:
        logger.warning("get_ai_recommendations called but no LLM is configured")

    # Return None — app.py will surface a 503 via service_unavailable_error()
    # Never return hardcoded static strings here (violates AI-only policy).
    return None


@cache_mood_tags
def get_book_mood_tags_safe(title: str, author: str = "") -> list:
    """Safe wrapper for mood tag extraction."""
    if MOOD_ANALYSIS_AVAILABLE:
        try:
            return get_book_mood_tags(title, author)
        except Exception as e:
            logger.error("Mood tag extraction failed: %s", e)
    return []


@cache_chat_response
def generate_chat_response(
    user_message: str,
    conversation_history: list = None,
) -> str:
    """
    Generate a bookseller chat reply using a proper multi-turn conversation.

    Fix summary:
    - conversation_history is now passed as structured messages to the LLM,
      not flattened into a single-turn prompt string.
    - Uses llm_service.generate_chat() which sends the full history array.
    - Graceful fallback message is returned when LLM is unavailable.

    Args:
        user_message: The user's latest message.
        conversation_history: List of {"role": ..., "content": ...} dicts,
                              oldest-first, NOT including the current user_message.

    Returns:
        Bookseller reply string.
    """
    if conversation_history is None:
        conversation_history = []

    # Normalise history — accept both Pydantic models and plain dicts
    normalised_history = []
    for msg in conversation_history:
        if hasattr(msg, "dict"):
            msg = msg.dict()
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            normalised_history.append({"role": role, "content": content})

    # Append the current user turn
    messages = normalised_history + [{"role": "user", "content": user_message}]

    system_prompt = PromptTemplates.get_chat_system_prompt()

    if llm_service.is_available():
        reply = llm_service.generate_chat(
            system_prompt=system_prompt,
            messages=messages,
            max_tokens=llm_service.config["chat_max_tokens"],
        )
        if reply:
            return reply
        logger.error("Multi-turn chat returned None for message: %s", user_message[:60])

    # Honest fallback — does not pretend to be AI output
    return (
        "I'm having a bit of trouble connecting right now. "
        "Try me again in a moment — I'd love to help you find something wonderful to read."
    )