# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, redirect, url_for
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, set_access_cookies, unset_jwt_cookies
)
from flask_limiter import Limiter
from flask_limiter.errors import RateLimitExceeded
from flask_limiter.util import get_remote_address
from sqlalchemy.orm import joinedload
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf, CSRFError
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
from spine_generator import create_spine
import os
import requests
import secrets
from urllib.parse import urlencode
from werkzeug.utils import secure_filename
import magic

import logging
from datetime import datetime, timedelta, timezone
from sanitizer import sanitize_payload
from reader_identity.routes import reader_identity_bp

# Load environment variables from config directory based on APP_ENV
env = os.getenv('APP_ENV', 'development')
env_path = os.path.join(os.path.dirname(__file__), '..', 'config', f'.env.{env}')
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
elif os.path.exists(backend_env_path):
    load_dotenv(backend_env_path)
else:
    load_dotenv()

from config import app_config, setup_logging, validate_required_env_vars
from ai_service import generate_book_note, get_ai_recommendations, get_category_books, get_book_mood_tags_safe, generate_chat_response, llm_service, get_vibe_recommendations
from models import db, User, Book, ShelfItem, BookNote, ReadingGoal, ReadingStats, Collection, CollectionItem, PriceHistory, PriceAlert, Review, Bookmark, register_user, login_user
from price_tracker import get_price_tracker
from cache_service import cache_service
from validators import (
    validate_request,
    validate_schema,
    validate_google_books_id,
    AnalyzeMoodRequest,
    MoodTagsRequest,
    MoodSearchRequest,
    VibeCheckRequest,
    GenerateNoteRequest,
    ChatRequest,
    CategoryBooksRequest,
    AddToLibraryRequest,
    UpdateLibraryItemRequest,
    SyncLibraryRequest,
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    SetGoalRequest,
    GetStatsRequest,
    CollectionRequest,
    UpdateCollectionRequest,
    AddToCollectionRequest,
    ReviewRequest,
    BookmarkRequest,
    UpdateBookmarkRequest,
    SetPriceAlertRequest,
    GetPriceHistoryRequest,
    GetAlertsRequest,
    format_validation_errors,
    validate_jwt_secret,
    is_production_mode
)
from password_reset_service import (
    FORGOT_PASSWORD_MESSAGE,
    request_password_reset,
    reset_password_with_token,
)
from email_service import (
    build_password_reset_url,
    is_email_configured,
    send_password_reset_email,
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

# =====================================================================
# LOGGING INITIALIZATION
# =====================================================================
logger = setup_logging(app_config)
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
# =====================================================================
app = Flask(__name__, static_folder='.', static_url_path='')
app.register_blueprint(reader_identity_bp)

# Validate required environment variables at startup
validate_required_env_vars()

# Apply configuration to Flask app
app.config.update(app_config.flask_config)

# =====================================================================
# CSRF PROTECTION
# =====================================================================
csrf = CSRFProtect(app)

# Initialize JWT Manager
jwt = JWTManager(app)

DEFAULT_CORS_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5000",
    "http://localhost:5000",
]
ALLOWED_CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
ALLOWED_CORS_HEADERS = [
    "Content-Type",
    "Authorization",
    "X-CSRF-TOKEN",
    "X-CSRF-Token",
    "X-Requested-With",
    "Accept",
]


def _load_cors_origins() -> list[str]:
    """Load an explicit CORS allowlist from the environment or defaults."""
    if is_production_mode():
        frontend_url = os.getenv("FRONTEND_URL", "https://bibliodrift.com")
        raw_origins = os.getenv("ALLOWED_ORIGINS", frontend_url)
        origins = [o.strip() for o in raw_origins.split(",") if o.strip() and o.strip() != "*"]
        return origins if origins else [frontend_url]

    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    if raw_origins.strip():
        return [o.strip() for o in raw_origins.split(",") if o.strip()]
    return DEFAULT_CORS_ORIGINS


