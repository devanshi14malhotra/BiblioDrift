# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, 
    get_jwt_identity, set_access_cookies, unset_jwt_cookies
)
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
import os
import requests

import logging
from datetime import datetime, timedelta, timezone
from sanitizer import sanitize_payload

# Load environment variables from .env file BEFORE importing config
load_dotenv()

from config import app_config, setup_logging
from ai_service import generate_book_note, get_ai_recommendations, get_category_books, get_book_mood_tags_safe, generate_chat_response, llm_service
from models import db, User, Book, ShelfItem, BookNote, ReadingGoal, ReadingStats, Collection, CollectionItem, PriceHistory, PriceAlert, Review, register_user, login_user
from price_tracker import get_price_tracker
from cache_service import cache_service
from validators import (
    validate_request,
    AnalyzeMoodRequest,
    MoodTagsRequest,
    MoodSearchRequest,
    GenerateNoteRequest,
    ChatRequest,
    CategoryBooksRequest,
    AddToLibraryRequest,
    UpdateLibraryItemRequest,
    SyncLibraryRequest,
    RegisterRequest,
    LoginRequest,
    SetGoalRequest,
    GetStatsRequest,
    CollectionRequest,
    UpdateCollectionRequest,
    AddToCollectionRequest,
    ReviewRequest,
    SetPriceAlertRequest,
    GetPriceHistoryRequest,
    GetAlertsRequest,
    format_validation_errors,
    validate_jwt_secret,
    is_production_mode
)
from collections import defaultdict, deque
from math import ceil
from time import time
from error_responses import (
    ErrorCodes, error_response, success_response,
    validation_error, missing_fields_error, invalid_json_error,
    auth_error, forbidden_error, unauthorized_access_error,
    not_found_error, resource_exists_error, rate_limit_error,
    internal_error, service_unavailable_error
)

# Setup logging from configuration
logger = setup_logging(app_config)

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('bibliodrift.log') if os.getenv('LOG_FILE') else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)

# Try to import enhanced mood analysis
try:
    from mood_analysis.ai_service_enhanced import AIBookService
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False
    logger.warning("Mood analysis package not available - some endpoints will be disabled")

# =====================================================================
# FLASK APPLICATION INSTANTIATION
# We initialize the Flask application instance here.
# Note that the static folder is configured to serve local files.
# Additional security measures, including updated strict CORS policies,
# and enhanced token security are applied later in this file 
# to ensure API integrity across all origins.
# =====================================================================
app = Flask(__name__, static_folder='.', static_url_path='')

# Apply configuration to Flask app
app.config.update(app_config.flask_config)

# Initialize JWT Manager
jwt = JWTManager(app)

# =====================================================================
# SECURITY COMPLIANCE UPDATE: CORS CONFIGURATION
# The previous CORS(app) was overly permissive and allowed all origins.
# An open CORS policy (equivalent to Access-Control-Allow-Origin: *)
# exposes all API endpoints to cross-origin requests from any domain, 
# which can enable CSRF-type attacks.
# The fix below restricts CORS to specific trusted origins. We can 
# optionally load allowed origins from environment variables.
# =====================================================================
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "https://bibliodrift.com").split(",")
CORS(app, supports_credentials=True, origins=allowed_origins)

# Initialize cache service
cache_service.init_app(app)

@app.errorhandler(404)
def page_not_found(e: Exception):
    if request.path.startswith('/api/'):
        return error_response(ErrorCodes.ENDPOINT_NOT_FOUND, "Endpoint not found", 404)
    return app.send_static_file('404.html'), 404


