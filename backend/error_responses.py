"""
Standardized error response handling for BiblioDrift API
This module provides consistent error response formatting across all API endpoints.
"""

from flask import jsonify
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


# Error code constants
class ErrorCodes:
    """Standard error codes used across the API"""
    # Validation errors (400)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MISSING_FIELDS = "MISSING_FIELDS"
    INVALID_JSON = "INVALID_JSON"
    INVALID_INPUT = "INVALID_INPUT"
    
    # Authentication errors (401)
    AUTH_ERROR = "AUTH_ERROR"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    
    # Authorization errors (403)
    FORBIDDEN = "FORBIDDEN"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    
    # Not found errors (404)
    NOT_FOUND = "NOT_FOUND"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    ENDPOINT_NOT_FOUND = "ENDPOINT_NOT_FOUND"
    
    # Conflict errors (409)
    CONFLICT = "CONFLICT"
    RESOURCE_EXISTS = "RESOURCE_EXISTS"
    
    # Rate limiting (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    
    # Server errors (500)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DB_ERROR = "DB_ERROR"
    DB_QUERY_ERROR = "DB_QUERY_ERROR"
    DB_INTEGRITY_ERROR = "DB_INTEGRITY_ERROR"
    
    # Service unavailable (503)
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    DB_UNAVAILABLE = "DB_UNAVAILABLE"
    LLM_SERVICE_UNAVAILABLE = "LLM_SERVICE_UNAVAILABLE"
    
    # LLM-specific errors (5xx)
    LLM_ERROR = "LLM_ERROR"
    LLM_RATE_LIMIT = "LLM_RATE_LIMIT"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_CIRCUIT_BREAKER = "LLM_CIRCUIT_BREAKER"
    
    # External service errors (502/503)
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    additional_data: Optional[Dict[str, Any]] = None
) -> tuple:
    """
    Generate a standardized error response.
    
    Args:
        code: Error code from ErrorCodes class
        message: Human-readable error message
        status_code: HTTP status code (default: 400)
        additional_data: Optional additional data to include in response
        
    Returns:
        Tuple of (jsonify response, status_code)
        
    Example:
        return error_response(
            ErrorCodes.VALIDATION_ERROR,
            "Title is required",
            400
        )
    """
    response_data = {
        "success": False,
        "error": {
            "code": code,
            "message": message
        }
    }
    
    # Add any additional data (e.g., retry_after for rate limiting)
    if additional_data:
        response_data["error"].update(additional_data)
    
    return jsonify(response_data), status_code


def success_response(
    data: Optional[Dict[str, Any]] = None,
    message: Optional[str] = None,
    status_code: int = 200
) -> tuple:
    """
    Generate a standardized success response.
    
    Args:
        data: Response data
        message: Optional success message
        status_code: HTTP status code (default: 200)
        
    Returns:
        Tuple of (jsonify response, status_code)
        
    Example:
        return success_response(
            data={"books": books_list},
            message="Books retrieved successfully"
        )
    """
    response_data = {
        "success": True
    }
    
    if message:
        response_data["message"] = message
    
    if data:
        response_data.update(data)
    
    return jsonify(response_data), status_code


# Convenience functions for common errors
def validation_error(message: str, status_code: int = 400) -> tuple:
    """Return a validation error response"""
    return error_response(ErrorCodes.VALIDATION_ERROR, message, status_code)


def missing_fields_error(fields: str) -> tuple:
    """Return a missing fields error response"""
    return error_response(
        ErrorCodes.MISSING_FIELDS,
        f"Missing required fields: {fields}",
        400
    )


def invalid_json_error(message: str = "Invalid JSON or missing request body") -> tuple:
    """Return an invalid JSON error response."""
    return error_response(
        ErrorCodes.INVALID_JSON,
        message,
        400
    )


def auth_error(message: str = "Invalid credentials") -> tuple:
    """Return an authentication error response"""
    return error_response(ErrorCodes.INVALID_CREDENTIALS, message, 401)


