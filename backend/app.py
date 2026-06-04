# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO, emit
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
from backend.core.security.sanitizer import sanitize_payload
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

# Environment variables are now loaded centrally in backend/config.py
from config import app_config, setup_logging, validate_required_env_vars
from ai_service import generate_book_note, get_ai_recommendations, get_category_books, get_book_mood_tags_safe, generate_chat_response, generate_chat_response_stream, llm_service, get_vibe_recommendations
from models import db, User, Book, ShelfItem, BookNote, ReadingGoal, ReadingStats, Collection, CollectionItem, PriceHistory, PriceAlert, Review, register_user, login_user
from price_tracker import get_price_tracker
from cache_service import cache_service
from backend.core.validators.validators import (
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
from backend.core.responses.error_responses import (
    ErrorCodes, error_response, success_response,
    validation_error, missing_fields_error, invalid_json_error,
    auth_error, forbidden_error, unauthorized_access_error,
    not_found_error, resource_exists_error, rate_limit_error,
    internal_error, service_unavailable_error
)

# =====================================================================
# LOGGING INITIALIZATION
# We rely solely on the centralized setup_logging function to configure 
# the root logger. Calling logging.basicConfig here is redundant and 
# creates duplicate handlers since setup_logging already handles it.
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
# We initialize the Flask application instance here.
# Note that the static folder is configured to serve local files.
# Additional security measures, including updated strict CORS policies,
# and enhanced token security are applied later in this file 
# to ensure API integrity across all origins.
# =====================================================================
app = Flask(__name__, static_folder='.', static_url_path='')
app.register_blueprint(reader_identity_bp)

# Validate required environment variables at startup
# This will raise ValueError if any required variables are missing
validate_required_env_vars()

# Apply configuration to Flask app
app.config.update(app_config.flask_config)

# =====================================================================
# SECURITY COMPLIANCE UPDATE: CSRF PROTECTION (FLASK-WTF)
# =====================================================================
# Cross-Site Request Forgery (CSRF) is a serious vulnerability where 
# an attacker tricks a user into performing actions they didn't intend
# to do on a different website where they are authenticated.
#
# While JWT-Extended provides CSRF protection for authenticated 
# requests via cookies, the initial authentication flow (Login/Register) 
# often remains vulnerable if not explicitly protected.
#
# We initialize Flask-WTF's CSRFProtect to provide a secondary layer
# of defense. This will automatically validate CSRF tokens for all
# POST, PUT, PATCH, and DELETE requests.
# =====================================================================
csrf = CSRFProtect(app)

# Exclude certain endpoints from global CSRF if they are handled by JWT CSRF
# or if they are intended to be public-facing without token requirements.
# In this architecture, we prefer explicit protection on all mutation routes.
# csrf.exempt(some_blueprint) 

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

# =====================================================================
# SECURITY COMPLIANCE UPDATE: STRICT CORS ORIGIN RESOLUTION
# =====================================================================
# This function enforces strict Cross-Origin Resource Sharing (CORS) 
# policies, which is a critical security measure to prevent malicious
# third-party websites from making unauthorized requests on behalf
# of an authenticated user.
#
# The previous implementation was overly permissive, potentially
# allowing wildcard ('*') origins in production environments.
# A wildcard policy (Access-Control-Allow-Origin: *) exposes all
# API endpoints to cross-origin requests from any domain on the
# internet, severely undermining security and leaving the application
# vulnerable to various attacks, including CSRF (Cross-Site Request Forgery)
# and data exfiltration.
#
# To mitigate these risks, this updated function dynamically checks
# the application's current environment. When operating in production
# mode (as determined by `is_production_mode()`), it implements a
# strict allowlist approach:
#
# 1. It attempts to read the `FRONTEND_URL` environment variable.
#    If absent, it defaults to the known production domain 
#    ('https://bibliodrift.com').
# 2. It then checks the `ALLOWED_ORIGINS` environment variable,
#    which allows for multiple comma-separated origins.
# 3. CRITICAL: It actively parses the provided origins and strips out
#    any wildcard ('*') entries, ensuring they cannot be used to
#    bypass the strict policy.
# 4. Empty strings and purely whitespace entries are also removed.
# 5. If the resulting list of safe origins is empty (e.g., if the
#    only provided origin was a wildcard), it forcefully falls back
#    to the safe `FRONTEND_URL` default.
#
# In non-production environments (like local development), the rules
# are slightly relaxed to facilitate testing and debugging, falling
# back to a set of predefined `DEFAULT_CORS_ORIGINS` if no explicit
# configuration is provided in the environment variables.
# =====================================================================
def _load_cors_origins() -> list[str]:
    """Load an explicit CORS allowlist from the environment or defaults."""
    if is_production_mode():
        frontend_url = os.getenv("FRONTEND_URL", "https://bibliodrift.com")
        raw_origins = os.getenv("ALLOWED_ORIGINS", frontend_url)
        # Prevent wildcard in production
        origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip() and origin.strip() != "*"]
        return origins if origins else [frontend_url]

    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    if raw_origins.strip():
        return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
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
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Add Cache-Control for 3D assets and static images
    if request.path.endswith(('.gltf', '.obj', '.png')):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
        
    return response