@app.after_request
def add_security_headers(response):
    """
    Add security headers to all responses for defense-in-depth XSS prevention.
    
    Headers Added:
    - Content-Security-Policy: Restricts resource loading and inline scripts
    - X-Content-Type-Options: Prevents MIME type sniffing
    - X-Frame-Options: Prevents clickjacking by disallowing framing
    - X-XSS-Protection: Legacy XSS protection (browser-level)
    - Strict-Transport-Security: Forces HTTPS for next 1 year
    - Referrer-Policy: Controls referrer information sharing
    
    Args:
        response: Flask response object
        
    Returns:
        response: Response with added security headers
    """
    # Content Security Policy: Restrict resource loading to prevent inline scripts/XSS
    # - default-src 'self': Only allow resources from the same origin
    # - script-src 'self' https://cdn.jsdelivr.net: Allow scripts from self and DOMPurify CDN
    # - style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com: Allow styles from self and CDN
    # - img-src 'self' data: https:: Allow images from self, data URLs, and HTTPS
    # - font-src 'self' https://fonts.gstatic.com: Allow fonts from self and Google Fonts
    # - connect-src 'self' ws: wss:: Allow connections to own origin and WebSocket
    # - frame-ancestors 'none': Prevent framing/clickjacking
    # - base-uri 'self': Restrict base tag to same origin
    # - form-action 'self': Restrict form submissions to same origin
    # - upgrade-insecure-requests: Upgrade HTTP to HTTPS
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https: http:; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "connect-src 'self' ws: wss: http: https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "upgrade-insecure-requests"
    )
    response.headers['Content-Security-Policy'] = csp_policy
    
    # Prevent MIME type sniffing (forces browser to respect Content-Type header)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevent clickjacking by disallowing the site to be framed
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Legacy XSS protection header (for older browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Force HTTPS for 1 year (including subdomains)
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Control referrer information to reduce information leakage
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Restrict permissions and features the page can use
    response.headers['Permissions-Policy'] = (
        'geolocation=(), '
        'microphone=(), '
        'camera=(), '
        'payment=(), '
        'usb=(), '
        'magnetometer=(), '
        'gyroscope=(), '
        'accelerometer=()'
    )
    
    return response

# Rate limiting configuration
RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', '60'))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '30'))

_request_log = defaultdict(deque)
_request_calls = 0


def _cleanup_expired_keys(cutoff: float) -> None:
    """Remove keys whose newest timestamp is already outside the window."""
    stale_keys = [key for key, dq in _request_log.items() if not dq or dq[-1] <= cutoff]
    for key in stale_keys:
        _request_log.pop(key, None)


def _rate_limited(endpoint: str) -> tuple[bool, int]:
    """Sliding window limiter per IP/endpoint."""
    if not app_config.rate_limit.enabled:
        return False, 0
    
    global _request_calls
    key = f"{request.remote_addr}|{endpoint}"
    now = time()
    window_start = now - RATE_LIMIT_WINDOW
    _request_calls += 1

    dq = _request_log[key]
    while dq and dq[0] <= window_start:
        dq.popleft()

    if len(dq) >= RATE_LIMIT_MAX_REQUESTS:
        oldest = dq[0]
        retry_after = max(1, ceil(RATE_LIMIT_WINDOW - (now - oldest)))
        return True, retry_after

    dq.append(now)

    if _request_calls % 100 == 0:
        _cleanup_expired_keys(window_start)

    return False, 0


def rate_limit(endpoint_name: str):
    """Decorator to apply rate limiting to an endpoint."""
    def decorator(f):
        def wrapped(*args, **kwargs):
            limited, retry_after = _rate_limited(endpoint_name)
            if limited:
                response = jsonify({
                    "success": False,
                    "error": "Rate limit exceeded. Try again shortly.",
                    "retry_after": retry_after
                })
                response.status_code = 429
                response.headers['Retry-After'] = retry_after
                return response
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__
        return wrapped
    return decorator

# Initialize AI service if available
if MOOD_ANALYSIS_AVAILABLE:
    ai_service = AIBookService()


# ==================== JWT SECRET VALIDATION AT STARTUP ====================
def _validate_jwt_secret_startup():
    is_valid, errors = app_config.validate()
    
    if not is_valid:
        if app_config.is_production():
            logger.critical("=" * 70)
            logger.critical("CRITICAL SECURITY ERROR - APPLICATION REFUSING TO START")
            logger.critical("=" * 70)
            for error in errors:
                logger.critical(f"  - {error}")
            logger.critical("=" * 70)
            import sys
            sys.exit(1)
        else:
            logger.warning("=" * 70)
            logger.warning("WARNING: CONFIGURATION ISSUES DETECTED")
            logger.warning("=" * 70)
            for error in errors:
                logger.warning(f"  - {error}")
            logger.warning("=" * 70)
    else:
        if app_config.is_development():
            logger.info("=" * 70)
            logger.info("CONFIGURATION VALIDATION: OK")
            logger.info("=" * 70)
            logger.info(f"Environment: {app_config.get_environment_name()}")
            logger.info(f"Rate limiting: {'Enabled' if app_config.rate_limit.enabled else 'Disabled'}")
            logger.info("=" * 70)


_validate_jwt_secret_startup()

@app.route('/api/v1/config', methods=['GET'])
def get_config():
    """Serve public configuration values like Google Books API Key."""
    return jsonify({
        "google_books_key": os.getenv('GOOGLE_BOOKS_API_KEY', ''),
        "google_books_key_secondary": os.getenv('GOOGLE_BOOKS_API_KEY_SECONDARY', '')
    })

@app.route('/')
def index():
    """Simple index page showing available API endpoints."""
    endpoints_info = {
        "service": "BiblioDrift Mood Analysis API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET /": "This page - API documentation",
            "GET /api/v1/health": "Health check endpoint",
            "POST /api/v1/generate-note": "Generate AI book notes",
            "POST /api/v1/chat": "Chat with bookseller",
            "POST /api/v1/mood-search": "Search books by mood/vibe",
            "POST /api/v1/category-books": "Get AI-curated books for a specific shelf category"
        },
        "note": "All endpoints except / and /api/v1/health require POST requests with JSON body",
        "example_usage": {
            "chat": {
                "url": "/api/v1/chat",
                "method": "POST",
                "body": {"message": "I want something cozy for a rainy evening"}
            },
            "mood_search": {
                "url": "/api/v1/mood-search",
                "method": "POST",
                "body": {"query": "mystery thriller"}
            },
            "category_books": {
                "url": "/api/v1/category-books",
                "method": "POST",
                "body": {
                    "category": "Rainy Evening Reads",
                    "vibe_description": "quiet, melancholy, introspective — best read on grey afternoons",
                    "count": 5
                }
            }
        }
    }
    
    if MOOD_ANALYSIS_AVAILABLE:
        endpoints_info["endpoints"]["POST /api/v1/analyze-mood"] = "Analyze book mood from GoodReads"
        endpoints_info["endpoints"]["POST /api/v1/mood-tags"] = "Get mood tags for a book"
    else:
        endpoints_info["note"] += " | Mood analysis endpoints disabled (missing dependencies)"
    
    return jsonify(endpoints_info)