def _apply_security_headers(response):
    """Apply hardening headers to every API response."""
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.google.com; "
        "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https:; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "connect-src 'self' https: ws: wss:; "
        "frame-src 'self' https://books.google.com https://www.google.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "upgrade-insecure-requests"
    )
    response.headers['Content-Security-Policy'] = csp_policy
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # FIX: single authoritative Permissions-Policy — tests assert this exact value
    response.headers['Permissions-Policy'] = (
        'geolocation=(), microphone=(), camera=(), '
        'payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    )

    if request.path.endswith(('.gltf', '.obj', '.png')):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'

    return response


_cors_origins = _load_cors_origins()
CORS(
    app,
    supports_credentials=True,
    origins=_cors_origins,
    methods=ALLOWED_CORS_METHODS,
    allow_headers=ALLOWED_CORS_HEADERS,
    expose_headers=['Retry-After'],
    resources={r"/api/*": {"origins": _cors_origins}},
)

# Initialize cache service
cache_service.init_app(app)


def _resolve_rate_limit_principal() -> str:
    """Resolve a stable principal for per-user/session throttling."""
    try:
        user_id = get_jwt_identity()
        if user_id:
            return f"user:{user_id}"
    except Exception:
        pass

    session_hint = (
        request.cookies.get("access_token_cookie")
        or request.cookies.get("csrf_access_token")
        or request.cookies.get("session")
    )
    if session_hint:
        return f"session:{session_hint[:24]}"

    return "anon"


def rate_limit_key_func() -> str:
    """Composite key: IP + principal + endpoint."""
    endpoint = request.endpoint or request.path
    return f"{get_remote_address()}|{_resolve_rate_limit_principal()}|{endpoint}"


# =====================================================================
# RATE LIMITING — single handler, always sets Retry-After header
# =====================================================================
def _handle_rate_limit_exceeded(e: RateLimitExceeded):
    retry_after = int(getattr(e, "retry_after", 1) or 1)
    resp, status = rate_limit_error(retry_after)
    resp.headers['Retry-After'] = str(retry_after)   # FIX: ensure header is present
    return resp, status


limiter = Limiter(
    rate_limit_key_func,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)
app.register_error_handler(RateLimitExceeded, _handle_rate_limit_exceeded)


# =====================================================================
# ERROR HANDLERS
# =====================================================================
@app.errorhandler(404)
def page_not_found(e: Exception):
    if request.path.startswith('/api/'):
        return error_response(ErrorCodes.ENDPOINT_NOT_FOUND, "Endpoint not found", 404)
    return app.send_static_file('404.html'), 404


from werkzeug.exceptions import HTTPException
import traceback
import uuid
import json


@app.errorhandler(Exception)
def handle_unhandled_exception(e):
    if isinstance(e, HTTPException):
        logger.warning(
            f"HTTP Exception encountered: {e.code} {e.name} - {e.description} "
            f"| Path: {request.path}"
        )
        return jsonify({
            "success": False,
            "error_code": "HTTP_EXCEPTION",
            "error": e.description,
            "status_code": e.code
        }), e.code

    try:
        if isinstance(e, SQLAlchemyError):
            db.session.rollback()
    except Exception as db_rollback_error:
        logger.critical(f"Failed to rollback DB session: {db_rollback_error}")

    error_reference_id = str(uuid.uuid4())
    request_method = request.method
    request_url = request.url
    client_ip = request.remote_addr

    safe_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ['authorization', 'cookie', 'x-api-key']
    }

    log_payload = {
        "error_reference_id": error_reference_id,
        "exception_type": type(e).__name__,
        "exception_message": str(e),
        "request": {
            "method": request_method,
            "url": request_url,
            "client_ip": client_ip,
            "headers": safe_headers,
            "query_parameters": dict(request.args)
        }
    }

    logger.error(
        f"[ERROR REF: {error_reference_id}] Unhandled Exception: {type(e).__name__} "
        f"at {request_method} {request_url}\n"
        f"Details: {json.dumps(log_payload, indent=2)}",
        exc_info=True
    )

    is_prod = True
    try:
        if hasattr(app_config, 'is_production'):
            is_prod = app_config.is_production()
        elif hasattr(app_config, 'flask_config'):
            is_prod = app_config.flask_config.get('ENV') == 'production'
    except Exception:
        is_prod = True

    response_data = {
        "success": False,
        "error_code": "INTERNAL_SERVER_ERROR",
        "error": "An unexpected internal server error occurred.",
        "message": "Our team has been notified. Please try again later.",
        "reference_id": error_reference_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if not is_prod:
        response_data["_debug"] = {
            "exception": type(e).__name__,
            "message": str(e),
            "traceback": traceback.format_exc().splitlines()
        }

    response = jsonify(response_data)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response, 500


from sqlalchemy.exc import SQLAlchemyError as _SQLAlchemyError


@app.errorhandler(_SQLAlchemyError)
def handle_sqlalchemy_exception(e):
    try:
        db.session.rollback()
    except Exception as rollback_err:
        logger.critical(f"Failed to rollback DB session during SQLAlchemyError handling: {rollback_err}")

    error_reference_id = str(uuid.uuid4())
    logger.error(
        f"[DB ERROR REF: {error_reference_id}] Database Exception: {type(e).__name__} "
        f"at {request.method} {request.path}\nMessage: {str(e)}",
        exc_info=True
    )

    is_prod = True
    try:
        if hasattr(app_config, 'is_production'):
            is_prod = app_config.is_production()
    except Exception:
        is_prod = True

    response_data = {
        "success": False,
        "error_code": "DATABASE_ERROR",
        "error": "A database operation failed.",
        "message": "The issue has been logged and our team is investigating.",
        "reference_id": error_reference_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if not is_prod:
        response_data["_debug"] = {
            "exception": type(e).__name__,
            "message": "Database error details are suppressed for security, see logs.",
            "traceback": traceback.format_exc().splitlines()
        }

    response = jsonify(response_data)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response, 500


@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    logger.warning(f"CSRF Validation Failed: {e.description} | Remote IP: {request.remote_addr}")
    return jsonify({
        "success": False,
        "error": "CSRF_VALIDATION_FAILED",
        "message": f"Security token validation failed: {e.description}. Please refresh the page.",
        "code": 400
    }), 400


@app.after_request
def add_security_headers(response):
    return _apply_security_headers(response)


# =====================================================================
# CUSTOM SLIDING-WINDOW RATE LIMITER (for decorator-based limits)
# =====================================================================
RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', '60'))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '30'))

_request_log = defaultdict(deque)
_request_calls = 0


def _cleanup_expired_keys(cutoff: float) -> None:
    stale_keys = [key for key, dq in _request_log.items() if not dq or dq[-1] <= cutoff]
    for key in stale_keys:
        _request_log.pop(key, None)


def _rate_limited(endpoint: str) -> tuple[bool, int]:
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
    """Decorator to apply sliding-window rate limiting to an endpoint."""
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
                response.headers['Retry-After'] = str(retry_after)
                return response
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__
        return wrapped
    return decorator


# Initialize AI service if available
if MOOD_ANALYSIS_AVAILABLE:
    ai_service = AIBookService()


# =====================================================================
# JWT SECRET VALIDATION AT STARTUP
# =====================================================================
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


# =====================================================================
# ENDPOINTS
# =====================================================================

@app.route('/api/v1/csrf-token', methods=['GET'])
def get_csrf_token():
    token = generate_csrf()
    return success_response(data={"csrf_token": token})


@app.route('/api/v1/health', methods=['GET'])
def health_check():
    from sqlalchemy import text
    import time as _time

    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": app_config.get_environment_name(),
        "version": "1.0.0",
        "maintenance_mode": os.getenv("MAINTENANCE_MODE", "false").lower() == "true"
    }

    db_status = "unknown"
    db_latency_ms = 0
    try:
        start_time = _time.time()
        db.session.execute(text("SELECT 1"))
        db_latency_ms = round((_time.time() - start_time) * 1000, 2)
        db_status = "connected"
    except Exception as e:
        logger.error(f"Health Check: Database connection failed: {e}")
        db_status = "disconnected"
        health_status["status"] = "degraded"
        if not app_config.is_production():
            health_status["db_error"] = str(e)

    redis_status = "unknown"
    try:
        if hasattr(cache_service, 'redis_client') and cache_service.redis_client:
            redis_status = "connected" if cache_service.redis_client.ping() else "unresponsive"
            if redis_status == "unresponsive":
                health_status["status"] = "degraded"
        else:
            redis_status = "disabled"
    except Exception as e:
        logger.error(f"Health Check: Redis connection failed: {e}")
        redis_status = "disconnected"
        health_status["status"] = "degraded"

    health_status["services"] = {
        "database": {"status": db_status, "latency_ms": db_latency_ms},
        "redis_cache": {"status": redis_status}
    }

    if not app_config.is_production():
        ai_services_state = {
            "openai_configured": bool(app_config.ai_service.openai_api_key),
            "groq_configured": bool(app_config.ai_service.groq_api_key),
            "gemini_configured": bool(app_config.ai_service.gemini_api_key),
            "google_books_configured": bool(app_config.ai_service.google_books_api_key)
        }
        is_using_dummy_keys = (
            app_config.ai_service.openai_api_key == 'test-dummy-openai-key' or
            app_config.ai_service.groq_api_key == 'test-dummy-groq-key' or
            app_config.email.api_key == 'test-dummy-email-key'
        )
        health_status["diagnostics"] = {
            "db_url_scheme": str(app_config.database.url).split("://")[0] if app_config.database.url else "none",
            "rate_limiting_enabled": app_config.rate_limit.enabled,
            "log_level": app_config.logging.level,
            "ai_services": ai_services_state,
            "is_using_dummy_keys": is_using_dummy_keys,
            "security": {
                "csrf_enabled": app.config.get('WTF_CSRF_ENABLED', False),
                "cors_origins": _cors_origins,
                "jwt_cookie_secure": app.config.get('JWT_COOKIE_SECURE', False)
            }
        }

    http_status = 200 if health_status["status"] == "healthy" else 503
    if health_status["maintenance_mode"]:
        http_status = 503
        health_status["status"] = "maintenance"
        health_status["message"] = "System is currently undergoing scheduled maintenance."

    return jsonify(health_status), http_status


@app.route('/')
def index():
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
            "POST /api/v1/category-books": "Get AI-curated books for a specific shelf category",
            "POST /api/v1/reader-archetype": "Generate AI reader archetype",
        },
        "note": "All endpoints except / and /api/v1/health require POST requests with JSON body",
    }

    if MOOD_ANALYSIS_AVAILABLE:
        endpoints_info["endpoints"]["POST /api/v1/analyze-mood"] = "Analyze book mood from GoodReads"
        endpoints_info["endpoints"]["POST /api/v1/mood-tags"] = "Get mood tags for a book"
    else:
        endpoints_info["note"] += " | Mood analysis endpoints disabled (missing dependencies)"

    return jsonify(endpoints_info)