# =====================================================================
# SECURITY COMPLIANCE UPDATE: CORS CONFIGURATION
# The previous CORS(app) was overly permissive and allowed all origins.
# An open CORS policy (equivalent to Access-Control-Allow-Origin: *)
# exposes all API endpoints to cross-origin requests from any domain, 
# which can enable CSRF-type attacks.
# The fix below restricts CORS to specific trusted origins. We can 
# optionally load allowed origins from environment variables.
# =====================================================================
# ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5000,http://localhost:5000
# For development, we keep a strict explicit allowlist and never use '*'
_cors_origins = _load_cors_origins()
CORS(
    app,
    supports_credentials=True,
    resources={r"/api/*": {"origins": _cors_origins}},
)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins=_cors_origins)

# Initialize cache service
cache_service.init_app(app)


def _resolve_rate_limit_principal() -> str:
    """Resolve a stable principal for per-user/session throttling."""
    try:
        user_id = get_jwt_identity()
        if user_id:
            return f"user:{user_id}"
    except Exception:
        # JWT may be absent on public endpoints.
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


def _handle_rate_limit_exceeded(e: RateLimitExceeded):
    retry_after = int(getattr(e, "retry_after", 1) or 1)
    return rate_limit_error(retry_after)

# =====================================================================
# SECURITY COMPLIANCE UPDATE: RATE LIMITING
# Implementing Flask-Limiter to enforce strict request limits on
# sensitive endpoints (like authentication).
# This mitigates credential stuffing and brute-force attacks by limiting
# the number of attempts a single IP address can make.
# We set generic defaults but override them on specific high-risk routes.
# =====================================================================
limiter = Limiter(
    rate_limit_key_func,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)
app.register_error_handler(RateLimitExceeded, _handle_rate_limit_exceeded)





@app.errorhandler(404)
def page_not_found(e: Exception):
    if request.path.startswith('/api/'):
        return error_response(ErrorCodes.ENDPOINT_NOT_FOUND, "Endpoint not found", 404)
    return app.send_static_file('404.html'), 404

# =========================================================================
# GLOBAL EXCEPTION HANDLER (SECURITY & COMPLIANCE UPDATE)
# =========================================================================
# The following global exception handler is designed to catch all unhandled
# exceptions that bubble up to the Flask application level. 
# 
# WHY THIS MATTERS (SECURITY & COMPLIANCE):
# 1. Information Leakage Prevention: In default Flask configurations, unhandled
#    exceptions can result in raw stack traces being returned to the client in
#    the HTTP 500 response. These stack traces often expose sensitive internal
#    application logic, directory structures, third-party library versions, 
#    and potentially database schema details. Attackers can use this information
#    to craft targeted exploits against the application infrastructure.
# 2. Consistent API Responses: By catching all exceptions globally, we ensure
#    that clients always receive a well-structured JSON response, even when 
#    catastrophic failures occur. This improves client-side error handling and
#    overall system reliability.
# 3. Centralized Auditing: This handler serves as a single choke point for
#    logging critical failures. All unhandled exceptions are logged with full
#    tracebacks internally, ensuring that developers have the information needed
#    to debug issues without exposing that information to the end user.
# 4. Production vs. Development: In production environments, generic error
#    messages are returned to obscure system details. In development environments
#    (as determined by app_config), more detailed error information may be
#    included to assist in local debugging.
# 5. Incident Response Facilitation: By assigning a unique Error Reference ID
#    to each occurrence, customer support and engineering teams can easily
#    correlate a user's reported problem with the specific log entry containing
#    the full stack trace and request context.
#
# ANATOMY OF A SECURE ERROR RESPONSE:
# - error: A generic string like "Internal Server Error"
# - error_code: A consistent, machine-readable string like "INTERNAL_ERROR"
# - reference_id: A UUID string like "a1b2c3d4-..."
# - timestamp: ISO 8601 formatted timestamp of the occurrence
#
# WHAT IS EXCLUDED FROM THE RESPONSE:
# - Raw stack traces (traceback module output)
# - Exception messages (str(e)) which might contain SQL query fragments
# - Local variable states
# - System paths (e.g., /var/www/app/backend/...)
# - Dependency versions
#
# EXCEPTION HANDLING STRATEGY:
# - Step 1: Intercept the exception.
# - Step 2: Determine if it's a known HTTP exception (e.g., 404, 405). If so,
#   let it proceed or format it appropriately.
# - Step 3: Generate a unique error reference ID (UUID).
# - Step 4: Extract request context (method, URL, headers - excluding auth).
# - Step 5: Log the full traceback, request context, and the reference ID at
#   the ERROR or CRITICAL level.
# - Step 6: Construct the safe, generic JSON response.
# - Step 7: Return the response with a 500 status code.
# =========================================================================

from werkzeug.exceptions import HTTPException
import traceback
import uuid
import json