@app.route('/api/v1/analyze-mood', methods=['POST'])
@rate_limit('analyze_mood')
def handle_analyze_mood():
    """Analyze book mood using GoodReads reviews."""
    if not MOOD_ANALYSIS_AVAILABLE:
        return service_unavailable_error("Mood analysis not available - missing dependencies")
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(AnalyzeMoodRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        title = validated_data.title
        author = validated_data.author
        
        mood_analysis = ai_service.analyze_book_mood(title, author)
        
        if mood_analysis:
            return success_response(data={"mood_analysis": mood_analysis})
        else:
            return not_found_error("Mood analysis for this book")
            
    except Exception as e:
        logger.error(f"Error in handle_analyze_mood: {str(e)}", exc_info=True)
        return internal_error(str(e))

@app.route('/api/v1/mood-tags', methods=['POST'])
@rate_limit('mood_tags')
def handle_mood_tags():
    """Get mood tags for a book."""
    from exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException, 
        ValidationException, InvalidInputError
    )
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(MoodTagsRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        title = validated_data.title
        author = validated_data.author
        
        mood_tags = get_book_mood_tags_safe(title, author)
        return success_response(
            data={"mood_tags": mood_tags}
        )
        
    except (LLMCircuitBreakerOpenError, AIServiceException) as e:
        logger.error(f"AI service error in handle_mood_tags: {e}", exc_info=True)
        return handle_exception(e, "handle_mood_tags")
    except (ValidationException, InvalidInputError) as e:
        logger.warning(f"Validation error in handle_mood_tags: {e}")
        return handle_exception(e, "handle_mood_tags")
    except Exception as e:
        logger.error(f"Unexpected error in handle_mood_tags: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "handle_mood_tags")

@app.route('/api/v1/mood-search', methods=['POST'])
@rate_limit('mood_search')
def handle_mood_search():
    """Search for books based on mood/vibe."""
    from exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException,
        ValidationException, InvalidInputError
    )
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(MoodSearchRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        mood_query = validated_data.query
        
        recommendations = get_ai_recommendations(mood_query)
        return success_response(
            data={
                "recommendations": recommendations,
                "query": mood_query
            }
        )
        
    except SQLAlchemyError as e:
        logger.error(f"Database error searching mood: {e}")
        return internal_error("A database error occurred during search.")
    except Exception as e:
        logger.error(f"Unexpected error searching mood: {e}")
        return internal_error(str(e))


@app.route('/api/v1/category-books', methods=['POST'])
@rate_limit('category_books')
def handle_category_books():
    """
    Return AI-generated, category-specific book recommendations.

    Fix for: all shelf categories displaying the same default books.

    Each category sends its name + vibe description. The LLM returns a list
    of real book titles and authors specific to that vibe. The frontend uses
    these titles to query the Google Books API for actual cover images and
    metadata — ensuring each shelf displays genuinely different, relevant books.

    Request body:
        {
            "category": "Rainy Evening Reads",
            "vibe_description": "quiet and melancholy, best read on grey afternoons",
            "count": 5
        }

    Response:
        {
            "success": true,
            "data": {
                "category": "Rainy Evening Reads",
                "books": [
                    {
                        "title": "The Remains of the Day",
                        "author": "Kazuo Ishiguro",
                        "reason": "A quiet, melancholy novel about regret — perfect for a rainy afternoon."
                    },
                    ...
                ]
            }
        }
    """
    try:
        data = request.get_json()

        is_valid, validated_data = validate_request(CategoryBooksRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400

        books = get_category_books(
            category=validated_data.category,
            vibe_description=validated_data.vibe_description,
            count=validated_data.count,
        )

        if not books:
            return service_unavailable_error(
                "Could not generate book recommendations right now. Please try again shortly."
            )

        return success_response(
            data={
                "category": validated_data.category,
                "books": books,
            }
        )

    except Exception as e:
        logger.error(f"Error in handle_category_books: {str(e)}", exc_info=True)
        return internal_error(str(e))


@app.route('/api/v1/generate-note', methods=['POST'])
@rate_limit('generate_note')
def handle_generate_note():
    """Generate AI-powered book recommendation with vibe support."""
    from exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException,
        DatabaseQueryError, DatabaseIntegrityError,
        ValidationException, InvalidInputError
    )
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(GenerateNoteRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        description = validated_data.description
        title = validated_data.title
        author = validated_data.author
        vibe = getattr(validated_data, 'vibe', 'cozy discovery')
        
        # Check cache
        cached_note = BookNote.query.filter_by(book_title=title, book_author=author).first()
        if cached_note:
            logger.debug(f"Cache hit for {title} by {author}")
            return success_response(data={"vibe": cached_note.content})
        
        # Generate AI recommendation with vibe context
        recommendation = generate_book_note(description, title, author, vibe)
        
        try:
            if recommendation and isinstance(recommendation, dict):
                cache_content = recommendation.get('vibe', recommendation.get('bookseller_note', str(recommendation)))
                new_note = BookNote(book_title=title, book_author=author, content=cache_content)
                db.session.add(new_note)
                db.session.commit()
            elif isinstance(recommendation, str):
                new_note = BookNote(book_title=title, book_author=author, content=recommendation)
                db.session.add(new_note)
                db.session.commit()
        except SQLAlchemyError as e:
            logger.error(f"Database error caching note: {e}")
            db.session.rollback()
        except Exception as e:
            logger.error(f"Unexpected error caching note: {e}")
            db.session.rollback()
            # Don't fail the request if caching fails - still return the recommendation

        return success_response(data=recommendation)
        
    except (LLMCircuitBreakerOpenError, AIServiceException) as e:
        logger.error(f"AI service error in handle_generate_note: {e}", exc_info=True)
        return handle_exception(e, "handle_generate_note")
    except (ValidationException, InvalidInputError) as e:
        logger.warning(f"Validation error in handle_generate_note: {e}")
        return handle_exception(e, "handle_generate_note")
    except Exception as e:
        logger.error(f"Unexpected error in handle_generate_note: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "handle_generate_note")

@app.route('/api/v1/chat', methods=['POST'])
@rate_limit('chat')
def handle_chat():
    """Handle chat messages and generate bookseller responses."""
    from exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException,
        ValidationException, InvalidInputError
    )
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(ChatRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        user_message = validated_data.message
        conversation_history = validated_data.history or []
        
        validated_history = []
        for msg in conversation_history:
            if hasattr(msg, 'dict'):
                validated_history.append(msg.dict())
            else:
                validated_history.append(msg)
        
        # Generate contextual response based on conversation history
        response = generate_chat_response(user_message, validated_history)
        
        # Try to get book recommendations based on the message
        recommendations = get_ai_recommendations(user_message)
        
        return success_response(
            data={
                "response": response,
                "recommendations": recommendations,
                "timestamp": datetime.now().isoformat()
            }
        )
        
    except (LLMCircuitBreakerOpenError, AIServiceException) as e:
        logger.error(f"AI service error in handle_chat: {e}", exc_info=True)
        return handle_exception(e, "handle_chat")
    except (ValidationException, InvalidInputError) as e:
        logger.warning(f"Validation error in handle_chat: {e}")
        return handle_exception(e, "handle_chat")
    except Exception as e:
        logger.error(f"Unexpected error in handle_chat: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "handle_chat")

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """Health check endpoint with cache statistics."""
    cache_stats = cache_service.get_stats()
    
    return jsonify({
        "status": "healthy",
        "service": "BiblioDrift AI Service",
        "version": "2.0.0",
        "features": {
            "mood_analysis_available": MOOD_ANALYSIS_AVAILABLE,
            "llm_service_available": llm_service.is_available(),
            "openai_configured": llm_service.openai_client is not None,
            "groq_configured": llm_service.groq_client is not None,
            "gemini_configured": llm_service.gemini_client is not None,
            "preferred_llm": llm_service.preferred_llm,
            "caching_enabled": cache_stats.get('cache_type') != 'null'
        },
        "cache": cache_stats
    })



# =========================================================================
# ENDPOINT: Add Book to Library
# This endpoint allows authenticated users to add a new book to their
# personal library shelf. It handles a complex multi-step process:
# 1. JWT verification prevents unauthorized access.
# 2. Pydantic is used to enforce strict schema validation on incoming JSON.
# 3. We maintain a centralized Book table to avoid duplicating book metadata
#    (e.g., title, authors, cover) across multiple user libraries.
# 4. A ShelfItem connects the user to the Book and tracks user-specific
#    attributes like shelf type and read progress.
# =========================================================================
@app.route('/api/v1/library', methods=['POST'])
@jwt_required()
def add_to_library():
    """Add a book to the user's shelf."""
    from sqlalchemy.exc import IntegrityError
    from exceptions import DatabaseQueryError, DatabaseIntegrityError, ValidationException
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        is_valid, validated_data = validate_request(AddToLibraryRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        if str(validated_data.user_id) != str(current_user_id):
            return unauthorized_access_error("Cannot access another user's library")
        
        book = Book.query.filter_by(google_books_id=validated_data.google_books_id).first()
        if not book:
            book = Book(
                google_books_id=validated_data.google_books_id,
                title=validated_data.title,
                authors=validated_data.authors,
                thumbnail=validated_data.thumbnail
            )
            db.session.add(book)
            db.session.flush()

        existing_item = ShelfItem.query.filter_by(user_id=validated_data.user_id, book_id=book.id).with_for_update().first()
        if existing_item:
            existing_item.shelf_type = validated_data.shelf_type.value
            existing_item.version += 1
            item = existing_item
        else:
            item = ShelfItem(
                user_id=validated_data.user_id,
                book_id=book.id,
                shelf_type=validated_data.shelf_type.value
            )
            db.session.add(item)
        
        db.session.commit()
        return success_response(
            data={"message": "Book added to shelf", "item": item.to_dict()},
            status_code=201
        )
    except SQLAlchemyError as e:
        logger.error(f"Database error adding to library: {e}")
        db.session.rollback()
        return internal_error("A database error occurred while adding the book.")
    except Exception as e:
        logger.error(f"Unexpected error adding to library: {e}")
        db.session.rollback()
        return internal_error(str(e))

# =========================================================================
# ENDPOINT: Get User Library
# Retrieves the full inventory of a user's library in a single request.
# 
# Performance Optimization:
# - Uses SQLAlchemy's `joinedload` to eagerly fetch the associated Book 
#   for each ShelfItem. Without this, accessing `item.book` in the JSON
#   serialization phase would trigger an N+1 query storm.
# - Validates JWT identity against the requested user_id to prevent users
#   from casually scraping other accounts' libraries.
# =========================================================================
@app.route('/api/v1/library/<int:user_id>', methods=['GET'])
@jwt_required()
def get_library(user_id):
    """Get all books in a user's library."""
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Cannot access another user's library")
        
    try:
        items = ShelfItem.query.options(joinedload(ShelfItem.book)).filter_by(user_id=user_id).all()
        return success_response(data={"library": [item.to_dict() for item in items]})
    except Exception as e:
        return internal_error(str(e))


# ==================== READING STATS HELPER FUNCTIONS ====================
# =========================================================================
# HELPER: Update Reading Statistics
# Helper function invoked primarily when a user marks a book as "finished".
# 
# How it works:
# - ReadingStats are bucketed by (user_id, year, month) records.
# - It first checks for an existing record for the current month.
# - If missing, it seeds a new record starting at 0 for bounds checking.
# - It aggressively increments books_completed and adds page counts if the
#   underlying Google Books API returned valid page_count metadata.
# =========================================================================
def _update_reading_stats(user_id, book):
    """Update reading stats when a book is finished."""
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month
    
    stats = ReadingStats.query.filter_by(user_id=user_id, year=year, month=month).first()
    
    if not stats:
        stats = ReadingStats(user_id=user_id, year=year, month=month, books_completed=0, pages_read=0)
        db.session.add(stats)
    
    stats.books_completed += 1
    
    if book and book.page_count:
        stats.pages_read += book.page_count
    
    db.session.commit()


def _calculate_reading_streak(user_id):
    """Calculate the user's current reading streak in days."""
    finished_items = ShelfItem.query.filter_by(
        user_id=user_id, shelf_type='finished'
    ).filter(ShelfItem.finished_at.isnot(None)).order_by(ShelfItem.finished_at.desc()).all()
    
    if not finished_items:
        return 0
    
    now = datetime.now(timezone.utc)
    today = now.date()
    most_recent = finished_items[0].finished_at.date()
    
    if (today - most_recent).days > 1:
        return 0
    
    streak = 1
    prev_date = most_recent
    
    for item in finished_items[1:]:
        finish_date = item.finished_at.date()
        days_diff = (prev_date - finish_date).days
        
        if days_diff == 1:
            streak += 1
            prev_date = finish_date
        elif days_diff > 1:
            break
    
    return streak


def _get_yearly_stats(user_id, year):
    """Get yearly reading statistics."""
    stats = ReadingStats.query.filter_by(user_id=user_id, year=year).all()
    
    total_books = sum(s.books_completed for s in stats)
    total_pages = sum(s.pages_read for s in stats)
    monthly = {s.month: s.books_completed for s in stats}
    
    return {"total_books": total_books, "total_pages": total_pages, "monthly": monthly}


# ==================== LIBRARY ENDPOINTS ====================
@app.route('/api/v1/library/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_library_item(item_id):
    """Update a library item (e.g. move to different shelf)."""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        is_valid, validated_data = validate_request(UpdateLibraryItemRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        item = ShelfItem.query.with_for_update().get(item_id)
        if not item:
            return not_found_error("Library item")
            
        if str(item.user_id) != str(current_user_id):
            return forbidden_error("Cannot modify another user's library item")

        if validated_data.version is not None and item.version != validated_data.version:
            return error_response(
                ErrorCodes.CONFLICT,
                "The item has been modified on another device. Please refresh and try again.",
                409,
                additional_data={"current_version": item.version, "server_item": item.to_dict()}
            )

        if validated_data.shelf_type is not None:
            item.shelf_type = validated_data.shelf_type.value
        
        if validated_data.progress is not None:
            item.progress = validated_data.progress
            if item.progress == 100:
                item.shelf_type = 'finished'
                item.finished_at = datetime.now(timezone.utc)
        
        if validated_data.rating is not None:
            item.rating = validated_data.rating

        item.version += 1
            
        db.session.commit()
        return success_response(data={"message": "Item updated", "item": item.to_dict()})
    except SQLAlchemyError as e:
        logger.error(f"Database error updating library item: {e}")
        db.session.rollback()
        return internal_error("A database error occurred while updating the item.")
    except Exception as e:
        logger.error(f"Unexpected error updating library item: {e}")
        db.session.rollback()
        return internal_error(str(e))

@app.route('/api/v1/library/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_library(item_id):
    """Remove a book from the library."""
    current_user_id = get_jwt_identity()
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return not_found_error("Library item")
        
        if str(item.user_id) != str(current_user_id):
            return forbidden_error("Cannot delete another user's library item")
            
        db.session.delete(item)
        db.session.commit()
        return success_response(data={"message": "Item removed"})
    except SQLAlchemyError as e:
        logger.error(f"Database error removing from library: {e}")
        db.session.rollback()
        return internal_error("A database error occurred while removing the item.")
    except Exception as e:
        logger.error(f"Unexpected error removing from library: {e}")
        db.session.rollback()
        return internal_error(str(e))


db.init_app(app)
price_tracker = get_price_tracker(db)


# =========================================================================
# ENDPOINT: Bulk Library Sync
# Enables syncing a whole batch of books from local storage/mobile to the
# authoritative cloud backend. Contains critical safeguards:
# 1. Payload validation protects against memory bloat.
# 2. Iterate array using nested transactions `db.session.begin_nested()`.
#    This ensures failing to parse a single damaged book doesn't abort
#    the whole sync run.
# 3. Optimistic locking helps gracefully bypass older item updates from
#    the client when the server's record is strictly newer.
# =========================================================================
@app.route('/api/v1/library/sync', methods=['POST'])
@jwt_required()
def sync_library():
    """Sync a list of books from local storage to the user's account."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        is_valid, validated_data = validate_request(SyncLibraryRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        user_id = validated_data.user_id
        items = sanitize_payload(validated_data.items)
        
        if str(user_id) != str(current_user_id):
            return forbidden_error("Cannot sync to another user's library")
        
        synced_count = 0
        conflicts = 0
        errors = 0
        
        for item_data in items:
            try:
                with db.session.begin_nested():
                    if not isinstance(item_data, dict):
                        errors += 1
                        continue
                        
                    google_id = item_data.get('id')
                    if not google_id:
                        errors += 1
                        continue
                    
                    book = Book.query.filter_by(google_books_id=google_id).first()
                    
                    if not book:
                        volume_info = item_data.get('volumeInfo', {})
                        image_links = volume_info.get('imageLinks', {})
                        authors = volume_info.get('authors', [])
                        if isinstance(authors, list):
                            authors = ", ".join(authors)

                        book = Book(
                            google_books_id=google_id,
                            title=volume_info.get('title', 'Untitled'),
                            authors=authors,
                            thumbnail=image_links.get('thumbnail', '')
                        )
                        db.session.add(book)
                        db.session.flush()

                    existing_item = ShelfItem.query.filter_by(user_id=user_id, book_id=book.id).with_for_update().first()
                    shelf_type = item_data.get('shelf', 'want')
                    if shelf_type not in ['want', 'current', 'finished']:
                        shelf_type = 'want'

                    if not existing_item:
                        new_item = ShelfItem(
                            user_id=user_id,
                            book_id=book.id,
                            shelf_type=shelf_type,
                            progress=item_data.get('progress', 0)
                        )
                        db.session.add(new_item)
                        synced_count += 1
                    else:
                        remote_version = item_data.get('version')
                        if remote_version and remote_version < existing_item.version:
                            conflicts += 1
                            continue
                        
                        existing_item.shelf_type = shelf_type
                        existing_item.progress = item_data.get('progress', existing_item.progress)
                        existing_item.version += 1
                        synced_count += 1
                    
            except SQLAlchemyError as e:
                logger.error(f"Database error syncing item {item_data.get('id', 'unknown')}: {e}")
                errors += 1
            except Exception as e:
                logger.error(f"Unexpected error syncing item {item_data.get('id', 'unknown')}: {e}")
                errors += 1
        
        db.session.commit()
        return success_response(data={
            "message": f"Synced {synced_count} items",
            "errors": errors,
            "conflicts": conflicts
        })
    except Exception as e:
        db.session.rollback()
        return internal_error(str(e))

# =========================================================================
# ENDPOINT: User Registration
# Core signup flow. Validates credentials, creates a User entity, and
# immediately responds with an active session ready to go.
# 
# Security checks run here include rate limiting to prevent spam and
# Pydantic enforcing minimum password complexities / valid email formats.
# The user record is hashed internally inside the `register_user` util.
# Finally, JWT access cookies are locked and loaded on the response object.
# =========================================================================
@app.route('/api/v1/register', methods=['POST'])
@rate_limit('auth')
def register():
    """Register a new user and return JWT token."""
    from sqlalchemy.exc import IntegrityError
    from exceptions import DatabaseIntegrityError, DatabaseQueryError, ValidationException
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(RegisterRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        username = validated_data.username
        email = validated_data.email
        password = validated_data.password

        # check if user exists
        if User.query.filter((User.username==username) | (User.email==email)).first():
            return resource_exists_error("User")

        try:
            user = register_user(username, email, password)
            if not user:
                return internal_error("Failed to create user record after registration.")
            
            access_token = create_access_token(identity=str(user.id))
            
            resp, status = success_response(
                data={
                    "message": "User registered successfully",
                    "user": {"id": user.id, "username": user.username, "email": user.email}
                },
                status_code=201
            )
            set_access_cookies(resp, access_token)
            return resp, status
        except SQLAlchemyError as e:
            logger.error(f"Database error during registration: {e}")
            return internal_error("A database error occurred during registration.")
    except Exception as e:
        logger.error(f"Unexpected error in register endpoint: {e}")
        return internal_error(str(e))

@app.route('/api/v1/login', methods=['POST'])
@rate_limit('auth')
def login():
    """Authenticate user and return JWT token."""
    from exceptions import DatabaseQueryError, ValidationException
    from error_responses import handle_exception
    
    try:
        data = request.get_json()
        
        is_valid, validated_data = validate_request(LoginRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        username_or_email = validated_data.username
        password = validated_data.password

        # Try to find user by username or email
        user = User.query.filter((User.username==username_or_email) | (User.email==username_or_email)).first()
        
        if user and user.check_password(password):
            # Create JWT token
            access_token = create_access_token(identity=str(user.id))
            
            resp, status = success_response(
                data={
                    "message": "Login successful",
                    "user": {"id": user.id, "username": user.username, "email": user.email}
                }
            )
            set_access_cookies(resp, access_token)
            return resp, status
            
        return auth_error("Invalid username or password")
    except Exception as e:
        logger.error(f"Unexpected error in login: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "login")


@app.route('/api/v1/logout', methods=['POST'])
def logout():
    """Clear JWT cookies for logout."""
    resp, status = success_response(message="Logout successful")
    unset_jwt_cookies(resp)
    return resp, status


# ==================== READING STATS ENDPOINTS ====================
@app.route('/api/v1/stats/goal', methods=['POST'])
@jwt_required()
def set_reading_goal():
    """Set or update annual reading goal."""
    # Use get_json(silent=True) to avoid automatic 400 on malformed JSON
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(SetGoalRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    if str(validated_data.user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        existing_goal = ReadingGoal.query.filter_by(
            user_id=validated_data.user_id, year=validated_data.year
        ).first()
        
        if existing_goal:
            existing_goal.target_books = validated_data.target_books
            goal = existing_goal
        else:
            goal = ReadingGoal(
                user_id=validated_data.user_id,
                year=validated_data.year,
                target_books=validated_data.target_books
            )
            db.session.add(goal)
        
        db.session.commit()
        return jsonify({"message": "Reading goal set successfully", "goal": goal.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/stats', methods=['GET'])
@jwt_required()
def get_reading_stats():
    """Get reading statistics for the user."""
    user_id = request.args.get('user_id', type=int)
    year = request.args.get('year', datetime.now().year, type=int)
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        yearly_stats = _get_yearly_stats(user_id, year)
        current_streak = _calculate_reading_streak(user_id)
        goal = ReadingGoal.query.filter_by(user_id=user_id, year=year).first()
        now = datetime.now(timezone.utc)
        current_month_stats = ReadingStats.query.filter_by(user_id=user_id, year=year, month=now.month).first()
        
        return jsonify({
            "user_id": user_id,
            "year": year,
            "books_this_year": yearly_stats["total_books"],
            "pages_this_year": yearly_stats["total_pages"],
            "books_this_month": current_month_stats.books_completed if current_month_stats else 0,
            "pages_this_month": current_month_stats.pages_read if current_month_stats else 0,
            "current_streak": current_streak,
            "goal": goal.to_dict() if goal else None,
            "monthly_breakdown": yearly_stats["monthly"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/stats/leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    """Get community reading leaderboard."""
    year = request.args.get('year', datetime.now().year, type=int)
    limit = request.args.get('limit', 10, type=int)
    
    try:
        from sqlalchemy import func

        # =========================================================================
        # SQL Query Optimization
        # This query has been optimized to resolve a severe N+1+N query pattern.
        # Previously, `_get_yearly_stats` was called inside the leaderboard loop, 
        # making additional queries per user. This made the database calls O(n).
        # We now aggregate stats in a single SQL query using `GROUP BY user_id` 
        # alongside the leaderboard goal query. By joining User and outer joining 
        # ReadingStats, we sum `books_completed` and `pages_read` directly in SQL.
        # =========================================================================
        stats_query = db.session.query(
            ReadingGoal.user_id,
            User.username,
            ReadingGoal.target_books,
            func.coalesce(func.sum(ReadingStats.books_completed), 0).label('total_books'),
            func.coalesce(func.sum(ReadingStats.pages_read), 0).label('total_pages')
        ).join(
            User, ReadingGoal.user_id == User.id
        ).outerjoin(
            ReadingStats, 
            (ReadingGoal.user_id == ReadingStats.user_id) & (ReadingStats.year == year)
        ).filter(
            ReadingGoal.year == year
        ).group_by(
            ReadingGoal.user_id, User.username, ReadingGoal.target_books
        ).all()
        
        leaderboard = []
        for user_id, username, target_books, total_books, total_pages in stats_query:
            total_books_val = int(total_books)
            total_pages_val = int(total_pages)
            
            leaderboard.append({
                "user_id": user_id,
                "username": username if username else "Unknown",
                "target_books": target_books,
                "books_completed": total_books_val,
                "pages_read": total_pages_val,
                "progress_percentage": round((total_books_val / target_books * 100), 1) if target_books > 0 else 0
            })
        
        leaderboard.sort(key=lambda x: x["books_completed"], reverse=True)
        leaderboard = leaderboard[:limit]
        
        return jsonify({"year": year, "leaderboard": leaderboard}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== COLLECTIONS ENDPOINTS ====================
@app.route('/api/v1/collections', methods=['POST'])
@jwt_required()
def create_collection():
    """Create a new collection."""
    # Use get_json(silent=True) to avoid automatic 400 on malformed JSON
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(CollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    if str(validated_data.user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        existing = Collection.query.filter_by(user_id=validated_data.user_id, name=validated_data.name).first()
        
        if existing:
            return jsonify({"error": "Collection with this name already exists"}), 409
        
        collection = Collection(
            user_id=validated_data.user_id,
            name=validated_data.name,
            description=validated_data.description or '',
            is_public=validated_data.is_public
        )
        db.session.add(collection)
        db.session.commit()
        
        return jsonify({"message": "Collection created successfully", "collection": collection.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections', methods=['GET'])
@jwt_required()
def get_collections():
    """Get user's collections."""
    user_id = request.args.get('user_id', type=int)
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        collections = Collection.query.filter_by(user_id=user_id).order_by(Collection.created_at.desc()).all()
        return jsonify({"collections": [c.to_dict() for c in collections]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['GET'])
@jwt_required()
def get_collection(collection_id):
    """Get a single collection with its items."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        return jsonify({"collection": collection.to_dict(include_items=True)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
@jwt_required()
def update_collection(collection_id):
    """Update a collection."""
    # Use get_json(silent=True) to avoid automatic 400 on malformed JSON
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(UpdateCollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        if validated_data.name:
            existing = Collection.query.filter(
                Collection.user_id == collection.user_id,
                Collection.name == validated_data.name,
                Collection.id != collection_id
            ).first()
            if existing:
                return jsonify({"error": "Collection with this name already exists"}), 409
            collection.name = validated_data.name
        
        if validated_data.description is not None:
            collection.description = validated_data.description
        
        if validated_data.is_public is not None:
            collection.is_public = validated_data.is_public
        
        db.session.commit()
        return jsonify({"message": "Collection updated successfully", "collection": collection.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['DELETE'])
@jwt_required()
def delete_collection(collection_id):
    """Delete a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        db.session.delete(collection)
        db.session.commit()
        return jsonify({"message": "Collection deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books', methods=['POST'])
@jwt_required()
def add_book_to_collection(collection_id):
    """Add a book to a collection."""
    # Use get_json(silent=True) to avoid automatic 400 on malformed JSON
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(AddToCollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        book = Book.query.filter_by(google_books_id=validated_data.google_books_id).first()
        if not book:
            book = Book(
                google_books_id=validated_data.google_books_id,
                title=validated_data.title,
                authors=validated_data.authors or '',
                thumbnail=validated_data.thumbnail or ''
            )
            db.session.add(book)
            db.session.flush()
        
        existing_item = CollectionItem.query.filter_by(collection_id=collection_id, book_id=book.id).first()
        
        if existing_item:
            return jsonify({"error": "Book already in collection"}), 409
        
        item = CollectionItem(collection_id=collection_id, book_id=book.id)
        db.session.add(item)
        db.session.commit()
        
        return jsonify({"message": "Book added to collection", "item": item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books', methods=['GET'])
@jwt_required()
def get_collection_books(collection_id):
    """Get all books in a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        items = CollectionItem.query.filter_by(collection_id=collection_id).order_by(CollectionItem.added_at.desc()).all()
        
        return jsonify({"collection": collection.to_dict(), "books": [item.to_dict() for item in items]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books/<int:book_id>', methods=['DELETE'])
@jwt_required()
def remove_book_from_collection(collection_id, book_id):
    """Remove a book from a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        item = CollectionItem.query.filter_by(collection_id=collection_id, book_id=book_id).first()
        if not item:
            return jsonify({"error": "Book not found in collection"}), 404
        
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Book removed from collection"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/public', methods=['GET'])
def get_public_collections():
    """Browse public collections."""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        collections = Collection.query.filter_by(is_public=True).order_by(
            Collection.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        total = Collection.query.filter_by(is_public=True).count()
        
        result = []
        for c in collections:
            collection_data = c.to_dict()
            user = User.query.get(c.user_id)
            collection_data['owner_username'] = user.username if user else "Unknown"
            result.append(collection_data)
        
        return jsonify({"collections": result, "total": total, "limit": limit, "offset": offset}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== BOOK REVIEWS & RATINGS ENDPOINTS ====================

@app.route('/api/v1/reviews', methods=['POST'])
@jwt_required()
def create_or_update_review():
    """Create or update a book review (requires JWT)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(ReviewRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized access to another user's reviews"}), 403
    
    try:
        book = Book.query.filter_by(google_books_id=validated_data.google_books_id).first()
        if not book:
            book = Book(
                google_books_id=validated_data.google_books_id,
                title=getattr(validated_data, 'title', 'Unknown'),
                authors=getattr(validated_data, 'authors', ''),
                thumbnail=getattr(validated_data, 'thumbnail', '')
            )
            db.session.add(book)
            db.session.flush()
        
        existing_review = Review.query.filter_by(user_id=validated_data.user_id, book_id=book.id).first()
        
        if existing_review:
            existing_review.rating = validated_data.rating
            existing_review.review_text = validated_data.review_text or ''
            review = existing_review
            message = "Review updated successfully"
        else:
            review = Review(
                user_id=validated_data.user_id,
                book_id=book.id,
                rating=validated_data.rating,
                review_text=validated_data.review_text or ''
            )
            db.session.add(review)
            message = "Review created successfully"
        
        db.session.commit()
        return jsonify({"message": message, "review": review.to_dict()}), 201 if not existing_review else 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/reviews/<book_id>', methods=['GET'])
def get_book_reviews(book_id):
    """Get all reviews for a book (public endpoint)."""
    try:
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        reviews = Review.query.filter_by(book_id=book.id).order_by(Review.created_at.desc()).all()
        
        total_rating = sum(r.rating for r in reviews)
        average_rating = round(total_rating / len(reviews), 1) if reviews else 0
        
        return jsonify({
            "book_id": book.id,
            "google_books_id": book.google_books_id,
            "title": book.title,
            "authors": book.authors,
            "thumbnail": book.thumbnail,
            "average_rating": average_rating,
            "total_reviews": len(reviews),
            "reviews": [review.to_dict() for review in reviews]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/users/<user_id>/reviews', methods=['GET'])
@jwt_required()
def get_user_reviews(user_id):
    """Get user's reviews (requires JWT)."""
    current_user_id = get_jwt_identity()
    
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized - you can only view your own reviews"}), 403
    
    try:
        reviews = Review.query.filter_by(user_id=user_id).order_by(Review.created_at.desc()).all()
        return jsonify({"user_id": user_id, "total_reviews": len(reviews), "reviews": [review.to_dict() for review in reviews]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_review(review_id):
    """Delete a review (requires JWT)."""
    current_user_id = get_jwt_identity()
    
    try:
        review = Review.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        
        if str(review.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - you can only delete your own reviews"}), 403
        
        db.session.delete(review)
        db.session.commit()
        return jsonify({"message": "Review deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== PRICE ALERT ENDPOINTS ====================

@app.route('/api/v1/books/<book_id>/alert', methods=['POST'])
@jwt_required()
def create_price_alert(book_id):
    """Create a price alert for a book (requires JWT)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(SetPriceAlertRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    if str(validated_data.user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized access to another user's alerts"}), 403
    
    try:
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        shelf_item = ShelfItem.query.get(validated_data.shelf_item_id)
        if not shelf_item:
            return jsonify({"error": "Shelf item not found"}), 404
        
        if str(shelf_item.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - shelf item belongs to another user"}), 403
        
        if shelf_item.book_id != book.id:
            return jsonify({"error": "Shelf item does not match the specified book"}), 400
        
        result = price_tracker.create_price_alert(
            user_id=validated_data.user_id,
            shelf_item_id=validated_data.shelf_item_id,
            target_price=validated_data.target_price
        )
        
        if result.get('success'):
            return jsonify({"message": "Price alert created successfully", "alert": result['alert']}), 201
        else:
            return jsonify({"error": result.get('error', 'Failed to create price alert')}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/books/<book_id>/prices', methods=['GET'])
@jwt_required()
def get_price_history(book_id):
    """Get price history for a book (requires JWT)."""
    retailer = request.args.get('retailer')
    limit = request.args.get('limit', 30, type=int)
    
    if limit < 1 or limit > 100:
        limit = 30
    
    try:
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        history = price_tracker.get_price_history(book_id=book.id, retailer=retailer, limit=limit)
        latest_prices = price_tracker.get_latest_prices(book.id)
        
        return jsonify({
            "book_id": book.id,
            "google_books_id": book.google_books_id,
            "title": book.title,
            "authors": book.authors,
            "price_history": history,
            "latest_prices": latest_prices
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts', methods=['GET'])
@jwt_required()
def get_user_alerts():
    """Get user's price alerts (requires JWT)."""
    current_user_id = get_jwt_identity()
    user_id = request.args.get('user_id', type=int)
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized - you can only view your own alerts"}), 403
    
    try:
        alerts = price_tracker.get_user_alerts(user_id=user_id, active_only=active_only)
        return jsonify({"user_id": user_id, "active_only": active_only, "total_alerts": len(alerts), "alerts": alerts}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts/<int:alert_id>', methods=['DELETE'])
@jwt_required()
def delete_price_alert(alert_id):
    """Delete a price alert (requires JWT)."""
    current_user_id = get_jwt_identity()
    
    try:
        alert = PriceAlert.query.get(alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        
        if str(alert.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - you can only delete your own alerts"}), 403
        
        result = price_tracker.delete_price_alert(alert_id=alert_id, user_id=current_user_id)
        
        if result.get('success'):
            return jsonify({"message": "Price alert deleted successfully"}), 200
        else:
            return jsonify({"error": result.get('error', 'Failed to delete price alert')}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


with app.app_context():
    db.create_all()

@app.route('/api/books', methods=['GET'])
def get_books():
    query = request.args.get('q')
    max_results = request.args.get('maxResults', 10)

    API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY")
    url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults={max_results}&key={API_KEY}"

    try:
        response = requests.get(url)
        data = response.json()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": "Failed to fetch books"}), 500

if __name__ == '__main__':
    server_config = app_config.server
    
    if server_config.debug:
        logger.info("--- BIBLIODRIFT MOOD ANALYSIS SERVER STARTING ON PORT %d ---", server_config.port)
        logger.info("Environment: %s", app_config.get_environment_name())
        logger.info("Available endpoints:")
        logger.info("  POST /api/v1/generate-note - Generate AI book notes")
        logger.info("  POST /api/v1/category-books - Get category-specific book recommendations")
        if MOOD_ANALYSIS_AVAILABLE:
            logger.info("  POST /api/v1/analyze-mood - Analyze book mood from GoodReads")
            logger.info("  POST /api/v1/mood-tags - Get mood tags for a book")
        else:
            logger.warning("  [DISABLED] Mood analysis endpoints (missing dependencies)")
        logger.info("  POST /api/v1/mood-search - Search books by mood/vibe")
        logger.info("  POST /api/v1/chat - Chat with bookseller")
        logger.info("  GET  /api/v1/health - Health check")

    app.run(debug=server_config.debug, port=server_config.port, host=server_config.host)


    