def forbidden_error(message: str = "Access forbidden") -> tuple:
    """Return a forbidden error response"""
    return error_response(ErrorCodes.FORBIDDEN, message, 403)


def unauthorized_access_error(message: str = "Unauthorized access") -> tuple:
    """Return an unauthorized access error response"""
    return error_response(ErrorCodes.UNAUTHORIZED_ACCESS, message, 403)


def not_found_error(resource: str = "Resource") -> tuple:
    """Return a not found error response"""
    return error_response(
        ErrorCodes.NOT_FOUND,
        f"{resource} not found",
        404
    )


def resource_exists_error(resource: str = "Resource") -> tuple:
    """Return a resource already exists error response"""
    return error_response(
        ErrorCodes.RESOURCE_EXISTS,
        f"{resource} already exists",
        409
    )


def rate_limit_error(retry_after: int) -> tuple:
    """Return a rate limit exceeded error response"""
    response = error_response(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        "Rate limit exceeded. Try again shortly.",
        429,
        additional_data={"retry_after": retry_after}
    )
    # Add Retry-After header
    json_response, status_code = response
    json_response.headers['Retry-After'] = str(retry_after)
    return json_response, status_code


def internal_error(message: str = "An internal error occurred") -> tuple:
    """Return an internal server error response"""
    return error_response(ErrorCodes.INTERNAL_ERROR, message, 500)


def service_unavailable_error(message: str = "Service temporarily unavailable") -> tuple:
    """Return a service unavailable error response"""
    return error_response(ErrorCodes.SERVICE_UNAVAILABLE, message, 503)


# ==================== DATABASE ERROR HELPERS ====================
def database_error(message: str = "Database error occurred") -> tuple:
    """Return a database error response"""
    logger.error(f"Database error: {message}")
    return error_response(ErrorCodes.DB_ERROR, message, 500)


def database_query_error(message: str = "Failed to execute database query") -> tuple:
    """Return a database query error response"""
    logger.error(f"Database query error: {message}")
    return error_response(ErrorCodes.DB_QUERY_ERROR, message, 500)


def database_integrity_error(message: str = "Database integrity constraint violated") -> tuple:
    """Return a database integrity error response"""
    logger.error(f"Database integrity error: {message}")
    return error_response(ErrorCodes.DB_INTEGRITY_ERROR, message, 409)


def database_unavailable_error(message: str = "Database temporarily unavailable") -> tuple:
    """Return a database unavailable error response"""
    logger.error(f"Database unavailable: {message}")
    return error_response(ErrorCodes.DB_UNAVAILABLE, message, 503)


# ==================== LLM ERROR HELPERS ====================
def llm_error(message: str = "LLM service error") -> tuple:
    """Return an LLM service error response"""
    logger.error(f"LLM error: {message}")
    return error_response(ErrorCodes.LLM_ERROR, message, 500)


def llm_rate_limit_error(retry_after: int = 60) -> tuple:
    """Return an LLM rate limit error response"""
    logger.warning(f"LLM rate limited, retry after {retry_after}s")
    response = error_response(
        ErrorCodes.LLM_RATE_LIMIT,
        "LLM service rate limit exceeded. Please try again later.",
        429,
        additional_data={"retry_after": retry_after}
    )
    json_response, status_code = response
    json_response.headers['Retry-After'] = str(retry_after)
    return json_response, status_code


def llm_timeout_error(message: str = "LLM request timed out") -> tuple:
    """Return an LLM timeout error response"""
    logger.warning(f"LLM timeout: {message}")
    return error_response(ErrorCodes.LLM_TIMEOUT, message, 504)


def llm_circuit_breaker_error(message: str = "LLM service temporarily unavailable") -> tuple:
    """Return an LLM circuit breaker error response"""
    logger.warning(f"LLM circuit breaker open: {message}")
    return error_response(
        ErrorCodes.LLM_CIRCUIT_BREAKER,
        message,
        503
    )