@app.errorhandler(Exception)
def handle_unhandled_exception(e):
    """
    Global catch-all exception handler to prevent stack trace leakage and 
    ensure uniform error responses across the entire application API.
    
    Args:
        e (Exception): The unhandled exception instance caught by Flask.
        
    Returns:
        tuple: A Flask JSON response object and an HTTP status code.
    """
    
    # 1. Handle HTTP Exceptions Normally
    # If the exception is an intentional HTTP error (e.g., abort(404)),
    # we should return its intended status code and message, assuming it's
    # already formatted safely.
    if isinstance(e, HTTPException):
        # We can safely return the description of HTTP exceptions
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

    # 2. Database Session Cleanup
    # If the exception occurred during a database transaction, the session
    # might be left in an invalid state. We must roll it back to prevent
    # subsequent requests in the same thread from failing.
    try:
        from sqlalchemy.exc import SQLAlchemyError
        if isinstance(e, SQLAlchemyError):
            db.session.rollback()
            logger.error("Rolled back database session due to SQLAlchemyError in global handler.")
    except ImportError:
        pass
    except Exception as db_rollback_error:
        # Failsafe: If rollback itself fails, we log it but don't crash the handler
        logger.critical(f"Failed to rollback DB session: {db_rollback_error}")

    # 3. Generate Error Reference ID
    # This UUID will be returned to the client so they can provide it to support.
    # It will also be logged alongside the stack trace.
    error_reference_id = str(uuid.uuid4())
    
    # 4. Extract Safe Request Context
    # We want to log what the user was trying to do, but we MUST NOT log
    # sensitive information like passwords, tokens, or full credit card numbers.
    request_method = request.method
    request_url = request.url
    client_ip = request.remote_addr
    
    # Safely extract headers (excluding Authorization and Cookies)
    safe_headers = {}
    for key, value in request.headers.items():
        if key.lower() not in ['authorization', 'cookie', 'x-api-key']:
            safe_headers[key] = value
            
    # Safely extract query parameters
    query_params = dict(request.args)
    
    # 5. Structure the Log Payload
    # Create a detailed dictionary for logging purposes
    log_payload = {
        "error_reference_id": error_reference_id,
        "exception_type": type(e).__name__,
        "exception_message": str(e),
        "request": {
            "method": request_method,
            "url": request_url,
            "client_ip": client_ip,
            "headers": safe_headers,
            "query_parameters": query_params
        }
    }
    
    # 6. Log the Exception
    # We use logger.error with exc_info=True to automatically append the
    # full stack trace to the log entry. This is critical for debugging.
    # We prefix the log message with the reference ID for easy searching.
    logger.error(
        f"[ERROR REF: {error_reference_id}] Unhandled Exception: {type(e).__name__} "
        f"at {request_method} {request_url}\n"
        f"Details: {json.dumps(log_payload, indent=2)}",
        exc_info=True
    )
    
    # 7. Determine Response Content based on Environment
    # In development, we MIGHT want to return the stack trace for convenience.
    # In production, we MUST return a generic message.
    
    # Check if we are in production mode using the imported is_production_mode helper
    # or the app_config object.
    is_prod = True
    try:
        if hasattr(app_config, 'is_production'):
            is_prod = app_config.is_production()
        elif hasattr(app_config, 'flask_config'):
            is_prod = app_config.flask_config.get('ENV') == 'production'
    except Exception:
        # Default to secure production behavior if config check fails
        is_prod = True
        
    # Construct the base response
    response_data = {
        "success": False,
        "error_code": "INTERNAL_SERVER_ERROR",
        "error": "An unexpected internal server error occurred.",
        "message": "Our team has been notified. Please try again later.",
        "reference_id": error_reference_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # If explicitly NOT in production, we can append debug info
    if not is_prod:
        response_data["_debug"] = {
            "exception": type(e).__name__,
            "message": str(e),
            "traceback": traceback.format_exc().splitlines()
        }
        logger.warning(
            f"[ERROR REF: {error_reference_id}] Returning detailed error response "
            f"because environment is NOT production."
        )
    else:
        logger.info(
            f"[ERROR REF: {error_reference_id}] Returning generic secure error response "
            f"because environment is production."
        )
        
    # 8. Return the Secure JSON Response
    # Always return a 500 Internal Server Error status code for unhandled exceptions.
    response = jsonify(response_data)
    
    # Adding security headers to error responses as defense in depth
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    
    return response, 500

# =========================================================================
# DATABASE EXCEPTION HANDLER (SECURITY & COMPLIANCE UPDATE)
# =========================================================================
# Why a separate handler for database errors?
# Database errors (like IntegrityError, OperationalError) often contain
# raw SQL queries, table names, or constraint names in their string
# representations. Exposing these details is a severe security risk 
# (Information Exposure).
# 
# This handler intercepts all exceptions deriving from SQLAlchemyError,
# securely logs the full details (including the potentially sensitive query),
# and returns a highly sanitized, generic error to the client.
# 
# Key Actions:
# 1. Rolls back the active database session to prevent bad state.
# 2. Generates a unique tracking ID.
# 3. Logs the raw error internally.
# 4. Returns a safe "Database Operation Failed" message.
# =========================================================================
from sqlalchemy.exc import SQLAlchemyError

@app.errorhandler(SQLAlchemyError)
def handle_sqlalchemy_exception(e):
    """
    Dedicated handler for database-related exceptions to prevent SQL injection
    reconnaissance and schema leakage.
    """
    # 1. Ensure the session is rolled back safely
    try:
        db.session.rollback()
    except Exception as rollback_err:
        logger.critical(f"Failed to rollback DB session during SQLAlchemyError handling: {rollback_err}")
        
    # 2. Generate Tracking ID
    error_reference_id = str(uuid.uuid4())
    
    # 3. Secure Internal Logging
    # We log the full error (which may contain SQL) but ONLY internally.
    logger.error(
        f"[DB ERROR REF: {error_reference_id}] Database Exception: {type(e).__name__} "
        f"at {request.method} {request.path}\n"
        f"Message: {str(e)}",
        exc_info=True
    )
    
    # 4. Safe External Response
    response_data = {
        "success": False,
        "error_code": "DATABASE_ERROR",
        "error": "A database operation failed.",
        "message": "The issue has been logged and our team is investigating.",
        "reference_id": error_reference_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # In non-production, we might want to see the error, but even then
    # we should be careful. We'll only expose the type, not the full SQL.
    is_prod = True
    try:
        if hasattr(app_config, 'is_production'):
            is_prod = app_config.is_production()
        elif hasattr(app_config, 'flask_config'):
            is_prod = app_config.flask_config.get('ENV') == 'production'
    except Exception:
        is_prod = True
        
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

# =========================================================================
# END OF GLOBAL EXCEPTION HANDLERS
# =========================================================================


@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    """
    =========================================================================
    CUSTOM CSRF ERROR HANDLER
    =========================================================================
    Intercepts CSRF validation failures and returns a standardized JSON 
    error response instead of the default HTML error page.
    
    This is critical for a RESTful API architecture where the client 
    expects consistent JSON structures even during security failures.
    
    Status: 400 Bad Request (as per Flask-WTF default for CSRF failures)
    =========================================================================
    """
    logger.warning(f"CSRF Validation Failed: {e.description} | Remote IP: {request.remote_addr}")
    return jsonify({
        "success": False,
        "error": "CSRF_VALIDATION_FAILED",
        "message": f"Security token validation failed: {e.description}. Please refresh the page.",
        "code": 400
    }), 400


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
    return _apply_security_headers(response)

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


@app.route('/api/v1/content/live-shelves', methods=['GET'])
def get_live_shelves():
    """Return the configuration for live discovery shelves on the frontend."""
    discovery_shelves = [
        {
            "type": "query",
            "query": "subject:mystery atmosphere",
            "elementId": "row-rainy",
            "title": "Rainy Evening Reads",
            "subtitle": "Mystery & Melancholy",
            "icon": "fa-cloud-rain"
        },
        {
            "type": "query",
            "query": "authors:arundhati roy|subject:india",
            "elementId": "row-indian",
            "title": "Indian Authors",
            "subtitle": "Subcontinent Voices",
            "icon": "fa-feather"
        },
        {
            "type": "query",
            "query": "subject:classic fiction",
            "elementId": "row-classics",
            "title": "Forgotten Classics",
            "subtitle": "Timeless & Dust-free",
            "icon": "fa-hourglass"
        },
        {
            "type": "query",
            "query": "subject:gothic fiction subject:dark academia subject:campus",
            "elementId": "row-dark-academia",
            "title": "Dark Academia",
            "subtitle": "Gothic, cerebral, candlelit",
            "icon": "fa-feather-pointed",
            "vibeDescription": "gothic, intellectual, melancholic, and candlelit",
            "fallbackQuery": "subject:gothic fiction subject:campus"
        },
        {
            "type": "query",
            "query": "subject:fiction",
            "elementId": "row-fiction",
            "title": "General Fiction",
            "subtitle": "Stories for everyone",
            "icon": "fa-book-open"
        }
    ]
    return success_response(data={"shelves": discovery_shelves})

# =====================================================================
# ENDPOINT: CSRF Token Retrieval
# =====================================================================
# Since this is a decoupled frontend, we need a way for the client-side
# application to "prime" itself with a valid CSRF token before attempting
# a state-mutating request (like Login or Register).
#
# This endpoint generates a new token and sets the associated session 
# cookie. The frontend should call this on page load of sensitive forms.
# =====================================================================
@app.route('/api/v1/csrf-token', methods=['GET'])
def get_csrf_token():
    """
    Generate and return a fresh CSRF token.
    The token is automatically tied to the user's session.
    """
    token = generate_csrf()
    return success_response(data={"csrf_token": token})

# =====================================================================
# ENDPOINT: System Health & Environment Diagnostics
# =====================================================================
# This endpoint provides comprehensive health checks for the API, 
# Database, Redis Cache, and external AI/Service Integrations.
# 
# Security & Compliance:
# - In 'production', it returns only essential health status to prevent
#   information leakage, which is critical for attack surface reduction.
# - In 'development' or 'testing', it returns detailed configuration
#   states, database connection metrics, and dummy key validations.
# - Validates that 'testing' environments correctly utilize dummy API 
#   keys to prevent accidental financial charges against real services.
# - Automatically degrades system status from 200 OK to 503 Service 
#   Unavailable if critical infrastructural components (DB, Cache) fail.
# =====================================================================
@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """
    Comprehensive system health and environment diagnostic check.
    Behavior and verbosity scale dynamically according to the active environment config.
    """
    from sqlalchemy import text
    import time
    
    # Initialize the base health response structure
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": app_config.get_environment_name(),
        "version": "1.0.0",
        "maintenance_mode": os.getenv("MAINTENANCE_MODE", "false").lower() == "true"
    }
    
    # 1. Database Connectivity & Latency Check
    db_status = "unknown"
    db_latency_ms = 0
    try:
        start_time = time.time()
        # Execute a lightweight, read-only query to test the active connection pool
        # This confirms that SQLAlchemy can successfully speak to the database
        db.session.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - start_time) * 1000, 2)
        db_status = "connected"
    except Exception as e:
        logger.error(f"Health Check: Database connection failed: {e}")
        db_status = "disconnected"
        health_status["status"] = "degraded"
        # Only append specific error messages in non-production environments
        if not app_config.is_production():
            health_status["db_error"] = str(e)
            
    # 2. Redis Cache Connectivity Check
    # Important for rate limiting and temporary data storage
    redis_status = "unknown"
    try:
        # Check if the cache service was successfully initialized and bound to a client
        if hasattr(cache_service, 'redis_client') and cache_service.redis_client:
            if cache_service.redis_client.ping():
                redis_status = "connected"
            else:
                redis_status = "unresponsive"
                health_status["status"] = "degraded"
        else:
            redis_status = "disabled"
    except Exception as e:
        logger.error(f"Health Check: Redis connection failed: {e}")
        redis_status = "disconnected"
        health_status["status"] = "degraded"
        if not app_config.is_production():
            health_status["redis_error"] = str(e)
    
    # Assemble core services status payload
    health_status["services"] = {
        "database": {
            "status": db_status,
            "latency_ms": db_latency_ms
        },
        "redis_cache": {
            "status": redis_status
        }
    }
    
    # 3. Environment-Specific Detailed Diagnostics
    # In non-production environments, we expose more detailed configuration
    # data to assist developers, CI/CD pipelines, and integration tests.
    if not app_config.is_production():
        # Validate AI Services configuration without exposing full keys
        ai_services_state = {
            "openai_configured": bool(app_config.ai_service.openai_api_key),
            "groq_configured": bool(app_config.ai_service.groq_api_key),
            "gemini_configured": bool(app_config.ai_service.gemini_api_key),
            "google_books_configured": bool(app_config.ai_service.google_books_api_key)
        }
        
        # Check if dummy test keys are active (from TestingConfig)
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
        
        # Defensive Check: Add critical warning if testing in an environment 
        # that explicitly should use dummy keys, but real ones are engaged.
        if app_config.get_environment_name() in ['test', 'testing'] and not is_using_dummy_keys:
            if "warnings" not in health_status["diagnostics"]:
                health_status["diagnostics"]["warnings"] = []
            health_status["diagnostics"]["warnings"].append(
                "CRITICAL: Testing environment is active but dummy API keys are NOT engaged. Real credits may be consumed."
            )
            
    # Return 503 Service Unavailable if core services are severely degraded
    # Return 200 OK if system is healthy or experiencing minor non-critical issues
    http_status = 200 if health_status["status"] == "healthy" else 503
    
    # If the system is explicitly put into maintenance mode, return 503
    if health_status["maintenance_mode"]:
        http_status = 503
        health_status["status"] = "maintenance"
        health_status["message"] = "System is currently undergoing scheduled maintenance."
    
    return jsonify(health_status), http_status

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
            "POST /api/v1/category-books": "Get AI-curated books for a specific shelf category",
            "POST /api/v1/reader-archetype":"Generate AI reader archetype",
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
@limiter.limit("10 per minute")
@validate_schema(AnalyzeMoodRequest)
def handle_analyze_mood(validated_data):
    """Analyze book mood using GoodReads reviews."""
    if not MOOD_ANALYSIS_AVAILABLE:
        return service_unavailable_error("Mood analysis not available - missing dependencies")
    
    try:
        
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
@limiter.limit("10 per minute")
@validate_schema(MoodTagsRequest)
def handle_mood_tags(validated_data):
    """Get mood tags for a book."""
    from backend.core.exceptions.exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException, 
        ValidationException, InvalidInputError
    )
    from backend.core.responses.error_responses import handle_exception
    
    try:
        
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
@limiter.limit("10 per minute")
@validate_schema(MoodSearchRequest)
def handle_mood_search(validated_data):
    """Search for books based on mood/vibe with improved query parsing."""
    from backend.core.exceptions.exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException,
        ValidationException, InvalidInputError
    )
    from backend.core.responses.error_responses import handle_exception
    
    try:
        
        mood_query = validated_data.query
        
        # Try to use enhanced mood parsing if available
        try:
            from mood_analysis.mood_query_parser import parse_mood_query, get_recommendation_prompt
            parsed_query = parse_mood_query(mood_query)
            enhanced_prompt = get_recommendation_prompt(mood_query)
            
            logger.info(f"Parsed mood query: {parsed_query.to_dict()}")
            
            # Use enhanced prompt for recommendations
            recommendations = get_ai_recommendations(enhanced_prompt)
            
            return success_response(
                data={
                    "recommendations": recommendations,
                    "query": mood_query,
                    "parsed_mood": parsed_query.to_dict()
                }
            )
        except ImportError:
            # Fallback to basic recommendations if mood parser not available
            logger.info("Mood query parser not available, using basic recommendations")
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