@app.route('/api/v1/analyze-mood', methods=['POST'])
@limiter.limit("10 per minute")
@validate_schema(AnalyzeMoodRequest)
def handle_analyze_mood(validated_data):
    if not MOOD_ANALYSIS_AVAILABLE:
        return service_unavailable_error("Mood analysis not available - missing dependencies")
    try:
        mood_analysis = ai_service.analyze_book_mood(validated_data.title, validated_data.author)
        if mood_analysis:
            return success_response(data={"mood_analysis": mood_analysis})
        return not_found_error("Mood analysis for this book")
    except Exception as e:
        logger.error(f"Error in handle_analyze_mood: {str(e)}", exc_info=True)
        return internal_error(str(e))


@app.route('/api/v1/mood-tags', methods=['POST'])
@limiter.limit("10 per minute")
@validate_schema(MoodTagsRequest)
def handle_mood_tags(validated_data):
    from exceptions import LLMCircuitBreakerOpenError, AIServiceException, ValidationException, InvalidInputError
    from error_responses import handle_exception
    try:
        mood_tags = get_book_mood_tags_safe(validated_data.title, validated_data.author)
        return success_response(data={"mood_tags": mood_tags})
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
@limiter.limit("10 per minute")
@validate_schema(MoodSearchRequest)
def handle_mood_search(validated_data):
    from exceptions import LLMCircuitBreakerOpenError, AIServiceException, ValidationException, InvalidInputError
    from error_responses import handle_exception
    try:
        mood_query = validated_data.query
        try:
            from mood_analysis.mood_query_parser import parse_mood_query, get_recommendation_prompt
            parsed_query = parse_mood_query(mood_query)
            enhanced_prompt = get_recommendation_prompt(mood_query)
            recommendations = get_ai_recommendations(enhanced_prompt)
            return success_response(data={
                "recommendations": recommendations,
                "query": mood_query,
                "parsed_mood": parsed_query.to_dict()
            })
        except ImportError:
            recommendations = get_ai_recommendations(mood_query)
            return success_response(data={"recommendations": recommendations, "query": mood_query})
    except SQLAlchemyError as e:
        logger.error(f"Database error searching mood: {e}")
        return internal_error("A database error occurred during search.")
    except Exception as e:
        logger.error(f"Unexpected error searching mood: {e}")
        return internal_error(str(e))


@app.route('/api/v1/vibe-check', methods=['POST'])
@rate_limit('vibe_check')
@validate_schema(VibeCheckRequest)
def handle_vibe_check(validated_data):
    try:
        books = get_category_books(
            category=validated_data.category,
            vibe_description=validated_data.vibe_description,
            count=validated_data.count,
        )
        if not books:
            return service_unavailable_error(
                "Could not generate book recommendations right now. Please try again shortly."
            )
        return success_response(data={"category": validated_data.category, "books": books})
    except Exception as e:
        logger.error(f"Error in handle_vibe_check: {str(e)}", exc_info=True)
        return internal_error(str(e))


@app.route('/api/v1/books/purchase-links', methods=['GET'])
@limiter.limit("20 per minute")
def handle_purchase_links():
    """Get purchase links for a book."""
    try:
        title = request.args.get('title')
        author = request.args.get('author', '')
        isbn = request.args.get('isbn', '')

        if not title:
            return jsonify({'success': False, 'error': 'Title is required'}), 400

        from purchase_links import PurchaseManager
        manager = PurchaseManager()
        links = manager.get_quick_links(title=title, author=author, isbn=isbn)
        return success_response(data={"links": links})
    except Exception as e:
        logger.error(f"Error getting purchase links: {str(e)}", exc_info=True)
        return internal_error(str(e))


