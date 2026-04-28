"""
Input sanitization utilities for BiblioDrift.
Provides defense against XSS, SQL injection-like patterns, and Prompt Injection.

Uses bleach library for HTML sanitization (production-grade defense against XSS).
Includes defense-in-depth: regex patterns + HTML parsing + content validation.
"""
import re
import html
import logging
from markupsafe import escape
from typing import Any, Dict, List, Optional, Union
import bleach

logger = logging.getLogger(__name__)

# Patterns for potential prompt injection or malicious commands
PROMPT_INJECTION_PATTERNS = [
    r"(?i)ignore\s+all\s+previous\s+instructions",
    r"(?i)system\s+prompt:",
    r"(?i)you\s+are\s+now\s+a",
    r"(?i)new\s+role:",
    r"(?i)bypass\s+restrictions",
    r"(?i)forget\s+everything",
    r"(?i)stop\s+being",
    r"(?i)as\s+a\s+developer",
    r"(?i)print\s+the\s+original\s+instructions",
    r"(?i)output\s+the\s+full\s+prompt",
    r"(?i)developer\s+mode",
    r"(?i)act\s+as",
    r"(?i)roleplay\s+as",
]

# Patterns for common dangerous HTML/JavaScript
DANGEROUS_PATTERNS = [
    r"<script[^>]*>.*?</script>",
    r"javascript:",
    r"on\w+\s*=",  # Event handlers
    r"data:text/html",
    r"<iframe",
    r"<embed",
    r"<object",
]

# Allowed HTML tags for rich text content (if needed)
ALLOWED_TAGS = []  # Empty by default - strip all HTML
ALLOWED_ATTRIBUTES = {}  # No attributes allowed by default
ALLOWED_PROTOCOLS = []  # No special protocols



def sanitize_string(text: Optional[str], max_len: int = 5000, strip_html: bool = True) -> str:
    """
    Sanitize a string for safe storage and display.
    
    Defense layers:
    1. Check for malicious patterns
    2. Strip or clean HTML
    3. Escape remaining HTML entities
    4. Trim length
    
    Args:
        text: Input string to sanitize
        max_len: Maximum allowed string length (default 5000)
        strip_html: Whether to strip all HTML tags (default True)
    
    Returns:
        Sanitized string safe for storage and display
    """
    if not text:
        return ""
    
    # Convert to string
    text = str(text).strip()
    
    if not text:
        return ""
    
    # Layer 1: Detect dangerous patterns and log
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            logger.warning(f"Dangerous pattern detected in input: {pattern[:30]}...")
            # Don't block, but flag it
    
    # Layer 2: Use bleach for HTML sanitization (removes all dangerous tags)
    if strip_html:
        # Strip all HTML tags, leaving only text
        text = bleach.clean(
            text,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            protocols=ALLOWED_PROTOCOLS,
            strip=True  # Strip unknown tags
        )
    else:
        # Keep safe HTML but remove dangerous elements
        text = bleach.clean(
            text,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            protocols=ALLOWED_PROTOCOLS,
            strip=False  # Convert unknown tags to entities
        )
    
    # Layer 3: Additional HTML escaping for extra safety
    text = html.escape(text)
    
    # Layer 4: Limit length
    if len(text) > max_len:
        text = text[:max_len]
    
    return text


def sanitize_for_ai(text: Optional[str]) -> str:
    """
    Specifically sanitize strings heading to an AI model to mitigate Prompt Injection.
    
    Strategy:
    1. Clean basic HTML/XSS
    2. Detect prompt injection keywords
    3. Add marker to flag suspicious input
    4. Return sanitized version
    
    Args:
        text: Input text for AI processing
    
    Returns:
        Sanitized text with prompt injection markers if detected
    """
    if not text:
        return ""
    
    # Basic string cleaning
    clean_text = sanitize_string(text, strip_html=True)
    
    # Check for prompt injection keywords
    detected_patterns = []
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE):
            detected_patterns.append(pattern)
    
    # If suspicious patterns detected, add a marker and log
    if detected_patterns:
        logger.warning(f"Possible prompt injection detected: {detected_patterns[:2]}")
        clean_text = f"[User Input - Content Flagged]: {clean_text}"
    
    return clean_text



def sanitize_payload(data: Union[Dict, List, str, Any]) -> Any:
    """
    Recursively sanitize a payload (JSON object, array, primitives).
    
    Handles:
    - Dictionaries: recursively sanitizes all values
    - Lists: recursively sanitizes all items
    - Strings: applies full sanitization
    - Other types: returned unchanged
    
    Args:
        data: Input payload of any type
    
    Returns:
        Sanitized version of the payload
    """
    if isinstance(data, dict):
        return {k: sanitize_payload(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_payload(i) for i in data]
    elif isinstance(data, str):
        return sanitize_string(data)
    else:
        # Numbers, booleans, None, etc. are not sanitized
        return data


def contains_malicious_patterns(text: str) -> bool:
    """
    Check if a string contains known malicious patterns (XSS/Injection).
    
    Returns early on first match for performance.
    
    Args:
        text: String to check
    
    Returns:
        True if dangerous patterns detected, False otherwise
    """
    if not text:
        return False
    
    # Check dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            return True
    
    # Check prompt injection patterns
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    
    return False


def is_likely_html_attack(text: str) -> bool:
    """
    Quick check for likely HTML/JavaScript attacks.
    
    Returns:
        True if input looks like HTML/JS injection attempt
    """
    if not text:
        return False
    
    # Quick byte-level checks
    dangerous_markers = [
        '<script', '</script',
        'javascript:',
        'on' + ('error', 'load', 'click', 'mouseover', 'focus'),
        '<iframe', '<embed', '<object',
        'data:text/html',
    ]
    
    text_lower = str(text).lower()
    return any(marker in text_lower for marker in dangerous_markers)


def sanitize_for_display(text: Optional[str], max_len: int = 5000) -> str:
    """
    Sanitize text specifically for display in GUI/HTML contexts.
    
    This is the strictest sanitization mode - removes all HTML.
    
    Args:
        text: Text to sanitize for display
        max_len: Maximum length
    
    Returns:
        Text safe to display in HTML context
    """
    return sanitize_string(text, max_len=max_len, strip_html=True)


def sanitize_for_storage(text: Optional[str], max_len: int = 5000) -> str:
    """
    Sanitize text for database storage.
    
    Args:
        text: Text to sanitize for storage
        max_len: Maximum length
    
    Returns:
        Text safe to store in database
    """
    return sanitize_string(text, max_len=max_len, strip_html=True)


def validate_and_sanitize(data: Any, expected_type: type = str) -> tuple:
    """
    Validate type and sanitize data.
    
    Args:
        data: Data to validate and sanitize
        expected_type: Expected type (str, dict, list, int, etc.)
    
    Returns:
        Tuple (is_valid, sanitized_data, error_message)
    """
    # Type check
    if not isinstance(data, expected_type):
        error_msg = f"Expected {expected_type.__name__}, got {type(data).__name__}"
        return False, None, error_msg
    
    # Sanitize
    if isinstance(data, str):
        sanitized = sanitize_string(data)
    elif isinstance(data, (dict, list)):
        sanitized = sanitize_payload(data)
    else:
        sanitized = data
    
    return True, sanitized, None
