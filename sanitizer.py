"""
Input sanitization utilities for BiblioDrift.
Provides defense against XSS, SQL injection-like patterns, and Prompt Injection.
"""
import re
import html
from markupsafe import escape
from typing import Any, Dict, List, Optional, Union

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
]

# Patterns for common XSS/Injection attempts
XSS_PATTERNS = [
    r"<script.*?>.*?</script>",
    r"on\w+\s*=",
    r"javascript:",
    r"alert\(",
    r"<iframe.*?>",
]

def sanitize_string(text: Optional[str], max_len: int = 5000) -> str:
    """
    Sanitize a string for safe storage and display.
    - Strips whitespace
    - Escapes HTML special characters
    - Limits length
    """
    if not text:
        return ""
    
    # 1. Clean whitespace
    text = text.strip()
    
    # 2. Limit length
    if len(text) > max_len:
        text = text[:max_len]
    
    # 3. Escape HTML characters (prevents XSS)
    # markupsafe.escape handles <, >, &, ", '
    sanitized = str(escape(text))
    
    return sanitized

def sanitize_for_ai(text: Optional[str]) -> str:
    """
    Specifically sanitize strings heading to an AI model to mitigate Prompt Injection.
    """
    if not text:
        return ""
    
    # Basic string cleaning
    clean_text = sanitize_string(text)
    
    # Check for prompt injection keywords and neutralize them slightly
    # Instead of blocking, we can wrap or modify if detected
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, clean_text):
            # Neutralize by adding a prefix or modifying the text
            clean_text = f"[USER INPUT]: {clean_text}"
            break
            
    return clean_text

def sanitize_payload(data: Union[Dict, List, str, Any]) -> Any:
    """
    Recursively sanitize a payload.
    """
    if isinstance(data, dict):
        return {k: sanitize_payload(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_payload(i) for i in data]
    elif isinstance(data, str):
        return sanitize_string(data)
    else:
        return data

def contains_malicious_patterns(text: str) -> bool:
    """
    Check if a string contains known malicious patterns (XSS/Injection).
    """
    if not text:
        return False
        
    for pattern in XSS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
            
    return False