@app.route('/api/v1/generate-note', methods=['POST'])
@limiter.limit("10 per minute")
@validate_schema(GenerateNoteRequest)
def handle_generate_note(validated_data):
    from exceptions import LLMCircuitBreakerOpenError, AIServiceException, DatabaseQueryError, DatabaseIntegrityError, ValidationException, InvalidInputError
    from error_responses import handle_exception
    try:
        description = validated_data.description
        title = validated_data.title
        author = validated_data.author
        vibe = getattr(validated_data, 'vibe', 'cozy discovery')

        cached_note = BookNote.query.filter_by(book_title=title, book_author=author).first()
        if cached_note:
            return success_response(data={"blurb": cached_note.content})

        recommendation = generate_book_note(description, title, author, vibe)

        try:
            if recommendation and isinstance(recommendation, dict):
                blurb_content = recommendation.get('blurb', str(recommendation))
                new_note = BookNote(book_title=title, book_author=author, content=blurb_content)
                db.session.add(new_note)
                db.session.commit()
        except SQLAlchemyError as e:
            logger.error(f"Database error caching note: {e}")
            db.session.rollback()
        except Exception as e:
            logger.error(f"Unexpected error caching note: {e}")
            db.session.rollback()

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
@limiter.limit("10 per minute")
@validate_schema(ChatRequest)
def handle_chat(validated_data):
    from exceptions import LLMCircuitBreakerOpenError, AIServiceException, ValidationException, InvalidInputError
    from error_responses import handle_exception
    try:
        user_message = validated_data.message
        conversation_history = validated_data.history or []

        validated_history = []
        for msg in conversation_history:
            if hasattr(msg, 'dict'):
                validated_history.append(msg.dict())
            else:
                validated_history.append(msg)

        response = generate_chat_response(user_message, validated_history)
        recommendations = get_ai_recommendations(user_message)

        return success_response(data={
            "response": response,
            "recommendations": recommendations,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except (LLMCircuitBreakerOpenError, AIServiceException) as e:
        logger.error(f"AI service error in handle_chat: {e}", exc_info=True)
        return handle_exception(e, "handle_chat")
    except (ValidationException, InvalidInputError) as e:
        logger.warning(f"Validation error in handle_chat: {e}")
        return handle_exception(e, "handle_chat")
    except Exception as e:
        logger.error(f"Unexpected error in handle_chat: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "handle_chat")


# =====================================================================
# LIBRARY ENDPOINTS
# =====================================================================

@app.route('/api/v1/library', methods=['POST'])
@limiter.limit("20 per minute")
@jwt_required()
@validate_schema(AddToLibraryRequest)
def add_to_library(validated_data):
    from sqlalchemy.exc import IntegrityError
    from exceptions import DatabaseQueryError, DatabaseIntegrityError, ValidationException
    from error_responses import handle_exception
    try:
        current_user_id = get_jwt_identity()

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

            try:
                author_str = ", ".join(validated_data.authors) if isinstance(validated_data.authors, list) else validated_data.authors
                clean_id = "".join([c if c.isalnum() else "_" for c in validated_data.title.lower().strip()])
                create_spine(validated_data.title, author_str, clean_id)
            except Exception as spine_err:
                logger.error(f"Spine generation failed during direct add: {spine_err}")

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


@app.route('/api/v1/library/<int:user_id>', methods=['GET'])
@jwt_required()
def get_library(user_id):
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Cannot access another user's library")
    try:
        items = ShelfItem.query.options(joinedload(ShelfItem.book)).filter_by(user_id=user_id).all()
        return success_response(data={"library": [item.to_dict() for item in items]})
    except Exception as e:
        return internal_error(str(e))


@app.route('/api/v1/library/<int:item_id>', methods=['PUT'])
@jwt_required()
@validate_schema(UpdateLibraryItemRequest)
def update_library_item(item_id, validated_data):
    try:
        current_user_id = get_jwt_identity()
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
    current_user_id = get_jwt_identity()
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return not_found_error("Library item")

        if str(item.user_id) != str(current_user_id):
            return forbidden_error("Cannot delete another user's library item")

        item.soft_delete()
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
migrate = Migrate(app, db)
price_tracker = get_price_tracker(db)


@app.route('/api/v1/library/sync', methods=['POST'])
@limiter.limit("20 per minute")
@jwt_required()
@validate_schema(SyncLibraryRequest)
def sync_library(validated_data):
    try:
        current_user_id = get_jwt_identity()
        user_id = validated_data.user_id
        raw_items = validated_data.items

        if str(user_id) != str(current_user_id):
            return forbidden_error("Cannot sync to another user's library")

        invalid_ids = []
        for index, item_data in enumerate(raw_items):
            if not isinstance(item_data, dict):
                continue
            raw_google_id = item_data.get('id')
            if raw_google_id is None or not validate_google_books_id(str(raw_google_id).strip()):
                invalid_ids.append((index, raw_google_id))

        if invalid_ids:
            for index, bad_value in invalid_ids:
                logger.warning(
                    "Rejected sync payload with invalid Google Books ID. user_id=%s item_index=%s id=%r",
                    user_id, index, bad_value
                )
            return validation_error("Invalid Google Books ID format in sync payload")

        items = sanitize_payload(raw_items)
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

                        try:
                            sync_title = volume_info.get('title', 'Untitled')
                            clean_id = "".join([c if c.isalnum() else "_" for c in sync_title.lower().strip()])
                            create_spine(sync_title, authors, clean_id)
                        except Exception as spine_err:
                            logger.error(f"Spine generation failed during bulk sync: {spine_err}")

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


# =====================================================================
# AUTH ENDPOINTS
# =====================================================================

@app.route('/api/v1/register', methods=['POST'])
@limiter.limit("5 per 10 seconds")
@validate_schema(RegisterRequest)
def register(validated_data):
    try:
        username = validated_data.username
        email = validated_data.email
        password = validated_data.password

        if User.query.filter((User.username == username) | (User.email == email)).first():
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
@limiter.limit("5 per 10 seconds")
@validate_schema(LoginRequest)
def login(validated_data):
    from exceptions import DatabaseQueryError, ValidationException
    from error_responses import handle_exception
    try:
        username_or_email = validated_data.username
        password = validated_data.password

        user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()

        if user and user.check_password(password):
            access_token = create_access_token(identity=str(user.id))
            resp, status = success_response(
                data={
                    "message": "Login successful",
                    "user": {"id": user.id, "username": user.username, "email": user.email}
                }
            )
            set_access_cookies(resp, access_token)
            return resp, status

        if user and not user.password_hash:
            return auth_error("This account uses Google sign-in. Please continue with Google.")

        return auth_error("Invalid username or password")
    except Exception as e:
        logger.error(f"Unexpected error in login: {type(e).__name__}: {e}", exc_info=True)
        return handle_exception(e, "login")


@app.route('/api/v1/auth/google', methods=['GET'])
@limiter.limit("10 per minute")
def google_login():
    google_client_id = app.config.get('GOOGLE_CLIENT_ID')
    google_redirect_uri = app.config.get('GOOGLE_OAUTH_REDIRECT_URI') or url_for('google_oauth_callback', _external=True)
    google_scope = app.config.get('GOOGLE_OAUTH_SCOPE', 'openid email profile https://www.googleapis.com/auth/books')

    if not google_client_id:
        return internal_error("Google OAuth client ID is not configured.")

    oauth_state = secrets.token_urlsafe(32)
    params = {
        'client_id': google_client_id,
        'redirect_uri': google_redirect_uri,
        'response_type': 'code',
        'scope': google_scope,
        'state': oauth_state,
        'access_type': 'offline',
        'prompt': 'select_account'
    }

    response = redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")
    response.set_cookie(
        'google_oauth_state', oauth_state,
        httponly=True, secure=app_config.is_production(), samesite='Lax', max_age=600
    )
    return response


@app.route('/api/v1/auth/google/callback', methods=['GET'])
@limiter.limit("10 per minute")
def google_oauth_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    stored_state = request.cookies.get('google_oauth_state')
    google_client_id = app.config.get('GOOGLE_CLIENT_ID')
    google_client_secret = app.config.get('GOOGLE_CLIENT_SECRET')
    google_redirect_uri = app.config.get('GOOGLE_OAUTH_REDIRECT_URI') or url_for('google_oauth_callback', _external=True)
    frontend_redirect_url = app.config.get('GOOGLE_OAUTH_FRONTEND_REDIRECT_URL', 'http://127.0.0.1:5500/frontend/pages/library.html')

    if not code:
        return auth_error("Google OAuth authorization code is missing.")
    if not stored_state or not state or stored_state != state:
        return auth_error("Invalid Google OAuth state.")
    if not google_client_id or not google_client_secret:
        return internal_error("Google OAuth client credentials are not configured.")

    try:
        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code, 'client_id': google_client_id,
                'client_secret': google_client_secret,
                'redirect_uri': google_redirect_uri, 'grant_type': 'authorization_code'
            }, timeout=10
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            return auth_error("Google OAuth access token is missing.")

        userinfo_response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}, timeout=10
        )
        userinfo_response.raise_for_status()
        google_user = userinfo_response.json()

        google_id = google_user.get('sub')
        email = google_user.get('email')
        username = google_user.get('name') or (email.split('@')[0] if email else None)

        if not google_id or not email or not username:
            return auth_error("Google account did not provide required profile information.")

        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_id = google_id
                user.auth_provider = 'google'
                user.profile_picture = google_user.get('picture')
                user.email_verified = bool(google_user.get('email_verified'))
            else:
                base_username = ''.join(ch for ch in username.strip().replace(' ', '_') if ch.isalnum() or ch == '_')[:50]
                if len(base_username) < 3:
                    base_username = email.split('@')[0][:50]

                unique_username = base_username
                suffix = 1
                while User.query.filter_by(username=unique_username).first():
                    suffix_text = str(suffix)
                    unique_username = f"{base_username[:50 - len(suffix_text)]}{suffix_text}"
                    suffix += 1

                user = User(
                    username=unique_username, email=email, google_id=google_id,
                    auth_provider='google', profile_picture=google_user.get('picture'),
                    email_verified=bool(google_user.get('email_verified'))
                )
                db.session.add(user)

        db.session.commit()
        jwt_access_token = create_access_token(identity=str(user.id))
        response = redirect(frontend_redirect_url)
        set_access_cookies(response, jwt_access_token)
        response.delete_cookie('google_oauth_state')
        return response
    except requests.RequestException as e:
        logger.error(f"Google OAuth request failed: {e}", exc_info=True)
        return service_unavailable_error("Google authentication service is unavailable.")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Google OAuth callback failed: {e}", exc_info=True)
        return internal_error("Google authentication failed.")


