"""
Secure request parsing and validation utilities for BiblioDrift.
Handles JSON parsing with size limits, Content-Type validation, and error recovery.
"""
import json
import logging
from typing import Any, Dict, Optional, Tuple
from flask import request
from werkzeug.exceptions import BadRequest

logger = logging.getLogger(__name__)

# Configuration for request size limits
MAX_JSON_SIZE_BYTES = 1_000_000  # 1 MB max JSON payload
MAX_NESTED_DEPTH = 50  # Prevent deeply nested JSON attacks


class JSONParseError(ValueError):
    """Custom exception for JSON parsing failures."""
    pass


def validate_content_type(allowed_types: Optional[list] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate that the request has a supported Content-Type header.
    
    Args:
        allowed_types: List of allowed Content-Type values (e.g., ['application/json'])
                      If None, defaults to ['application/json', 'application/x-www-form-urlencoded']
    
    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
    """
    if allowed_types is None:
        allowed_types = ['application/json', 'application/x-www-form-urlencoded']

    normalized_allowed_types = [content_type.strip().lower() for content_type in allowed_types]
    
    content_type = request.content_type
    
    # Missing Content-Type header
    if not content_type:
        return False, "Missing Content-Type header"
    
    # Extract base content type (without charset)
    base_content_type = content_type.split(';')[0].strip().lower()
    
    # Check if content type is in allowed list
    if base_content_type not in normalized_allowed_types:
        allowed_str = ', '.join(allowed_types)
        return False, f"Invalid Content-Type: {content_type}. Allowed: {allowed_str}"
    
    return True, None


def safe_get_json(
    force: bool = False,
    silent: bool = False,
    max_size: int = MAX_JSON_SIZE_BYTES,
    validate_type: bool = True,
    require_object: bool = True
) -> Tuple[bool, Optional[Any], Optional[str]]:
    """
    Safely parse JSON from request body with size and depth limits.
    
    Args:
        force: Force parsing even if Content-Type doesn't match (default: False)
        silent: Return None instead of raising exceptions (default: False)
        max_size: Maximum allowed request body size in bytes (default: 1MB)
        validate_type: Validate Content-Type header (default: True)
        require_object: Require the parsed JSON root to be an object/dict (default: True)
    
    Returns:
        Tuple[bool, Optional[Dict], Optional[str]]: (success, parsed_data, error_message)
        
    Examples:
        # Strict validation (recommended for production)
        success, data, error = safe_get_json()
        if not success:
            return jsonify({'error': error}), 400
        
        # Lenient parsing (development only)
        success, data, error = safe_get_json(silent=True)
    """
    try:
        # Step 1: Content-Type validation (skip if force=True)
        if validate_type and not force:
            is_valid, type_error = validate_content_type()
            if not is_valid:
                logger.warning(f"Content-Type validation failed: {type_error}")
                return False, None, type_error
        
        # Step 2: Check request size
        content_length = request.content_length
        if content_length is not None and content_length > max_size:
            error_msg = f"Request body too large: {content_length} bytes (max: {max_size})"
            logger.warning(error_msg)
            return False, None, error_msg
        
        # Step 3: Parse JSON with data validation
        if not request.is_json:
            if not force:
                error_msg = "Request body is not valid JSON"
                logger.warning(error_msg)
                return False, None, error_msg
        
        raw_data = request.get_data(as_text=True)
        
        # Check raw data size as backup
        if len(raw_data) > max_size:
            error_msg = f"Request data too large: {len(raw_data)} bytes (max: {max_size})"
            logger.warning(error_msg)
            return False, None, error_msg
        
        # Step 4: Parse JSON
        try:
            parsed_data = json.loads(raw_data)
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON syntax: {str(e)}"
            logger.warning(f"JSON parse error: {error_msg}")
            return False, None, error_msg
        
        # Step 5: Validate structure (check nesting depth)
        if not _validate_depth(parsed_data, max_depth=MAX_NESTED_DEPTH):
            error_msg = f"JSON nesting too deep (max depth: {MAX_NESTED_DEPTH})"
            logger.warning(error_msg)
            return False, None, error_msg
        
        # Step 6: Ensure parsed data is dict-like for API payloads
        if require_object and not isinstance(parsed_data, dict):
            error_msg = "JSON root must be an object, not array or primitive"
            logger.warning(error_msg)
            return False, None, error_msg
        
        logger.debug(f"Successfully parsed JSON payload: {len(raw_data)} bytes")
        return True, parsed_data, None
        
    except Exception as e:
        error_msg = f"Unexpected error parsing JSON: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        if silent:
            return False, None, error_msg
        else:
            raise JSONParseError(error_msg)


def _validate_depth(obj: Any, current_depth: int = 0, max_depth: int = MAX_NESTED_DEPTH) -> bool:
    """
    Iteratively validate JSON nesting depth to prevent stack overflow attacks.
    
    Args:
        obj: Object to validate
        current_depth: Starting depth for the provided object (internal use)
        max_depth: Maximum allowed depth
    
    Returns:
        bool: True if depth is within limits
    """
    stack = [(obj, current_depth)]

    while stack:
        value, depth = stack.pop()

        if depth > max_depth:
            return False

        if isinstance(value, dict):
            next_depth = depth + 1
            for child in value.values():
                stack.append((child, next_depth))
        elif isinstance(value, (list, tuple)):
            next_depth = depth + 1
            for child in value:
                stack.append((child, next_depth))

    return True


def get_request_arg_safe(
    key: str,
    arg_type: type = str,
    default: Any = None,
    required: bool = False,
    allowed_values: Optional[list] = None
) -> Tuple[bool, Any, Optional[str]]:
    """
    Safely retrieve and validate query/form parameters.
    
    Args:
        key: Parameter name
        arg_type: Expected type (str, int, float, bool)
        default: Default value if not provided
        required: Whether parameter is required
        allowed_values: Whitelist of allowed values (for enum-like params)
    
    Returns:
        Tuple[bool, Any, Optional[str]]: (success, parsed_value, error_message)
        
    Examples:
        # Get integer with range validation
        success, page, error = get_request_arg_safe('page', int, default=1)
        
        # Get enum-like parameter
        success, sort_by, error = get_request_arg_safe(
            'sort_by', 
            str,
            allowed_values=['date', 'name', 'rating']
        )
    """
    try:
        # If not provided and not required, return default
        if key not in request.args:
            if required:
                return False, None, f"Missing required parameter: {key}"
            return True, default, None
        
        raw_value = request.args.get(key)
        
        # Empty string handling
        if raw_value == '' or raw_value is None:
            if required:
                return False, None, f"Parameter '{key}' cannot be empty"
            return True, default, None
        
        # Type conversion with validation
        try:
            if arg_type == bool:
                # Accept only explicit boolean values; reject ambiguous strings.
                normalized_value = raw_value.strip().lower()
                true_values = ('true', '1', 'yes', 'on')
                false_values = ('false', '0', 'no', 'off')
                if normalized_value in true_values:
                    parsed_value = True
                elif normalized_value in false_values:
                    parsed_value = False
                else:
                    raise ValueError("invalid boolean value")
            elif arg_type == int:
                parsed_value = int(raw_value)
            elif arg_type == float:
                parsed_value = float(raw_value)
            else:
                parsed_value = str(raw_value).strip()
        except (ValueError, AttributeError) as e:
            return False, None, f"Invalid {arg_type.__name__} for parameter '{key}': {raw_value}"
        
        # Whitelist validation
        if allowed_values is not None and parsed_value not in allowed_values:
            allowed_str = ', '.join(str(v) for v in allowed_values)
            return False, None, f"Invalid value for '{key}': {parsed_value}. Allowed: {allowed_str}"
        
        # Additional validation for specific types
        if arg_type == int:
            if parsed_value < 0:
                return False, None, f"Parameter '{key}' must be non-negative"
            if parsed_value > 2_147_483_647:  # 2^31 - 1
                return False, None, f"Parameter '{key}' exceeds maximum value"
        
        return True, parsed_value, None
        
    except Exception as e:
        error_msg = f"Error parsing parameter '{key}': {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False, None, error_msg


def extract_json_payload(
    data: Optional[Dict[str, Any]],
    fields: Optional[Dict[str, type]] = None
) -> Tuple[bool, Dict[str, Any], Optional[str]]:
    """
    Extract and validate specific fields from parsed JSON payload.
    
    Args:
        data: Parsed JSON data (from safe_get_json)
        fields: Dict of {field_name: expected_type} to validate
    
    Returns:
        Tuple[bool, Dict, Optional[str]]: (success, extracted_fields, error_message)
        
    Examples:
        success, payload, error = extract_json_payload(
            data,
            fields={'user_id': int, 'message': str, 'tags': list}
        )
    """
    if data is None:
        return False, {}, "No data provided"
    
    if not isinstance(data, dict):
        return False, {}, "Expected JSON object (dict), not array or primitive"
    
    extracted = {}
    
    if fields:
        for field_name, expected_type in fields.items():
            if field_name not in data:
                return False, {}, f"Missing required field: {field_name}"
            
            value = data[field_name]
            
            # Type checking with some flexibility
            if not isinstance(value, expected_type):
                return False, {}, f"Field '{field_name}' has wrong type. Expected {expected_type.__name__}, got {type(value).__name__}"
            
            extracted[field_name] = value
    else:
        extracted = data
    
    return True, extracted, None
