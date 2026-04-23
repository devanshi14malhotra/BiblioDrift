"""
Request validation schemas using Pydantic.
Provides input validation for all API endpoints.
"""
import os
import sys
from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr
from typing import Optional, List, Dict, Any, Literal
from enum import Enum
from sanitizer import sanitize_string, sanitize_for_ai


class ShelfType(str, Enum):
    """Valid shelf types for library items."""
    WANT = "want"
    CURRENT = "current"
    FINISHED = "finished"


class ChatMessage(BaseModel):
    """Schema for chat message history items."""
    type: str = Field(..., description="Message type (user/bot)")
    content: str = Field(..., max_length=1000, description="Message content")
    
    @field_validator('content')
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        """Sanitize message content for AI and storage."""
        return sanitize_for_ai(v)

    @field_validator('type')
    @classmethod
    def sanitize_type(cls, v: str) -> str:
        """Sanitize message type."""
        return sanitize_string(v, max_len=50)


# ==================== ANALYZE MOOD ====================
class AnalyzeMoodRequest(BaseModel):
    """Request schema for /api/v1/analyze-mood endpoint."""
    title: str = Field(..., min_length=1, max_length=255, description="Book title (required)")
    author: str = Field(default="", max_length=255, description="Author name (optional)")
    
    @field_validator('title', 'author')
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        """Ensure fields are sanitized."""
        if not v or not v.strip():
             return v
        return sanitize_string(v, max_len=255)


# ==================== MOOD TAGS ====================
class MoodTagsRequest(BaseModel):
    """Request schema for /api/v1/mood-tags endpoint."""
    title: str = Field(..., min_length=1, max_length=255, description="Book title (required)")
    author: str = Field(default="", max_length=255, description="Author name (optional)")
    
    @field_validator('title', 'author')
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        """Ensure fields are sanitized."""
        if not v or not v.strip():
             return v
        return sanitize_string(v, max_len=255)


# ==================== MOOD SEARCH ====================
class MoodSearchRequest(BaseModel):
    """Request schema for /api/v1/mood-search endpoint."""
    query: str = Field(..., min_length=1, max_length=500, description="Mood/vibe search query")
    
    @field_validator('query')
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        """Sanitize search query for AI."""
        if not v or not v.strip():
            raise ValueError('Query cannot be empty or whitespace')
        return sanitize_for_ai(v)


# ==================== GENERATE NOTE ====================
class GenerateNoteRequest(BaseModel):
    """Request schema for /api/v1/generate-note endpoint."""
    description: str = Field(default="", max_length=5000, description="Book description")
    title: str = Field(default="", max_length=255, description="Book title")
    author: str = Field(default="", max_length=255, description="Author name")
    
    @field_validator('title', 'author', 'description')
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        """Sanitize strings for AI note generation."""
        return sanitize_for_ai(v)


# ==================== CHAT ====================
class ChatRequest(BaseModel):
    """Request schema for /api/v1/chat endpoint."""
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Conversation history")
    
    @field_validator('message')
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        """Sanitize message for AI."""
        if not v or not v.strip():
            raise ValueError('Message cannot be empty or whitespace')
        return sanitize_for_ai(v)


# ==================== CATEGORY BOOKS ====================
class CategoryBooksRequest(BaseModel):
    """Request schema for /api/v1/category-books endpoint."""
    category: str = Field(..., min_length=1, max_length=100, description="Shelf category name e.g. 'Rainy Evening Reads'")
    vibe_description: str = Field(..., min_length=1, max_length=500, description="Emotional description of the category vibe")
    count: int = Field(default=5, ge=1, le=20, description="Number of books to return (1-20)")

    @field_validator('category', 'vibe_description')
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        """Ensure fields are not blank and sanitize for AI."""
        if not v or not v.strip():
            raise ValueError('Field must not be empty or whitespace')
        return sanitize_for_ai(v.strip())


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
    def sanitize_fields(cls, v: str) -> str:
        """Sanitize strings for database storage."""
        return sanitize_string(v)


class UpdateLibraryItemRequest(BaseModel):
    """Request schema for PUT /api/v1/library/<item_id> endpoint."""
    shelf_type: Optional[ShelfType] = Field(default=None, description="Shelf type (want/current/finished)")
    progress: Optional[int] = Field(default=None, ge=0, le=100, description="Reading progress (0-100)")
    rating: Optional[int] = Field(default=None, ge=1, le=5, description="Book rating (1-5)")
    version: Optional[int] = Field(default=None, description="Current version for optimistic locking")


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
        """Ensure username contains only letters, numbers, and underscores."""
        v = v.strip()
        if not v.replace('_', '').isalnum():
            raise ValueError('Username must contain only letters, numbers, and underscores.')
        return v


class LoginRequest(BaseModel):
    """Request schema for POST /api/v1/login endpoint."""
    username: str = Field(..., min_length=1, description="Username or email")
    password: str = Field(..., min_length=1, description="Password")


# ==================== READING STATS & GOALS ====================
class SetGoalRequest(BaseModel):
    """Request schema for POST /api/v1/stats/goal endpoint."""
    user_id: int = Field(..., description="User ID")
    year: int = Field(..., ge=2020, le=2100, description="Year for the reading goal")
    target_books: int = Field(..., ge=1, le=1000, description="Target number of books for the year")


class GetStatsRequest(BaseModel):
    """Request schema for GET /api/v1/stats endpoint."""
    user_id: int = Field(..., description="User ID")
    year: Optional[int] = Field(default=None, ge=2020, le=2100, description="Year for stats (defaults to current year)")