@app.route('/api/v1/auth/verify', methods=['GET'])
@jwt_required()
def verify_auth():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return auth_error("Invalid or expired session.")
    return jsonify({"user": user.to_dict()}), 200


@app.route('/api/v1/logout', methods=['POST'])
def logout():
    resp, status = success_response(message="Logout successful")
    unset_jwt_cookies(resp)
    return resp, status


# =====================================================================
# AVATAR UPLOAD
# =====================================================================
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'avatars')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/v1/users/<int:user_id>/avatar', methods=['POST'])
@jwt_required()
def upload_avatar(user_id):
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Unauthorized access to another user's profile")

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Allowed file types are png, jpg, jpeg, gif"}), 400
    if file.content_type not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "Invalid Content-Type"}), 400

    file_bytes = file.read(2048)
    file.seek(0)

    try:
        mime = magic.Magic(mime=True)
        file_mime = mime.from_buffer(file_bytes)
        if file_mime not in ALLOWED_MIME_TYPES:
            return jsonify({"error": "Invalid file content (magic number mismatch)"}), 400
    except Exception as e:
        logger.error(f"Error validating file magic numbers: {e}")
        return jsonify({"error": "Could not validate file format"}), 500

    filename = secure_filename(file.filename)
    unique_filename = f"user_{user_id}_{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

    try:
        file.save(filepath)
        user = User.query.get(user_id)
        if user:
            user.profile_picture = f"/uploads/avatars/{unique_filename}"
            db.session.commit()
        return jsonify({
            "message": "Avatar uploaded successfully",
            "profile_picture": f"/uploads/avatars/{unique_filename}"
        }), 200
    except Exception as e:
        logger.error(f"Failed to save avatar: {e}")
        return jsonify({"error": "Failed to save file"}), 500


# =====================================================================
# PASSWORD RESET ENDPOINTS
# =====================================================================