@app.route('/api/v1/vibe-check', methods=['POST'])
@rate_limit('vibe_check')
@validate_schema(VibeCheckRequest)
def handle_vibe_check(validated_data):
    """
    Generate hyper-personalized book recommendations based on a specific vibe.
    """
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

        return success_response(
            data={
                "category": validated_data.category,
                "books": books,
            }
        )

    except Exception as e:
        logger.error(f"Error in handle_category_books: {str(e)}", exc_info=True)
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
    """Generate AI-powered book recommendation with vibe support."""
    from backend.core.exceptions.exceptions import (
        LLMCircuitBreakerOpenError, AIServiceException,
        DatabaseQueryError, DatabaseIntegrityError,
        ValidationException, InvalidInputError
    )
    from backend.core.responses.error_responses import handle_exception
    
    try:
        
        description = validated_data.description
        title = validated_data.title
        author = validated_data.author
        vibe = getattr(validated_data, 'vibe', 'cozy discovery')
        
        # Check cache
        cached_note = BookNote.query.filter_by(book_title=title, book_author=author).first()
        if cached_note:
            logger.debug(f"Cache hit for {title} by {author}")
            return success_response(data={"blurb": cached_note.content})
        
        # Generate AI recommendation with vibe context
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
def handle_chat():
    """Legacy chat endpoint (deprecated in favor of WebSockets)."""
    return jsonify({
        "success": False,
        "error": "This endpoint is deprecated. Please use the WebSockets interface for Literary Chat."
    }), 426

