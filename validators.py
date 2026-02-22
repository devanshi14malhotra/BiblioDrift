"""
Request validation schemas using Pydantic.
Provides input validation for all API endpoints.
"""
import os
import sys
from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr
from typing import Optional, List, Dict, Any, Literal
from enum import Enum


class ShelfType(str, Enum):
    """Valid shelf types for library items."""
    WANT = "want"
    CURRENT = "current"
    FINISHED = "finished"


class ChatMessage(BaseModel):
    """Schema for chat message history items."""
    type: str = Field(..., description="Message type (user/bot)")
    content: str = Field(..., max_length=1000, description="Message content")


# ==================== ANALYZE MOOD ====================
class AnalyzeMoodRequest(BaseModel):
    """Request schema for /api/v1/analyze-mood endpoint."""
    title: str = Field(..., min_length=1, max_length=255, description="Book title (required)")
    author: str = Field(default="", max_length=255, description="Author name (optional)")
    
    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        """Ensure title is not just whitespace."""
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


# ==================== MOOD TAGS ====================
class MoodTagsRequest(BaseModel):
    """Request schema for /api/v1/mood-tags endpoint."""
    title: str = Field(..., min_length=1, max_length=255, description="Book title (required)")
    author: str = Field(default="", max_length=255, description="Author name (optional)")
    
    @field_validator('title')
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        """Ensure title is not just whitespace."""
        if not v.strip():
            raise ValueError('Title cannot be empty or whitespace')
        return v.strip()


# ==================== MOOD SEARCH ====================
class MoodSearchRequest(BaseModel):
    """Request schema for /api/v1/mood-search endpoint."""
    query: str = Field(..., min_length=1, max_length=500, description="Mood/vibe search query")
    
    @field_validator('query')
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        """Ensure query is not just whitespace."""
        if not v.strip():
            raise ValueError('Query cannot be empty or whitespace')
        return v.strip()


# ==================== GENERATE NOTE ====================
class GenerateNoteRequest(BaseModel):
    """Request schema for /api/v1/generate-note endpoint."""
    description: str = Field(default="", max_length=5000, description="Book description")
    title: str = Field(default="", max_length=255, description="Book title")
    author: str = Field(default="", max_length=255, description="Author name")
    
    @field_validator('title', 'author')
    @classmethod
    def sanitize_strings(cls, v: str) -> str:
        """Strip whitespace from string fields."""
        return v.strip() if v else v


# ==================== CHAT ====================
class ChatRequest(BaseModel):
    """Request schema for /api/v1/chat endpoint."""
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Conversation history")
    
    @field_validator('message')
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        """Ensure message is not just whitespace."""
        if not v.strip():
            raise ValueError('Message cannot be empty or whitespace')
        return v.strip()


# ==================== LIBRARY ====================
class AddToLibraryRequest(BaseModel):
    """Request schema for POST /api/v1/library endpoint."""
    user_id: int = Field(..., description="User ID")
    google_books_id: str = Field(..., min_length=1, max_length=50, description="Google Books ID")
    title: str = Field(..., min_length=1, max_length=255, description="Book title")
    authors: str = Field(default="", max_length=500, description="Author names")
    thumbnail: str = Field(default="", max_length=500, description="Book thumbnail URL")
    shelf_type: ShelfType = Field(..., description="Shelf type (want/current/finished)")
    
    @field_validator('google_books_id', 'title', 'authors', 'thumbnail')
    @classmethod
    def sanitize_strings(cls, v: str) -> str:
        """Strip whitespace from string fields."""
        return v.strip() if v else v


class UpdateLibraryItemRequest(BaseModel):
    """Request schema for PUT /api/v1/library/<item_id> endpoint."""
    shelf_type: Optional[ShelfType] = Field(default=None, description="Shelf type (want/current/finished)")
    progress: Optional[int] = Field(default=None, ge=0, le=100, description="Reading progress (0-100)")
    rating: Optional[int] = Field(default=None, ge=1, le=5, description="Book rating (1-5)")


class SyncLibraryRequest(BaseModel):
    """Request schema for POST /api/v1/library/sync endpoint."""
    user_id: int = Field(..., description="User ID")
    items: List[Dict[str, Any]] = Field(..., description="List of books to sync")


# ==================== AUTH ====================
class RegisterRequest(BaseModel):
    """Request schema for POST /api/v1/register endpoint."""
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=100, description="Password (minimum 6 characters)")
    
    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        """Ensure username is alphanumeric."""
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must be alphanumeric (letters, numbers, underscores only)')
        return v.strip()


class LoginRequest(BaseModel):
    """Request schema for POST /api/v1/login endpoint."""
    username: str = Field(..., min_length=1, description="Username or email")
    password: str = Field(..., min_length=1, description="Password")


# ==================== VALIDATION ERROR HANDLER ====================
def format_validation_errors(errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format Pydantic validation errors into a structured response.
    
    Args:
        errors: List of validation error dictionaries from Pydantic
        
    Returns:
        Formatted error response with field-level details
    """
    formatted_errors = []
    
    for error in errors:
        field = error.get('loc', ['unknown'])[-1]  # Get the field name
        message = error.get('msg', 'Invalid value')
        error_type = error.get('type', 'validation_error')
        
        formatted_errors.append({
            'field': field,
            'message': message,
            'type': error_type
        })
    
    return {
        'success': False,
        'error': 'Validation failed',
        'validation_errors': formatted_errors
    }


def validate_request(schema_class, data: Optional[Dict[str, Any]]) -> tuple[bool, Any]:
    """
    Validate request data against a Pydantic schema.
    
    Args:
        schema_class: Pydantic model class to validate against
        data: Request data (JSON body)
        
    Returns:
        Tuple of (is_valid, validated_data_or_error_response)
    """
    if data is None:
        return False, {
            'success': False,
            'error': 'Invalid JSON or missing request body',
            'validation_errors': []
        }
    
    try:
        validated = schema_class(**data)
        return True, validated
    except Exception as e:
        # Handle Pydantic validation errors
        if hasattr(e, 'errors'):
            return False, format_validation_errors(e.errors())
        else:
            return False, {
                'success': False,
                'error': str(e),
                'validation_errors': []
            }


# ==================== JWT SECRET VALIDATION ====================
# Default insecure key that should NEVER be used in production
DEFAULT_INSECURE_KEY = 'default-dev-secret-key'
# Minimum recommended secret key length (256 bits / 8 = 32 characters for HS256)
MIN_SECRET_KEY_LENGTH = 32


def validate_jwt_secret() -> tuple[bool, str]:
    """
    Validate JWT_SECRET_KEY environment variable at startup.
    
    Checks:
    1. JWT_SECRET_KEY is set (not None/empty)
    2. Not using the default insecure key
    3. Meets minimum length requirement
    
    Returns:
        Tuple of (is_valid, message)
    """
    secret_key = os.getenv('JWT_SECRET_KEY')
    
    # Check 1: Secret key must be set
    if not secret_key:
        return False, "JWT_SECRET_KEY environment variable is not set. Please set a secure secret key."
    
    # Check 2: Must not be the default insecure key
    if secret_key == DEFAULT_INSECURE_KEY:
        return False, "FATAL: Using default insecure JWT secret key. This is a critical security vulnerability. Set JWT_SECRET_KEY to a secure value."
    
    # Check 3: Minimum length validation
    if len(secret_key) < MIN_SECRET_KEY_LENGTH:
        return False, f"JWT_SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters. Current length: {len(secret_key)}"
    
    return True, "JWT_SECRET_KEY is properly configured."


def is_production_mode() -> bool:
    """
    Check if the application is running in production mode.
    
    Production is determined by:
    - FLASK_DEBUG is set to 'false' or 'False' or '0'
    - FLASK_ENV is set to 'production'
    - APP_ENV is set to 'production'
    
    Returns:
        True if running in production mode, False otherwise
    """
    flask_debug = os.getenv('FLASK_DEBUG', '').lower()
    flask_env = os.getenv('FLASK_ENV', '').lower()
    app_env = os.getenv('APP_ENV', '').lower()
    
    # If any explicitly set to production, or debug is explicitly false
    if flask_env == 'production' or app_env == 'production':
        return True
    if flask_debug in ('false', '0', 'no'):
        return True
    
    # Default to False (development mode)
    return False
