"""
Flask middleware for security validations.
Includes Content-Type validation, request size limits, and header validation.
"""
import logging
from functools import wraps
from flask import request, jsonify
from .error_responses import invalid_json_error

logger = logging.getLogger(__name__)


def validate_content_type_middleware(f):
    """
    Decorator to validate Content-Type header for POST/PATCH/PUT requests.
    Skips validation for GET requests and requests without body.
    
    Usage:
        @app.route('/api/v1/endpoint', methods=['POST'])
        @validate_content_type_middleware
        def my_endpoint():
            ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip for GET and HEAD requests (no body)
        if request.method in ['GET', 'HEAD', 'DELETE']:
            return f(*args, **kwargs)
        
        # Skip for requests without body
        if request.content_length is None or request.content_length == 0:
            return f(*args, **kwargs)
        
        # Validate Content-Type header
        content_type = request.content_type
        
        if not content_type:
            logger.warning(f"Request to {request.path} missing Content-Type header")
            return invalid_json_error("Missing Content-Type header")
        
        # Check for JSON content type
        base_type = content_type.split(';')[0].strip().lower()
        
        if base_type not in ['application/json', 'application/x-www-form-urlencoded']:
            logger.warning(
                f"Invalid Content-Type '{content_type}' for {request.method} "
                f"{request.path} from {request.remote_addr}"
            )
            return invalid_json_error(
                f"Invalid Content-Type: {content_type}. "
                "Expected: application/json"
            )
        
        return f(*args, **kwargs)
    
    return decorated_function


def validate_request_size(max_size_bytes: int = 1_000_000):
    """
    Decorator to validate request body size.
    
    Args:
        max_size_bytes: Maximum allowed request body size (default 1MB)
    
    Usage:
        @app.route('/api/v1/upload', methods=['POST'])
        @validate_request_size(max_size_bytes=5_000_000)  # 5MB
        def upload_endpoint():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            content_length = request.content_length
            
            if content_length is not None and content_length > max_size_bytes:
                size_mb = content_length / (1024 * 1024)
                max_mb = max_size_bytes / (1024 * 1024)
                logger.warning(
                    f"Request to {request.path} exceeds size limit: "
                    f"{size_mb:.2f}MB > {max_mb:.2f}MB"
                )
                return jsonify({
                    'success': False,
                    'error': f'Request body too large. Maximum: {max_mb:.0f}MB'
                }), 413  # 413 Payload Too Large
            
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator


def require_json_content_type(f):
    """
    Decorator for endpoints that MUST receive JSON.
    More strict than validate_content_type_middleware.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            logger.warning(
                f"Non-JSON request to {request.method} {request.path} "
                f"(Content-Type: {request.content_type}) from {request.remote_addr}"
            )
            return invalid_json_error("Request body must be valid JSON")
        
        if request.content_length is None or request.content_length == 0:
            logger.warning(
                f"Empty request to {request.method} {request.path} "
                f"from {request.remote_addr}"
            )
            return invalid_json_error("Request body cannot be empty")
        
        return f(*args, **kwargs)
    
    return decorated_function


def safe_request_handler(
    validate_content_type: bool = True,
    max_size_bytes: int = 1_000_000,
    require_json: bool = True
):
    """
    Composite decorator for comprehensive request validation.
    Combines Content-Type validation, size limits, and JSON requirements.
    
    Usage:
        @app.route('/api/v1/endpoint', methods=['POST'])
        @safe_request_handler(
            require_json=True,
            max_size_bytes=2_000_000  # 2MB
        )
        def my_endpoint():
            # Request is guaranteed to be safe and properly formatted
            success, data, error = safe_get_json()
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Content-Type validation
            if validate_content_type and request.method not in ['GET', 'HEAD']:
                ct = request.content_type
                if not ct or ct.split(';')[0].strip() not in ['application/json']:
                    logger.warning(f"Content-Type validation failed for {request.path}")
                    return invalid_json_error("Invalid or missing Content-Type header")
            
            # Size validation
            if max_size_bytes and request.content_length is not None:
                if request.content_length > max_size_bytes:
                    logger.warning(f"Request size exceeded for {request.path}")
                    return jsonify({
                        'success': False,
                        'error': 'Request body too large'
                    }), 413
            
            # JSON requirement
            if require_json and request.method in ['POST', 'PATCH', 'PUT']:
                if not request.is_json:
                    logger.warning(f"Non-JSON request to {request.path}")
                    return invalid_json_error("Request must be JSON")
            
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator
