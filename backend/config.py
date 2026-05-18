"""
Configuration management for BiblioDrift application.
Provides centralized configuration with environment-specific settings.
"""

import os
import logging
from datetime import timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class DatabaseConfig:
    """Database configuration settings."""
    url: str
    track_modifications: bool = False
    
    @classmethod
    def from_env(cls) -> 'DatabaseConfig':
        """Create database config from environment variables."""
        url = os.getenv('DATABASE_URL', 'sqlite:///instance/biblio.db')
        
        # Handle PostgreSQL URL format conversion
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        
        return cls(
            url=url,
            track_modifications=os.getenv('SQLALCHEMY_TRACK_MODIFICATIONS', 'False').lower() == 'true'
        )


@dataclass
class JWTConfig:
    """JWT authentication configuration."""
    secret_key: str
    access_token_expires: timedelta
    algorithm: str = 'HS256'
    
    @classmethod
    def from_env(cls) -> 'JWTConfig':
        """Create JWT config from environment variables."""
        return cls(
            secret_key=os.getenv('JWT_SECRET_KEY', 'default-dev-secret-key'),
            access_token_expires=timedelta(
                days=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_DAYS', '7'))
            ),
            algorithm=os.getenv('JWT_ALGORITHM', 'HS256')
        )


@dataclass
class RateLimitConfig:
    """Rate limiting configuration."""
    window_seconds: int
    max_requests: int
    enabled: bool = True
    
    @classmethod
    def from_env(cls) -> 'RateLimitConfig':
        """Create rate limit config from environment variables."""
        return cls(
            window_seconds=int(os.getenv('RATE_LIMIT_WINDOW', '60')),
            max_requests=int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '30')),
            enabled=os.getenv('RATE_LIMIT_ENABLED', 'True').lower() == 'true'
        )


@dataclass
class ServerConfig:
    """Server configuration settings."""
    host: str
    port: int
    debug: bool
    
    @classmethod
    def from_env(cls) -> 'ServerConfig':
        """Create server config from environment variables."""
        return cls(
            host=os.getenv('FLASK_HOST', '127.0.0.1'),
            port=int(os.getenv('PORT', '5000')),
            debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
        )


@dataclass
class LoggingConfig:
    """Logging configuration settings."""
    level: str
    format: str
    file_path: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> 'LoggingConfig':
        """Create logging config from environment variables."""
        return cls(
            level=os.getenv('LOG_LEVEL', 'INFO').upper(),
            format=os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s'),
            file_path=os.getenv('LOG_FILE')
        )


@dataclass
class AIServiceConfig:
    """AI service configuration."""
    openai_api_key: Optional[str]
    groq_api_key: Optional[str]
    gemini_api_key: Optional[str]
    google_books_api_key: Optional[str]
    
    @classmethod
    def from_env(cls) -> 'AIServiceConfig':
        """Create AI service config from environment variables."""
        return cls(
            openai_api_key=os.getenv('OPENAI_API_KEY'),
            groq_api_key=os.getenv('GROQ_API_KEY'),
            gemini_api_key=os.getenv('GEMINI_API_KEY'),
            google_books_api_key=os.getenv('GOOGLE_BOOKS_API_KEY')
        )