@socketio.on('chat_message')
def handle_socket_chat(data):
    """Handle chat messages via WebSockets and stream bookseller responses."""
    try:
        is_valid, validated_data = validate_request(ChatRequest, data)
        if not is_valid:
            emit('chat_error', {"error": "Validation failed", "details": validated_data})
            return
            
        user_message = validated_data.message
        conversation_history = validated_data.history or []
        
        validated_history = []
        for msg in conversation_history[-6:]:
            if not isinstance(msg, dict) or 'content' not in msg:
                continue
            else:
                validated_history.append(msg)
        
        recommendations = get_ai_recommendations(user_message)
        
        full_response = ""
        for chunk in generate_chat_response_stream(user_message, validated_history):
            if chunk:
                full_response += chunk
                emit('chat_stream', {'chunk': chunk})
        
        emit('chat_complete', {
            "success": True,
            "response": full_response,
            "recommendations": recommendations,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in WebSocket handle_chat: {type(e).__name__}: {e}", exc_info=True)
        emit('chat_error', {"error": "An error occurred while generating a response. Please try again."})

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
@limiter.limit("20 per minute")
@jwt_required()
@validate_schema(AddToLibraryRequest)
def add_to_library(validated_data):
    """Add a book to the user's shelf."""
    from sqlalchemy.exc import IntegrityError
    from backend.core.exceptions.exceptions import DatabaseQueryError, DatabaseIntegrityError, ValidationException
    from backend.core.responses.error_responses import handle_exception
    
    try:
        
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

            # --- DYNAMIC SPINE GENERATION FOR SINGLE ADD ---
            try:
                # Safely parse authors if it comes in as a list structure
                author_str = ", ".join(validated_data.authors) if isinstance(validated_data.authors, list) else validated_data.authors
                clean_id = "".join([c if c.isalnum() else "_" for c in validated_data.title.lower().strip()])
                
                # Render the image file straight to frontend assets
                create_spine(validated_data.title, author_str, clean_id)
            except Exception as spine_err:
                logger.error(f"Spine generation failed during direct add: {spine_err}")
            # -----------------------------------------------

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
    """Calculate the user's current reading streak in days.

    Multiple books finished on the same calendar day count as a single
    streak day, fixing the bug reported in issue #513.
    """
    finished_items = ShelfItem.query.filter_by(
        user_id=user_id, shelf_type='finished'
    ).filter(ShelfItem.finished_at.isnot(None)).order_by(ShelfItem.finished_at.desc()).all()

    if not finished_items:
        return 0

    # Deduplicate dates so two books on the same day count as one streak day.
    # Without this, days_diff == 0 silently skips and corrupts prev_date,
    # causing the next iteration to see a false gap and break early.
    unique_dates = sorted(
        {item.finished_at.date() for item in finished_items},
        reverse=True,
    )

    now = datetime.now(timezone.utc)
    today = now.date()
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
    """Get yearly reading statistics."""
    stats = ReadingStats.query.filter_by(user_id=user_id, year=year).all()
    
    total_books = sum(s.books_completed for s in stats)
    total_pages = sum(s.pages_read for s in stats)
    monthly = {s.month: s.books_completed for s in stats}
    
    return {"total_books": total_books, "total_pages": total_pages, "monthly": monthly}


# ==================== LIBRARY ENDPOINTS ====================
@app.route('/api/v1/library/<int:item_id>', methods=['PUT'])
@jwt_required()
@validate_schema(UpdateLibraryItemRequest)
def update_library_item(item_id, validated_data):
    """Update a library item (e.g. move to different shelf)."""
    try:
        
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
@limiter.limit("20 per minute")
@jwt_required()
@validate_schema(SyncLibraryRequest)
def sync_library(validated_data):
    """Sync a list of books from local storage to the user's account."""
    try:
        current_user_id = get_jwt_identity()
        
        user_id = validated_data.user_id
        raw_items = validated_data.items
        
        if str(user_id) != str(current_user_id):
            return forbidden_error("Cannot sync to another user's library")

        # NOTE: validated_data.items is List[Dict[str, Any]] per SyncLibraryRequest validator.
        # Each item_data is a raw dictionary (not a Pydantic model), so .get() and isinstance()
        # checks are safe. Sanitization happens after ID validation to prevent XSS in valid books.
        invalid_ids = []
        for index, item_data in enumerate(validated_data.items):
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

        # Sanitize the items list only after validating Google Books IDs.
        items = sanitize_payload(validated_data.items)
        
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

                        # --- DYNAMIC SPINE GENERATION FOR BULK SYNC ---
                        try:
                            sync_title = volume_info.get('title', 'Untitled')
                            clean_id = "".join([c if c.isalnum() else "_" for c in sync_title.lower().strip()])
                            create_spine(sync_title, authors, clean_id)
                        except Exception as spine_err:
                            logger.error(f"Spine generation failed during bulk sync: {spine_err}")
                        # -----------------------------------------------

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
# =========================================================================
@app.route('/api/v1/register', methods=['POST'])
@limiter.limit("5 per 10 seconds")
@validate_schema(RegisterRequest)
def register(validated_data):
    """Register a new user and return JWT token."""
    try:
        
        username = validated_data.username
        email = validated_data.email
        password = validated_data.password

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
@limiter.limit("5 per 10 seconds")
@validate_schema(LoginRequest)
def login(validated_data):
    """Authenticate user and return JWT token."""
    from backend.core.exceptions.exceptions import DatabaseQueryError, ValidationException
    from backend.core.responses.error_responses import handle_exception
    
    try:
        
        username_or_email = validated_data.username
        password = validated_data.password

        user = User.query.filter((User.username==username_or_email) | (User.email==username_or_email)).first()
        
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
        'google_oauth_state',
        oauth_state,
        httponly=True,
        secure=app_config.is_production(),
        samesite='Lax',
        max_age=600
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
                'code': code,
                'client_id': google_client_id,
                'client_secret': google_client_secret,
                'redirect_uri': google_redirect_uri,
                'grant_type': 'authorization_code'
            },
            timeout=10
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            return auth_error("Google OAuth access token is missing.")

        userinfo_response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
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
                    username=unique_username,
                    email=email,
                    google_id=google_id,
                    auth_provider='google',
                    profile_picture=google_user.get('picture'),
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
    print(user)

    if not user:
        return auth_error("Invalid or expired session.")

    return jsonify({"user": user.to_dict()}), 200


@app.route('/api/v1/logout', methods=['POST'])
def logout():
    """Clear JWT cookies for logout."""
    resp, status = success_response(message="Logout successful")
    unset_jwt_cookies(resp)
    return resp, status


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
    """Upload and update user avatar with MIME type and magic number validation."""
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
        
    # Validate Content-Type header
    file_content_type = file.content_type
    if file_content_type not in ALLOWED_MIME_TYPES:
        return jsonify({"error": "Invalid Content-Type"}), 400
        
    # Verify file magic numbers
    file_bytes = file.read(2048)
    file.seek(0) # Reset file pointer after reading
    
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
                    validated_data.email,
                    reset_url,
                    email_config,
                )
                if not send_result.ok:
                    logger.error(
                        "Password reset email not sent for %s: %s",
                        validated_data.email,
                        send_result.detail,
                    )
            elif app_config.is_development():
                response_data["reset_url"] = reset_url
                logger.info(
                    "Dev password reset link for %s (email not configured): %s",
                    validated_data.email,
                    reset_url,
                )
            elif app_config.is_production():
                logger.warning(
                    "Password reset token created but EMAIL_* is not configured; "
                    "user %s will not receive mail.",
                    validated_data.email,
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
    """Set a new password using a valid reset token."""
    try:

        ok, message = reset_password_with_token(
            validated_data.token,
            validated_data.password,
        )
        if not ok:
            return jsonify({"error": message}), 400

        return success_response(data={"message": message})
    except Exception as e:
        logger.error("reset-password failed: %s", e, exc_info=True)
        return internal_error("Unable to reset password.")


@app.route('/api/v1/auth/verify', methods=['GET'])
@jwt_required()
def verify_auth_session():
    """Validate JWT from access cookie and return the current user (session restore)."""
    try:
        uid = get_jwt_identity()
        user = User.query.get(int(uid))
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify({
            "user": {"id": user.id, "username": user.username, "email": user.email}
        }), 200
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid session"}), 401


# ==================== READING STATS ENDPOINTS ====================
@app.route('/api/v1/stats/goal', methods=['POST'])
@jwt_required()
@validate_schema(SetGoalRequest)
def set_reading_goal(validated_data):
    """Set or update annual reading goal."""
    
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
    """Get reading statistics for the user."""
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
    year = request.args.get('year', datetime.now(timezone.utc).year, type=int)
    limit = request.args.get('limit', 10, type=int)
    
    try:
        from sqlalchemy import func

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
@validate_schema(CollectionRequest)
def create_collection(validated_data):
    """Create a new collection."""
    
    if str(validated_data.user_id) != str(current_user_id):
        return forbidden_error("Unauthorized")
    
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
        return forbidden_error("Unauthorized")
    
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
            return forbidden_error("Unauthorized")
        
        return jsonify({"collection": collection.to_dict(include_items=True)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
@jwt_required()
@validate_schema(UpdateCollectionRequest)
def update_collection(collection_id, validated_data):
    """Update a collection."""
    
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
    """Delete a collection."""
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
def add_book_to_collection(collection_id):
    """Add a book to a collection."""
    
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
            return forbidden_error("Unauthorized")
        
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
            if not validate_google_books_id(book_id):
                return validation_error("Invalid Google Books ID format")
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
        return forbidden_error("Unauthorized - you can only view your own reviews")
    
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
            return forbidden_error("Unauthorized - you can only delete your own reviews")
        
        review.soft_delete()
        return jsonify({"message": "Review deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== PRICE ALERT ENDPOINTS ====================

@app.route('/api/v1/books/<book_id>/alert', methods=['POST'])
@limiter.limit("20 per minute")
@jwt_required()
def create_price_alert(book_id):
    """Create a price alert for a book (requires JWT)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    is_valid, validated_data = validate_request(SetPriceAlertRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    if str(validated_data.user_id) != str(current_user_id):
        return forbidden_error("Unauthorized access to another user's alerts")
    
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
        
        # If no history exists, fetch the current price and record it
        if not history and not latest_prices:
            price_tracker.update_prices_for_book(book.id, book.google_books_id)
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
        return forbidden_error("Unauthorized - you can only view your own alerts")
    
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
            return forbidden_error("Unauthorized - you can only delete your own alerts")
        
        result = price_tracker.delete_price_alert(alert_id=alert_id, user_id=current_user_id)
        
        if result.get('success'):
            return jsonify({"message": "Price alert deleted successfully"}), 200
        else:
            return jsonify({"error": result.get('error', 'Failed to delete price alert')}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


with app.app_context():
    db.create_all()

# NOTE: Book search is performed directly from the frontend using the Google Books API.
# The old backend proxy endpoint /api/books has been removed to avoid unnecessary
# load on the backend server.

if __name__ == '__main__':
    # Print the available endpoints
    with app.app_context():
        logger.info("\nAvailable endpoints:")
        logger.info("  POST /api/v1/auth/register - Register a new user")
        logger.info("  POST /api/v1/auth/login - Login user")
        logger.info("  POST /api/v1/auth/logout - Logout user")
        logger.info("  GET  /api/v1/auth/me - Get current user")
        logger.info("  GET  /api/v1/library/shelves - Get shelves (counts only)")
        logger.info("  GET  /api/v1/library/items - Get library items")
        logger.info("  POST /api/v1/library/items - Add item to library")
        logger.info("  PUT  /api/v1/library/items/<id> - Update item status/rating")
        logger.info("  DELETE /api/v1/library/items/<id> - Remove item from library")
        logger.info("  GET  /api/v1/library/collections - Get collections")
        logger.info("  POST /api/v1/library/collections - Create collection")
        logger.info("  GET  /api/v1/library/collections/<id>/items - Get collection items")
        logger.info("  POST /api/v1/library/collections/<id>/items - Add item to collection")
        logger.info("  GET  /api/v1/recommendations - Get AI recommendations")
        logger.info("  GET  /api/v1/reading-goals - Get reading goals")
        logger.info("  POST /api/v1/reading-goals - Create reading goal")
        logger.info("  GET  /api/v1/reading-stats - Get reading statistics")
        logger.info("  POST /api/v1/book-notes - Add book note")
        logger.info("  GET  /api/v1/book-notes/<book_id> - Get book notes")
        logger.info("  POST /api/v1/ai/generate-note - Generate AI book blurb")
        logger.info("  POST /api/v1/chat - Chat with bookseller (DEPRECATED - Use WebSockets)")
        logger.info("  GET  /api/v1/health - Health check")

    socketio.run(app, debug=server_config.debug, port=server_config.port, host=server_config.host)