def llm_service_unavailable(message: str = "LLM service not available") -> tuple:
    """Return an LLM unavailable error response"""
    logger.warning(f"LLM service unavailable: {message}")
    return error_response(ErrorCodes.LLM_SERVICE_UNAVAILABLE, message, 503)


# ==================== EXTERNAL SERVICE ERROR HELPERS ====================
def external_service_error(service_name: str, message: str) -> tuple:
    """Return an external service error response"""
    msg = f"{service_name}: {message}"
    logger.error(f"External service error: {msg}")
    return error_response(ErrorCodes.EXTERNAL_SERVICE_ERROR, msg, 502)


# ==================== EXCEPTION HANDLER UTILITY ====================
def handle_exception(exception: Exception, endpoint: str = "unknown") -> tuple:
    """
    Handle any exception and return appropriate error response.
    
    Args:
        exception: The exception to handle
        endpoint: Name of the endpoint for logging
        
    Returns:
        Tuple of (error response, status_code)
    """
    from exceptions import (
        LLMRateLimitError, LLMTimeoutError, LLMConnectionError,
        LLMAuthenticationError, LLMCircuitBreakerOpenError,
        DatabaseException, DatabaseConnectionError, DatabaseQueryError,
        DatabaseIntegrityError, ExternalServiceException,
        ValidationException, InvalidInputError, InvalidJSONError
    )
    
    error_type = type(exception).__name__
    
    # Handle specific exceptions
    if isinstance(exception, LLMCircuitBreakerOpenError):
        logger.error(f"[{endpoint}] LLM circuit breaker open: {exception}")
        return llm_circuit_breaker_error(str(exception))
    
    elif isinstance(exception, LLMRateLimitError):
        logger.warning(f"[{endpoint}] LLM rate limit: {exception}")
        retry_after = getattr(exception, 'retry_after', 60)
        return llm_rate_limit_error(retry_after)
    
    elif isinstance(exception, LLMTimeoutError):
        logger.warning(f"[{endpoint}] LLM timeout: {exception}")
        return llm_timeout_error(str(exception))
    
    elif isinstance(exception, LLMConnectionError):
        logger.error(f"[{endpoint}] LLM connection error: {exception}")
        return llm_service_unavailable(str(exception))
    
    elif isinstance(exception, LLMAuthenticationError):
        logger.error(f"[{endpoint}] LLM authentication error: {exception}")
        return llm_error(str(exception))
    
    elif isinstance(exception, DatabaseConnectionError):
        logger.error(f"[{endpoint}] Database connection error: {exception}")
        return database_unavailable_error(str(exception))
    
    elif isinstance(exception, DatabaseQueryError):
        logger.error(f"[{endpoint}] Database query error: {exception}")
        return database_query_error(str(exception))
    
    elif isinstance(exception, DatabaseIntegrityError):
        logger.error(f"[{endpoint}] Database integrity error: {exception}")
        return database_integrity_error(str(exception))
    
    elif isinstance(exception, DatabaseException):
        logger.error(f"[{endpoint}] Database error: {exception}")
        return database_error(str(exception))
    
    elif isinstance(exception, InvalidJSONError):
        logger.warning(f"[{endpoint}] Invalid JSON: {exception}")
        return invalid_json_error()
    
    elif isinstance(exception, InvalidInputError):
        logger.warning(f"[{endpoint}] Invalid input: {exception}")
        return validation_error(str(exception))
    
    elif isinstance(exception, ValidationException):
        logger.warning(f"[{endpoint}] Validation error: {exception}")
        return validation_error(str(exception))
    
    elif isinstance(exception, ExternalServiceException):
        logger.error(f"[{endpoint}] External service error: {exception}")
        service_name = getattr(exception, 'service_name', 'external')
        return external_service_error(service_name, str(exception))
    
    else:
        # Unexpected error
        logger.error(f"[{endpoint}] Unexpected error ({error_type}): {exception}", exc_info=True)
        return internal_error(f"An unexpected error occurred. Please try again later.")
