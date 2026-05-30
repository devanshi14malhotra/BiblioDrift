"""
Custom exception classes for BiblioDrift API.
Provides specific exception types for different failure scenarios to replace broad Exception handling.
"""


class BiblioDriftException(Exception):
    """Base exception for all BiblioDrift-specific errors."""
    
    def __init__(self, message: str, error_code: str = "INTERNAL_ERROR", status_code: int = 500):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


# ==================== DATABASE EXCEPTIONS ====================
class DatabaseException(BiblioDriftException):
    """Base exception for database-related errors."""
    
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message, "DATABASE_ERROR", status_code)


class DatabaseConnectionError(DatabaseException):
    """Raised when database connection fails."""
    
    def __init__(self, message: str = "Failed to connect to database"):
        super().__init__(message, "DB_CONNECTION_ERROR", 503)


class DatabaseQueryError(DatabaseException):
    """Raised when a database query fails."""
    
    def __init__(self, message: str = "Database query failed"):
        super().__init__(message, "DB_QUERY_ERROR", 500)


class DatabaseIntegrityError(DatabaseException):
    """Raised when database integrity constraints are violated."""
    
    def __init__(self, message: str = "Database integrity constraint violated"):
        super().__init__(message, "DB_INTEGRITY_ERROR", 409)


class ResourceNotFoundError(DatabaseException):
    """Raised when a requested resource is not found."""
    
    def __init__(self, resource_type: str = "Resource"):
        message = f"{resource_type} not found"
        super().__init__(message, "RESOURCE_NOT_FOUND", 404)


# ==================== VALIDATION EXCEPTIONS ====================
class ValidationException(BiblioDriftException):
    """Base exception for validation errors."""
    
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message, "VALIDATION_ERROR", status_code)


class InvalidInputError(ValidationException):
    """Raised when input validation fails."""
    
    def __init__(self, message: str = "Invalid input"):
        super().__init__(message, "INVALID_INPUT", 400)


class MissingFieldError(ValidationException):
    """Raised when required fields are missing."""
    
    def __init__(self, fields: list[str]):
        message = f"Missing required fields: {', '.join(fields)}"
        super().__init__(message, "MISSING_FIELDS", 400)


class InvalidJSONError(ValidationException):
    """Raised when JSON parsing fails."""
    
    def __init__(self, message: str = "Invalid or malformed JSON"):
        super().__init__(message, "INVALID_JSON", 400)


# ==================== LLM/AI EXCEPTIONS ====================
class AIServiceException(BiblioDriftException):
    """Base exception for AI service errors."""
    
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message, "AI_SERVICE_ERROR", status_code)


class LLMRateLimitError(AIServiceException):
    """Raised when LLM API rate limit is exceeded."""
    
    def __init__(self, message: str = "LLM rate limit exceeded", retry_after: int = 60):
        super().__init__(message, "LLM_RATE_LIMIT", 429)
        self.retry_after = retry_after


class LLMTimeoutError(AIServiceException):
    """Raised when LLM API request times out."""
    
    def __init__(self, message: str = "LLM request timed out"):
        super().__init__(message, "LLM_TIMEOUT", 504)


class LLMConnectionError(AIServiceException):
    """Raised when LLM API connection fails."""
    
    def __init__(self, message: str = "Failed to connect to LLM service"):
        super().__init__(message, "LLM_CONNECTION_ERROR", 503)


class LLMAuthenticationError(AIServiceException):
    """Raised when LLM API authentication fails."""
    
    def __init__(self, message: str = "Invalid LLM API credentials"):
        super().__init__(message, "LLM_AUTH_ERROR", 401)


class LLMCircuitBreakerOpenError(AIServiceException):
    """Raised when LLM circuit breaker is open (service degraded)."""
    
    def __init__(self, message: str = "LLM service temporarily unavailable"):
        super().__init__(message, "LLM_CIRCUIT_BREAKER_OPEN", 503)


# ==================== AUTHENTICATION/AUTHORIZATION EXCEPTIONS ====================
class AuthenticationException(BiblioDriftException):
    """Base exception for authentication errors."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, "AUTH_ERROR", 401)


class InvalidCredentialsError(AuthenticationException):
    """Raised when credentials are invalid."""
    
    def __init__(self, message: str = "Invalid username or password"):
        super().__init__(message, "INVALID_CREDENTIALS", 401)


class UnauthorizedAccessError(AuthenticationException):
    """Raised when user lacks required permissions."""
    
    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(message, "UNAUTHORIZED_ACCESS", 403)


# ==================== RATE LIMITING EXCEPTIONS ====================
class RateLimitException(BiblioDriftException):
    """Base exception for rate limiting."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", 429)
        self.retry_after = retry_after


# ==================== EXTERNAL SERVICE EXCEPTIONS ====================
class ExternalServiceException(BiblioDriftException):
    """Base exception for external service errors."""
    
    def __init__(self, message: str, service_name: str = "external service"):
        msg = f"{service_name}: {message}"
        super().__init__(msg, "EXTERNAL_SERVICE_ERROR", 503)


class GoodReadsScrapingError(ExternalServiceException):
    """Raised when GoodReads scraping fails."""
    
    def __init__(self, message: str = "Failed to scrape GoodReads"):
        super().__init__(message, "GoodReads")


class GoogleBooksAPIError(ExternalServiceException):
    """Raised when Google Books API request fails."""
    
    def __init__(self, message: str = "Google Books API error"):
        super().__init__(message, "Google Books API")


class CacheServiceException(ExternalServiceException):
    """Raised when cache service fails."""
    
    def __init__(self, message: str = "Cache service error"):
        super().__init__(message, "Cache Service")