@app.route('/api/v1/auth/forgot-password', methods=['POST'])
@csrf.exempt
@limiter.limit("5 per minute")
@validate_schema(ForgotPasswordRequest)
def forgot_password(validated_data):
    """Request a password reset link (always returns a generic success message)."""
    try:
        plain_token = None
        try:
            plain_token = request_password_reset(validated_data.email)
        except SQLAlchemyError as e:
            logger.error("forgot-password database error: %s", e, exc_info=True)

        response_data = {"message": FORGOT_PASSWORD_MESSAGE}
        frontend_base = os.getenv('FRONTEND_ORIGIN', 'http://127.0.0.1:5500').rstrip('/')
        email_config = app_config.email

        if plain_token:
            reset_url = build_password_reset_url(plain_token, frontend_base)
            if is_email_configured(email_config):
                send_result = send_password_reset_email(
                    validated_data.email, reset_url, email_config,
                )
                if not send_result.ok:
                    logger.error(
                        "Password reset email not sent for %s: %s",
                        validated_data.email, send_result.detail,
                    )
            elif app_config.is_development():
                response_data["reset_url"] = reset_url
                logger.info(
                    "Dev password reset link for %s (email not configured): %s",
                    validated_data.email, reset_url,
                )
            elif app_config.is_production():
                logger.warning(
                    "Password reset token created but EMAIL_* is not configured; "
                    "user %s will not receive mail.", validated_data.email,
                )

        return success_response(data=response_data)
    except Exception as e:
        logger.error("forgot-password failed: %s", e, exc_info=True)
        return success_response(data={"message": FORGOT_PASSWORD_MESSAGE})


@app.route('/api/v1/auth/reset-password', methods=['POST'])
@csrf.exempt
@limiter.limit("5 per minute")
@validate_schema(ResetPasswordRequest)
def reset_password(validated_data):
    try:
        ok, message = reset_password_with_token(validated_data.token, validated_data.password)
        if not ok:
            return jsonify({"error": message}), 400
        return success_response(data={"message": message})
    except Exception as e:
        logger.error("reset-password failed: %s", e, exc_info=True)
        return internal_error("Unable to reset password.")


# =====================================================================
# READING STATS HELPERS
# =====================================================================

def _update_reading_stats(user_id, book):
    now = datetime.now(timezone.utc)
    stats = ReadingStats.query.filter_by(user_id=user_id, year=now.year, month=now.month).first()
    if not stats:
        stats = ReadingStats(user_id=user_id, year=now.year, month=now.month, books_completed=0, pages_read=0)
        db.session.add(stats)
    stats.books_completed += 1
    if book and book.page_count:
        stats.pages_read += book.page_count
    db.session.commit()


def _calculate_reading_streak(user_id):
    finished_items = ShelfItem.query.filter_by(
        user_id=user_id, shelf_type='finished'
    ).filter(ShelfItem.finished_at.isnot(None)).order_by(ShelfItem.finished_at.desc()).all()

    if not finished_items:
        return 0

    unique_dates = sorted(
        {item.finished_at.date() for item in finished_items}, reverse=True,
    )

    today = datetime.now(timezone.utc).date()
    most_recent = unique_dates[0]

    if (today - most_recent).days > 1:
        return 0

    streak = 1
    prev_date = most_recent

    for finish_date in unique_dates[1:]:
        days_diff = (prev_date - finish_date).days
        if days_diff == 1:
            streak += 1
            prev_date = finish_date
        else:
            break

    return streak


def _get_yearly_stats(user_id, year):
    stats = ReadingStats.query.filter_by(user_id=user_id, year=year).all()
    return {
        "total_books": sum(s.books_completed for s in stats),
        "total_pages": sum(s.pages_read for s in stats),
        "monthly": {s.month: s.books_completed for s in stats}
    }


# =====================================================================
# READING STATS ENDPOINTS
# =====================================================================