# ==================== COLLECTIONS ====================
class CollectionRequest(BaseModel):
    """Request schema for POST /api/v1/collections endpoint."""
    user_id: int = Field(..., description="User ID")
    name: str = Field(..., min_length=1, max_length=100, description="Collection name (required)")
    description: Optional[str] = Field(default="", max_length=500, description="Collection description")
    is_public: bool = Field(default=False, description="Whether collection is public")
    
    @field_validator('name', 'description')
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize collection metadata."""
        if v is None:
            return None
        return sanitize_string(v, max_len=500)


class UpdateCollectionRequest(BaseModel):
    """Request schema for PUT /api/v1/collections/<collection_id> endpoint."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Collection name")
    description: Optional[str] = Field(default=None, max_length=500, description="Collection description")
    is_public: Optional[bool] = Field(default=None, description="Whether collection is public")
    
    @field_validator('name', 'description')
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize collection metadata."""
        if v is None:
             return None
        return sanitize_string(v, max_len=500)


class AddToCollectionRequest(BaseModel):
    """Request schema for POST /api/v1/collections/<collection_id>/books endpoint."""
    user_id: int = Field(..., description="User ID")
    google_books_id: str = Field(..., min_length=1, max_length=50, description="Google Books ID")
    title: str = Field(..., min_length=1, max_length=255, description="Book title")
    authors: str = Field(default="", max_length=500, description="Author names")
    thumbnail: str = Field(default="", max_length=500, description="Book thumbnail URL")
    
    @field_validator('google_books_id', 'title', 'authors', 'thumbnail')
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        """Sanitize book metadata for collections."""
        return sanitize_string(v)


# ==================== VALIDATION ERROR HANDLER ====================
def format_validation_errors(errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format Pydantic validation errors into a structured response."""
    formatted_errors = []
    
    for error in errors:
        field = error.get('loc', ['unknown'])[-1]
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
    """Validate request data against a Pydantic schema."""
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
        if hasattr(e, 'errors'):
            return False, format_validation_errors(e.errors())
        else:
            return False, {
                'success': False,
                'error': str(e),
                'validation_errors': []
            }


# ==================== JWT SECRET VALIDATION ====================
DEFAULT_INSECURE_KEY = 'default-dev-secret-key'
MIN_SECRET_KEY_LENGTH = 32


def validate_jwt_secret() -> tuple[bool, str]:
    """Validate JWT_SECRET_KEY environment variable at startup."""
    secret_key = os.getenv('JWT_SECRET_KEY')
    
    if not secret_key:
        return False, "JWT_SECRET_KEY environment variable is not set. Please set a secure secret key."
    
    if secret_key == DEFAULT_INSECURE_KEY:
        return False, "FATAL: Using default insecure JWT secret key. This is a critical security vulnerability. Set JWT_SECRET_KEY to a secure value."
    
    if len(secret_key) < MIN_SECRET_KEY_LENGTH:
        return False, f"JWT_SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters. Current length: {len(secret_key)}"
    
    return True, "JWT_SECRET_KEY is properly configured."


def is_production_mode() -> bool:
    """Check if the application is running in production mode."""
    flask_debug = os.getenv('FLASK_DEBUG', '').lower()
    flask_env = os.getenv('FLASK_ENV', '').lower()
    app_env = os.getenv('APP_ENV', '').lower()
    
    if flask_env == 'production' or app_env == 'production':
        return True
    if flask_debug in ('false', '0', 'no'):
        return True
    
    return False


# ==================== PRICE ALERTS ====================

class SetPriceAlertRequest(BaseModel):
    """Request schema for POST /api/v1/books/<book_id>/alert endpoint."""
    user_id: int = Field(..., description="User ID")
    shelf_item_id: int = Field(..., description="Shelf item ID")
    target_price: float = Field(..., gt=0, description="Target price for alert (must be positive)")
    
    @field_validator('target_price')
    @classmethod
    def target_price_positive(cls, v: float) -> float:
        """Ensure target price is positive."""
        if v <= 0:
            raise ValueError('Target price must be positive')
        return v


class GetPriceHistoryRequest(BaseModel):
    """Request schema for GET /api/v1/books/<book_id>/prices endpoint."""
    retailer: Optional[str] = Field(default=None, description="Filter by retailer")
    limit: Optional[int] = Field(default=30, ge=1, le=100, description="Limit number of records")


class GetAlertsRequest(BaseModel):
    """Request schema for GET /api/v1/alerts endpoint."""
    user_id: int = Field(..., description="User ID")
    active_only: bool = Field(default=True, description="Only return active alerts")


# ==================== BOOK REVIEWS & RATINGS ====================

class ReviewRequest(BaseModel):
    """Request schema for POST /api/v1/reviews endpoint."""
    user_id: int = Field(..., description="User ID")
    google_books_id: str = Field(..., min_length=1, max_length=50, description="Google Books ID")
    rating: int = Field(..., ge=1, le=5, description="Rating (1-5)")
    review_text: Optional[str] = Field(default="", max_length=2000, description="Review text (max 2000 chars)")
    
    @field_validator('google_books_id', 'review_text')
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        """Sanitize review data."""
        return sanitize_string(v, max_len=2000)
    
    @field_validator('rating')
    @classmethod
    def rating_valid(cls, v: int) -> int:
        """Ensure rating is between 1 and 5."""
        if v < 1 or v > 5:
            raise ValueError('Rating must be between 1 and 5')
        return v