class Config:
    """Base configuration class."""
    
    def __init__(self):
        self.database = DatabaseConfig.from_env()
        self.jwt = JWTConfig.from_env()
        self.rate_limit = RateLimitConfig.from_env()
        self.server = ServerConfig.from_env()
        self.logging = LoggingConfig.from_env()
        self.ai_service = AIServiceConfig.from_env()
        
        # Additional Flask configuration
        self.flask_config = self._get_flask_config()
    
    def _get_flask_config(self) -> Dict[str, Any]:
        """Get Flask-specific configuration dictionary."""
        return {
            'SECRET_KEY': self.jwt.secret_key,
            'JWT_SECRET_KEY': self.jwt.secret_key,
            'JWT_ACCESS_TOKEN_EXPIRES': self.jwt.access_token_expires,
            'JWT_ALGORITHM': self.jwt.algorithm,
            'JWT_TOKEN_LOCATION': ['cookies'],
            'JWT_COOKIE_CSRF_PROTECT': True,
            'JWT_ACCESS_COOKIE_PATH': '/',
            'JWT_COOKIE_HTTPONLY': True,
            'JWT_COOKIE_SAMESITE': 'Lax',
            'SQLALCHEMY_DATABASE_URI': self.database.url,
            'SQLALCHEMY_TRACK_MODIFICATIONS': self.database.track_modifications,
        }
    
    def validate(self) -> tuple[bool, list[str]]:
        """
        Validate configuration settings.
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check for required environment variables
        required_vars = {
            'JWT_SECRET_KEY': 'JWT authentication secret key',
            'GOOGLE_BOOKS_API_KEY': 'Google Books API key for book discovery',
            'DATABASE_URL': 'Database connection URL'
        }
        
        for var_name, description in required_vars.items():
            value = os.getenv(var_name, '').strip()
            if not value or value.startswith('your-') or value.startswith('your_'):
                errors.append(
                    f"Missing or invalid {var_name}: {description}. "
                    f"Please set {var_name} in your .env file."
                )
        
        # Validate JWT secret key
        if self.jwt.secret_key == 'default-dev-secret-key':
            if self.is_production():
                errors.append("JWT_SECRET_KEY must be set to a secure value in production")
            elif len(self.jwt.secret_key) < 32:
                errors.append("JWT_SECRET_KEY should be at least 32 characters long")
        
        # =====================================================================
        # DATABASE CONFIGURATION VALIDATION (PARSER-BASED AND LESS FRAGILE)
        # =====================================================================
        # Use SQLAlchemy's URL parser to inspect the connection string instead
        # of lowercasing the entire URL or relying on brittle substring tests.
        # We still fail fast for obviously dangerous configurations (sqlite,
        # non-postgres drivers) but treat missing credentials as a warning so
        # uncommon-but-valid setups (unix sockets, managed auth) are not
        # rejected outright.
        # =====================================================================

        if self.is_production():
            warnings = []
            raw_db_url = str(self.database.url).strip()

            try:
                from sqlalchemy.engine import make_url
                parsed = make_url(raw_db_url)
                drivername = getattr(parsed, 'drivername', None)
                username = getattr(parsed, 'username', None)
                host = getattr(parsed, 'host', None)
            except Exception:
                # If parsing fails, be conservative and report an error so ops
                # can correct a malformed DATABASE_URL.
                errors.append(
                    "Malformed DATABASE_URL: could not parse the provided connection string."
                )
                drivername = None
                username = None
                host = None

            # Fail for explicit sqlite usage
            if drivername == 'sqlite':
                errors.append(
                    "DATABASE_URL must be a PostgreSQL URI in production; detected sqlite://"
                )

            # Fail for non-Postgres drivers
            elif drivername and drivername not in ('postgresql', 'postgres'):
                errors.append(
                    f"Unsupported database driver in production: '{drivername}'. Use 'postgresql://'."
                )

            # For Postgres, check for credentials but treat missing username as a WARNING
            elif drivername in ('postgresql', 'postgres'):
                if not username:
                    # If host is empty/None this is likely malformed or a socket-only
                    # URL; provide a visible warning but do not abort startup.
                    if not host:
                        warnings.append(
                            "Production DATABASE_URL appears to be missing credentials (username). "
                            "Provide a username:password@host in the URL or ensure your deployment "
                            "is intentionally using an alternative auth mechanism."
                        )
                    else:
                        warnings.append(
                            "Production DATABASE_URL does not include a username. "
                            "If you intentionally rely on unix-socket or provider-managed auth, "
                            "confirm this configuration. Otherwise, include credentials."
                        )

            # Emit warnings to stdout so operators see them during startup. We
            # avoid raising for warnings so the service can still start in edge
            # cases (e.g., some managed auth flows). Fatal errors remain in
            # `errors` and will be raised by validate_required_env_vars().
            if warnings:
                for w in warnings:
                    print("CONFIG WARNING:", w)

        # =====================================================================
        # END OF DATABASE CONFIGURATION VALIDATION BLOCK
        # =====================================================================
        
        # Validate server configuration
        if self.server.port < 1 or self.server.port > 65535:
            errors.append(f"Invalid port number: {self.server.port}")
        
        # Validate rate limiting
        if self.rate_limit.enabled:
            if self.rate_limit.window_seconds <= 0:
                errors.append("Rate limit window must be positive")
            if self.rate_limit.max_requests <= 0:
                errors.append("Rate limit max requests must be positive")
        
        # Validate logging level
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if self.logging.level not in valid_levels:
            errors.append(f"Invalid log level: {self.logging.level}. Must be one of {valid_levels}")
        
        return len(errors) == 0, errors
    
    def is_production(self) -> bool:
        """Check if running in production mode."""
        flask_env = os.getenv('FLASK_ENV', '').lower()
        app_env = os.getenv('APP_ENV', '').lower()
        
        return (
            flask_env == 'production' or 
            app_env == 'production' or 
            not self.server.debug
        )
    
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return not self.is_production()
    
    def get_environment_name(self) -> str:
        """Get the current environment name."""
        return os.getenv('APP_ENV', 'development' if self.is_development() else 'production')


class DevelopmentConfig(Config):
    """Development environment configuration."""
    
    def __init__(self):
        super().__init__()
        # Development-specific overrides
        if not os.getenv('FLASK_HOST'):
            self.server.host = '127.0.0.1'  # Localhost only for security
        if not os.getenv('LOG_LEVEL'):
            self.logging.level = 'DEBUG'


class ProductionConfig(Config):
    """Production environment configuration."""
    
    def __init__(self):
        super().__init__()
        # Production-specific overrides
        if not os.getenv('LOG_LEVEL'):
            self.logging.level = 'WARNING'
        
        # Force secure settings in production
        self.server.debug = False


class TestingConfig(Config):
    """Testing environment configuration."""
    
    def __init__(self):
        super().__init__()
        # Testing-specific overrides
        if not os.getenv('DATABASE_URL'):
            self.database.url = 'sqlite:///:memory:'
        if not os.getenv('LOG_LEVEL'):
            self.logging.level = 'ERROR'
        
        # Disable rate limiting for tests
        self.rate_limit.enabled = False


def get_config() -> Config:
    """
    Get configuration based on environment.
    
    Returns:
        Appropriate configuration instance based on APP_ENV
    """
    env = os.getenv('APP_ENV', 'development').lower()
    
    config_map = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig,
        'test': TestingConfig,
    }
    
    config_class = config_map.get(env, DevelopmentConfig)
    return config_class()


def setup_logging(config: Config) -> logging.Logger:
    """
    Setup logging based on configuration.
    
    Args:
        config: Configuration instance
        
    Returns:
        Configured logger
    """
    handlers = [logging.StreamHandler()]
    
    if config.logging.file_path:
        handlers.append(logging.FileHandler(config.logging.file_path))
    
    logging.basicConfig(
        level=getattr(logging, config.logging.level),
        format=config.logging.format,
        handlers=handlers,
        force=True  # Override any existing configuration
    )
    
    return logging.getLogger(__name__)


# Global configuration instance
app_config = get_config()


def validate_required_env_vars() -> None:
    """
    Validate that all required environment variables are set at startup.
    
    This function checks for critical configuration values that are needed
    for the application to function properly. It's called before the Flask
    app starts accepting requests.
    
    Raises:
        ValueError: If any required environment variables are missing or invalid.
    """
    is_valid, errors = app_config.validate()
    
    if not is_valid:
        error_message = (
            "\n" + "="*70 + "\n"
            "STARTUP ERROR: Missing or Invalid Environment Variables\n"
            "="*70 + "\n" +
            "\n".join(errors) +
            "\n\n" +
            "Please check your .env file and ensure all required variables are set.\n"
            "See config/.env.example for reference.\n" +
            "="*70 + "\n"
        )
        raise ValueError(error_message)