@app.route('/api/v1/stats/goal', methods=['POST'])
@jwt_required()
@validate_schema(SetGoalRequest)
def set_reading_goal(validated_data):
    current_user_id = get_jwt_identity()
    if str(validated_data.user_id) != str(current_user_id):
        return forbidden_error("Unauthorized")
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
    user_id = request.args.get('user_id', type=int)
    year = request.args.get('year', datetime.now(timezone.utc).year, type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Unauthorized")
    try:
        yearly_stats = _get_yearly_stats(user_id, year)
        current_streak = _calculate_reading_streak(user_id)
        goal = ReadingGoal.query.filter_by(user_id=user_id, year=year).first()
        now = datetime.now(timezone.utc)
        current_month_stats = ReadingStats.query.filter_by(user_id=user_id, year=year, month=now.month).first()
        return jsonify({
            "user_id": user_id, "year": year,
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
    year = request.args.get('year', datetime.now(timezone.utc).year, type=int)
    limit = request.args.get('limit', 10, type=int)
    try:
        from sqlalchemy import func
        stats_query = db.session.query(
            ReadingGoal.user_id, User.username, ReadingGoal.target_books,
            func.coalesce(func.sum(ReadingStats.books_completed), 0).label('total_books'),
            func.coalesce(func.sum(ReadingStats.pages_read), 0).label('total_pages')
        ).join(User, ReadingGoal.user_id == User.id).outerjoin(
            ReadingStats,
            (ReadingGoal.user_id == ReadingStats.user_id) & (ReadingStats.year == year)
        ).filter(ReadingGoal.year == year).group_by(
            ReadingGoal.user_id, User.username, ReadingGoal.target_books
        ).all()

        leaderboard = []
        for uid, username, target_books, total_books, total_pages in stats_query:
            tb = int(total_books)
            tp = int(total_pages)
            leaderboard.append({
                "user_id": uid, "username": username or "Unknown",
                "target_books": target_books, "books_completed": tb, "pages_read": tp,
                "progress_percentage": round((tb / target_books * 100), 1) if target_books > 0 else 0
            })

        leaderboard.sort(key=lambda x: x["books_completed"], reverse=True)
        return jsonify({"year": year, "leaderboard": leaderboard[:limit]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================================
# COLLECTIONS ENDPOINTS
# =====================================================================

@app.route('/api/v1/collections', methods=['POST'])
@jwt_required()
@validate_schema(CollectionRequest)
def create_collection(validated_data):
    current_user_id = get_jwt_identity()
    if str(validated_data.user_id) != str(current_user_id):
        return forbidden_error("Unauthorized")
    try:
        if Collection.query.filter_by(user_id=validated_data.user_id, name=validated_data.name).first():
            return jsonify({"error": "Collection with this name already exists"}), 409
        collection = Collection(
            user_id=validated_data.user_id, name=validated_data.name,
            description=validated_data.description or '', is_public=validated_data.is_public
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
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Unauthorized")
    try:
        collections = Collection.query.filter_by(user_id=user_id).order_by(Collection.created_at.desc()).all()
        return jsonify({"collections": [c.to_dict() for c in collections]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['GET'])
@jwt_required()
def get_collection(collection_id):
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")
        return jsonify({"collection": collection.to_dict(include_items=True)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
@jwt_required()
@validate_schema(UpdateCollectionRequest)
def update_collection(collection_id, validated_data):
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")
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
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")
        collection.soft_delete()
        return jsonify({"message": "Collection deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books', methods=['POST'])
@jwt_required()
@validate_schema(AddToCollectionRequest)
def add_book_to_collection(collection_id, validated_data):
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")

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

        if CollectionItem.query.filter_by(collection_id=collection_id, book_id=book.id).first():
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
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")
        items = CollectionItem.query.filter_by(collection_id=collection_id).order_by(CollectionItem.added_at.desc()).all()
        return jsonify({"collection": collection.to_dict(), "books": [item.to_dict() for item in items]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books/<int:book_id>', methods=['DELETE'])
@jwt_required()
def remove_book_from_collection(collection_id, book_id):
    current_user_id = get_jwt_identity()
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        if str(collection.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized")
        item = CollectionItem.query.filter_by(collection_id=collection_id, book_id=book_id).first()
        if not item:
            return jsonify({"error": "Book not found in collection"}), 404
        item.soft_delete()
        return jsonify({"message": "Book removed from collection"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/public', methods=['GET'])
def get_public_collections():
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        collections = Collection.query.filter_by(is_public=True).order_by(
            Collection.created_at.desc()
        ).offset(offset).limit(limit).all()
        total = Collection.query.filter_by(is_public=True).count()
        result = []
        for c in collections:
            d = c.to_dict()
            user = User.query.get(c.user_id)
            d['owner_username'] = user.username if user else "Unknown"
            result.append(d)
        return jsonify({"collections": result, "total": total, "limit": limit, "offset": offset}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================================
# REVIEWS ENDPOINTS
# =====================================================================

@app.route('/api/v1/reviews', methods=['POST'])
@jwt_required()
def create_or_update_review():
    data = request.json
    current_user_id = get_jwt_identity()
    is_valid, validated_data = validate_request(ReviewRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    if str(data['user_id']) != str(current_user_id):
        return forbidden_error("Unauthorized access to another user's reviews")
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
                user_id=validated_data.user_id, book_id=book.id,
                rating=validated_data.rating, review_text=validated_data.review_text or ''
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
    try:
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            if not validate_google_books_id(book_id):
                return validation_error("Invalid Google Books ID format")
            book = Book.query.filter_by(google_books_id=book_id).first()
        if not book:
            return jsonify({"error": "Book not found"}), 404
        reviews = Review.query.filter_by(book_id=book.id).order_by(Review.created_at.desc()).all()
        total_rating = sum(r.rating for r in reviews)
        average_rating = round(total_rating / len(reviews), 1) if reviews else 0
        return jsonify({
            "book_id": book.id, "google_books_id": book.google_books_id,
            "title": book.title, "authors": book.authors, "thumbnail": book.thumbnail,
            "average_rating": average_rating, "total_reviews": len(reviews),
            "reviews": [review.to_dict() for review in reviews]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/users/<user_id>/reviews', methods=['GET'])
@jwt_required()
def get_user_reviews(user_id):
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Unauthorized - you can only view your own reviews")
    try:
        reviews = Review.query.filter_by(user_id=user_id).order_by(Review.created_at.desc()).all()
        return jsonify({"user_id": user_id, "total_reviews": len(reviews), "reviews": [r.to_dict() for r in reviews]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_review(review_id):
    current_user_id = get_jwt_identity()
    try:
        review = Review.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        if str(review.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized - you can only delete your own reviews")
        review.soft_delete()
        return jsonify({"message": "Review deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# =====================================================================
# PRICE ALERT ENDPOINTS
# =====================================================================

@app.route('/api/v1/books/<book_id>/alert', methods=['POST'])
@limiter.limit("20 per minute")
@jwt_required()
def create_price_alert(book_id):
    data = request.json
    current_user_id = get_jwt_identity()
    is_valid, validated_data = validate_request(SetPriceAlertRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    if str(validated_data.user_id) != str(current_user_id):
        return forbidden_error("Unauthorized access to another user's alerts")
    try:
        book = Book.query.get(int(book_id)) if book_id.isdigit() else Book.query.filter_by(google_books_id=book_id).first()
        if not book_id.isdigit() and not validate_google_books_id(book_id):
            return validation_error("Invalid Google Books ID format")
        if not book:
            return jsonify({"error": "Book not found"}), 404
        shelf_item = ShelfItem.query.get(validated_data.shelf_item_id)
        if not shelf_item:
            return jsonify({"error": "Shelf item not found"}), 404
        if str(shelf_item.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized - shelf item belongs to another user")
        if shelf_item.book_id != book.id:
            return jsonify({"error": "Shelf item does not match the specified book"}), 400
        result = price_tracker.create_price_alert(
            user_id=validated_data.user_id,
            shelf_item_id=validated_data.shelf_item_id,
            target_price=validated_data.target_price
        )
        if result.get('success'):
            return jsonify({"message": "Price alert created successfully", "alert": result['alert']}), 201
        return jsonify({"error": result.get('error', 'Failed to create price alert')}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/books/<book_id>/prices', methods=['GET'])
@jwt_required()
def get_price_history(book_id):
    retailer = request.args.get('retailer')
    limit = min(max(request.args.get('limit', 30, type=int), 1), 100)
    try:
        book = Book.query.get(int(book_id)) if book_id.isdigit() else Book.query.filter_by(google_books_id=book_id).first()
        if not book:
            return jsonify({"error": "Book not found"}), 404
        history = price_tracker.get_price_history(book_id=book.id, retailer=retailer, limit=limit)
        latest_prices = price_tracker.get_latest_prices(book.id)
        if not history and not latest_prices:
            price_tracker.update_prices_for_book(book.id, book.google_books_id)
            history = price_tracker.get_price_history(book_id=book.id, retailer=retailer, limit=limit)
            latest_prices = price_tracker.get_latest_prices(book.id)
        return jsonify({
            "book_id": book.id, "google_books_id": book.google_books_id,
            "title": book.title, "authors": book.authors,
            "price_history": history, "latest_prices": latest_prices
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts', methods=['GET'])
@jwt_required()
def get_user_alerts():
    current_user_id = get_jwt_identity()
    user_id = request.args.get('user_id', type=int)
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if str(user_id) != str(current_user_id):
        return forbidden_error("Unauthorized - you can only view your own alerts")
    try:
        alerts = price_tracker.get_user_alerts(user_id=user_id, active_only=active_only)
        return jsonify({"user_id": user_id, "active_only": active_only, "total_alerts": len(alerts), "alerts": alerts}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts/<int:alert_id>', methods=['DELETE'])
@jwt_required()
def delete_price_alert(alert_id):
    current_user_id = get_jwt_identity()
    try:
        alert = PriceAlert.query.get(alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        if str(alert.user_id) != str(current_user_id):
            return forbidden_error("Unauthorized - you can only delete your own alerts")
        result = price_tracker.delete_price_alert(alert_id=alert_id, user_id=current_user_id)
        if result.get('success'):
            return jsonify({"message": "Price alert deleted successfully"}), 200
        return jsonify({"error": result.get('error', 'Failed to delete price alert')}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================================
# BOOKMARK ENDPOINTS
# =====================================================================

@app.route('/api/bookmarks', methods=['POST'])
@jwt_required()
@limiter.limit("20 per minute")
def create_bookmark():
    try:
        user_id = get_jwt_identity()
        payload = request.get_json()
        req = BookmarkRequest(**payload)

        book = Book.query.filter_by(id=req.book_id, is_deleted=False).first()
        if not book:
            return not_found_error("Book not found")

        existing = Bookmark.query.filter_by(user_id=user_id, book_id=req.book_id, is_deleted=False).first()
        if existing:
            return resource_exists_error("Bookmark already exists for this book")

        bookmark = Bookmark(user_id=user_id, book_id=req.book_id, page_number=req.page_number, notes=req.notes)
        db.session.add(bookmark)
        db.session.commit()
        logger.info(f"User {user_id} bookmarked book {req.book_id}")
        return success_response({"bookmark": bookmark.to_dict()}, "Bookmark created", 201)
    except ValueError as e:
        return validation_error(str(e))
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error creating bookmark: {e}")
        return internal_error("Failed to create bookmark")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error creating bookmark: {e}")
        return internal_error()


@app.route('/api/bookmarks/<int:bookmark_id>', methods=['GET'])
@jwt_required()
def get_bookmark(bookmark_id):
    try:
        user_id = get_jwt_identity()
        bookmark = Bookmark.query.filter_by(id=bookmark_id, user_id=user_id, is_deleted=False).first()
        if not bookmark:
            return not_found_error("Bookmark not found")
        return success_response({"bookmark": bookmark.to_dict()})
    except Exception as e:
        logger.error(f"Error fetching bookmark: {e}")
        return internal_error()


@app.route('/api/bookmarks', methods=['GET'])
@jwt_required()
def list_bookmarks():
    try:
        user_id = get_jwt_identity()
        bookmarks = Bookmark.query.filter_by(user_id=user_id, is_deleted=False).order_by(Bookmark.created_at.desc()).all()
        return success_response({"bookmarks": [b.to_dict() for b in bookmarks], "count": len(bookmarks)})
    except Exception as e:
        logger.error(f"Error listing bookmarks: {e}")
        return internal_error()


@app.route('/api/bookmarks/<int:bookmark_id>', methods=['PUT'])
@jwt_required()
@limiter.limit("20 per minute")
def update_bookmark(bookmark_id):
    try:
        user_id = get_jwt_identity()
        payload = request.get_json()
        req = UpdateBookmarkRequest(**payload)

        bookmark = Bookmark.query.filter_by(id=bookmark_id, user_id=user_id, is_deleted=False).first()
        if not bookmark:
            return not_found_error("Bookmark not found")

        if req.page_number is not None:
            bookmark.page_number = req.page_number
        if req.notes is not None:
            bookmark.notes = req.notes
        bookmark.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        logger.info(f"User {user_id} updated bookmark {bookmark_id}")
        return success_response({"bookmark": bookmark.to_dict()})
    except ValueError as e:
        return validation_error(str(e))
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error updating bookmark: {e}")
        return internal_error("Failed to update bookmark")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error updating bookmark: {e}")
        return internal_error()


@app.route('/api/bookmarks/<int:bookmark_id>', methods=['DELETE'])
@jwt_required()
@limiter.limit("20 per minute")
def delete_bookmark(bookmark_id):
    try:
        user_id = get_jwt_identity()
        bookmark = Bookmark.query.filter_by(id=bookmark_id, user_id=user_id, is_deleted=False).first()
        if not bookmark:
            return not_found_error("Bookmark not found")
        bookmark.soft_delete()
        logger.info(f"User {user_id} deleted bookmark {bookmark_id}")
        return success_response(None, "Bookmark deleted")
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error deleting bookmark: {e}")
        return internal_error("Failed to delete bookmark")
    except Exception as e:
        logger.error(f"Unexpected error deleting bookmark: {e}")
        return internal_error()


@app.route('/api/books/<int:book_id>/bookmarked', methods=['GET'])
@jwt_required()
def check_bookmark(book_id):
    try:
        user_id = get_jwt_identity()
        bookmark = Bookmark.query.filter_by(user_id=user_id, book_id=book_id, is_deleted=False).first()
        return success_response({
            "bookmarked": bookmark is not None,
            "bookmark": bookmark.to_dict() if bookmark else None
        })
    except Exception as e:
        logger.error(f"Error checking bookmark: {e}")
        return internal_error()


# =====================================================================
# DB INIT
# =====================================================================
with app.app_context():
    db.create_all()


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
