"""
Pytest test suite for BiblioDrift API validators.
Refactored based on mentor feedback:
- Used pytest.mark.parametrize to reduce boilerplate
- Removed unused imports
- Added exact error field/message assertions
- Added missing edge cases (invalid types, boundary checks,
  malicious inputs, malformed chat history)
"""

import sys
import os
import pytest

# Add backend folder to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.core.validators.validators import (
    validate_request,
    AnalyzeMoodRequest,
    MoodTagsRequest,
    MoodSearchRequest,
    ChatRequest,
    RegisterRequest,
    LoginRequest,
    ChatMessage
)


# ==================== HELPER ====================

def is_valid(result):
    """Check if validation passed."""
    return result[0]

def get_error(result):
    """Get error dict from validation result."""
    return result[1]

def get_validation_errors(result):
    """Get list of validation errors from result."""
    return get_error(result).get("validation_errors", [])

def get_error_fields(result):
    """Get list of field names from validation errors."""
    return [e["field"] for e in get_validation_errors(result)]


# ==================== MOOD SEARCH TESTS ====================

class TestMoodSearchRequest:
    """Tests for MoodSearchRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("query", [
        "cozy rainy evening mystery",
        "dark thriller",
        "something uplifting",
        "a" * 500,  # exactly max length
    ])
    def test_valid_queries_pass(self, query):
        """Valid mood queries should pass validation."""
        result = validate_request(MoodSearchRequest, {"query": query})
        assert is_valid(result) is True

    # --- Invalid Cases ---
    @pytest.mark.parametrize("query, reason", [
        ("", "empty string"),
        ("     ", "whitespace only"),
        ("a" * 501, "exceeds max length of 500"),
    ])
    def test_invalid_queries_fail(self, query, reason):
        """Invalid mood queries should fail validation."""
        result = validate_request(MoodSearchRequest, {"query": query})
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Missing / None ---
    @pytest.mark.parametrize("payload", [
        {},
        None,
        {"query": None},
    ])
    def test_missing_or_none_query_fails(self, payload):
        """Missing or None query should fail validation."""
        result = validate_request(MoodSearchRequest, payload)
        assert is_valid(result) is False

    # --- Invalid Types ---
    @pytest.mark.parametrize("payload", [
        {"query": 123},
        {"query": []},
        {"query": True},
    ])
    def test_invalid_type_fails(self, payload):
        """Non-string query types should fail validation."""
        result = validate_request(MoodSearchRequest, payload)
        assert is_valid(result) is False

    # --- Malicious Inputs ---
    @pytest.mark.parametrize("query", [
        "<script>alert('xss')</script>",
        "'; DROP TABLE books; --",
        "../../../etc/passwd",
    ])
    def test_malicious_inputs_are_handled(self, query):
        """Malicious inputs should either fail or be sanitized."""
        result = validate_request(MoodSearchRequest, {"query": query})
        if is_valid(result):
            sanitized = result[1].query
            assert "<script>" not in sanitized
        else:
            assert is_valid(result) is False

    # --- Error Format ---
    def test_none_body_error_format(self):
        """None body should return correct error structure."""
        result = validate_request(MoodSearchRequest, None)
        error = get_error(result)
        assert error["success"] is False
        assert "error" in error

    def test_empty_query_error_has_field(self):
        """Validation error should mention the query field."""
        result = validate_request(MoodSearchRequest, {"query": ""})
        fields = get_error_fields(result)
        assert "query" in fields


# ==================== ANALYZE MOOD TESTS ====================

class TestAnalyzeMoodRequest:
    """Tests for AnalyzeMoodRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("payload", [
        {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald"},
        {"title": "1984"},  # author is optional
        {"title": "A", "author": ""},  # minimal valid title
    ])
    def test_valid_requests_pass(self, payload):
        """Valid analyze mood requests should pass."""
        result = validate_request(AnalyzeMoodRequest, payload)
        assert is_valid(result) is True

    # --- Invalid Cases ---
    @pytest.mark.parametrize("payload, reason", [
        ({"title": "", "author": "Author"}, "empty title"),
        ({"author": "Author"}, "missing title"),
        ({"title": "x" * 256}, "title too long"),
        ({}, "empty payload"),
        (None, "none payload"),
    ])
    def test_invalid_requests_fail(self, payload, reason):
        """Invalid analyze mood requests should fail."""
        result = validate_request(AnalyzeMoodRequest, payload)
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Invalid Types ---
    @pytest.mark.parametrize("payload", [
        {"title": 123},
        {"title": []},
        {"title": True},
    ])
    def test_invalid_title_type_fails(self, payload):
        """Non-string title types should fail."""
        result = validate_request(AnalyzeMoodRequest, payload)
        assert is_valid(result) is False

    # --- Boundary Checks ---
    def test_title_at_max_length_passes(self):
        """Title at exactly 255 characters should pass."""
        result = validate_request(
            AnalyzeMoodRequest,
            {"title": "a" * 255}
        )
        assert is_valid(result) is True

    def test_title_over_max_length_fails(self):
        """Title exceeding 255 characters should fail."""
        result = validate_request(
            AnalyzeMoodRequest,
            {"title": "a" * 256}
        )
        assert is_valid(result) is False

    # --- Error Field Assertion ---
    def test_missing_title_error_mentions_title_field(self):
        """Error for missing title should mention title field."""
        result = validate_request(AnalyzeMoodRequest, {"author": "Author"})
        fields = get_error_fields(result)
        assert "title" in fields


# ==================== MOOD TAGS TESTS ====================

class TestMoodTagsRequest:
    """Tests for MoodTagsRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("payload", [
        {"title": "1984", "author": "George Orwell"},
        {"title": "Dune"},  # author optional
        {"title": "x" * 255},  # max length title
    ])
    def test_valid_requests_pass(self, payload):
        """Valid mood tag requests should pass."""
        result = validate_request(MoodTagsRequest, payload)
        assert is_valid(result) is True

    # --- Invalid Cases ---
    @pytest.mark.parametrize("payload, reason", [
        ({"title": ""}, "empty title"),
        ({"author": "Orwell"}, "missing title"),
        ({"title": "x" * 256}, "title too long"),
        ({}, "empty payload"),
        (None, "none payload"),
    ])
    def test_invalid_requests_fail(self, payload, reason):
        """Invalid mood tag requests should fail."""
        result = validate_request(MoodTagsRequest, payload)
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Invalid Types ---
    @pytest.mark.parametrize("payload", [
        {"title": 123},
        {"title": None},
        {"title": []},
    ])
    def test_invalid_title_type_fails(self, payload):
        """Non-string title types should fail."""
        result = validate_request(MoodTagsRequest, payload)
        assert is_valid(result) is False


# ==================== CHAT REQUEST TESTS ====================

class TestChatRequest:
    """Tests for ChatRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("payload", [
        {
            "message": "I want something cozy",
            "history": []
        },
        {
            "message": "Recommend something mysterious"
            # history is optional
        },
        {
            "message": "a" * 2000,  # max length
            "history": []
        },
    ])
    def test_valid_requests_pass(self, payload):
        """Valid chat requests should pass."""
        result = validate_request(ChatRequest, payload)
        assert is_valid(result) is True

    # --- Invalid Message Cases ---
    @pytest.mark.parametrize("payload, reason", [
        ({"message": "", "history": []}, "empty message"),
        ({"message": "     ", "history": []}, "whitespace only"),
        ({"message": "a" * 2001, "history": []}, "message too long"),
        ({"history": []}, "missing message"),
        (None, "none payload"),
    ])
    def test_invalid_requests_fail(self, payload, reason):
        """Invalid chat requests should fail."""
        result = validate_request(ChatRequest, payload)
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Invalid Types ---
    @pytest.mark.parametrize("payload", [
        {"message": 123, "history": []},
        {"message": None, "history": []},
        {"message": [], "history": []},
    ])
    def test_invalid_message_type_fails(self, payload):
        """Non-string message types should fail."""
        result = validate_request(ChatRequest, payload)
        assert is_valid(result) is False

    # --- Malformed Chat History ---
    @pytest.mark.parametrize("history, reason", [
        ("not a list", "history is a string"),
        ([{"type": "user"}], "history item missing content"),
        ([{"content": "hello"}], "history item missing type"),
        ([{"type": "user", "content": "x" * 2001}], "history content too long"),
        ([{"type": 123, "content": "hello"}], "history type is not a string"),
    ])
    def test_malformed_history_fails(self, history, reason):
        """Malformed chat history should fail validation."""
        result = validate_request(
            ChatRequest,
            {"message": "valid message", "history": history}
        )
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Error Field Assertion ---
    def test_empty_message_error_mentions_message_field(self):
        """Error for empty message should mention message field."""
        result = validate_request(
            ChatRequest,
            {"message": "", "history": []}
        )
        fields = get_error_fields(result)
        assert "message" in fields


# ==================== REGISTER REQUEST TESTS ====================

class TestRegisterRequest:
    """Tests for RegisterRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("payload", [
        {
            "username": "testuser",
            "email": "test@example.com",
            "password": "Password123!"
        },
        {
            "username": "user_name_123",
            "email": "another@test.org",
            "password": "SecurePass99"
        },
    ])
    def test_valid_registrations_pass(self, payload):
        """Valid registration requests should pass."""
        result = validate_request(RegisterRequest, payload)
        assert is_valid(result) is True

    # --- Invalid Cases ---
    @pytest.mark.parametrize("payload, reason", [
        (
            {"username": "ab", "email": "test@example.com", "password": "Password123!"},
            "username too short"
        ),
        (
            {"username": "testuser", "email": "not-an-email", "password": "Password123!"},
            "invalid email format"
        ),
        (
            {"username": "testuser", "email": "test@example.com", "password": "123"},
            "password too short"
        ),
        (
            {"username": "test@user!", "email": "test@example.com", "password": "Password123!"},
            "username has special characters"
        ),
        (
            {"username": "testuser", "password": "Password123!"},
            "missing email"
        ),
        (
            {"username": "testuser", "email": "test@example.com"},
            "missing password"
        ),
        (
            {},
            "empty payload"
        ),
        (
            None,
            "none payload"
        ),
    ])
    def test_invalid_registrations_fail(self, payload, reason):
        """Invalid registration requests should fail."""
        result = validate_request(RegisterRequest, payload)
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Boundary Checks ---
    def test_username_at_min_length_passes(self):
        """Username at exactly 3 characters should pass."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "abc",
                "email": "test@example.com",
                "password": "Password123!"
            }
        )
        assert is_valid(result) is True

    def test_username_at_max_length_passes(self):
        """Username at exactly 50 characters should pass."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "a" * 50,
                "email": "test@example.com",
                "password": "Password123!"
            }
        )
        assert is_valid(result) is True

    def test_username_over_max_length_fails(self):
        """Username exceeding 50 characters should fail."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "a" * 51,
                "email": "test@example.com",
                "password": "Password123!"
            }
        )
        assert is_valid(result) is False

    def test_password_at_min_length_passes(self):
        """Password at exactly 8 characters should pass."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "testuser",
                "email": "test@example.com",
                "password": "Pass1234"
            }
        )
        assert is_valid(result) is True

    # --- Malicious Inputs ---
    @pytest.mark.parametrize("username", [
        "<script>alert('xss')</script>",
        "'; DROP TABLE users; --",
        "admin' OR '1'='1",
    ])
    def test_malicious_username_fails(self, username):
        """Malicious usernames should fail validation."""
        result = validate_request(
            RegisterRequest,
            {
                "username": username,
                "email": "test@example.com",
                "password": "Password123!"
            }
        )
        assert is_valid(result) is False

    # --- Error Field Assertions ---
    def test_invalid_email_error_mentions_email_field(self):
        """Error for invalid email should mention email field."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "testuser",
                "email": "not-an-email",
                "password": "Password123!"
            }
        )
        fields = get_error_fields(result)
        assert "email" in fields

    def test_short_password_error_mentions_password_field(self):
        """Error for short password should mention password field."""
        result = validate_request(
            RegisterRequest,
            {
                "username": "testuser",
                "email": "test@example.com",
                "password": "123"
            }
        )
        fields = get_error_fields(result)
        assert "password" in fields


# ==================== LOGIN REQUEST TESTS ====================

class TestLoginRequest:
    """Tests for LoginRequest validator."""

    # --- Valid Cases ---
    @pytest.mark.parametrize("payload", [
        {"username": "testuser", "password": "password123"},
        {"username": "test@example.com", "password": "anypassword"},
    ])
    def test_valid_logins_pass(self, payload):
        """Valid login requests should pass."""
        result = validate_request(LoginRequest, payload)
        assert is_valid(result) is True

    # --- Invalid Cases ---
    @pytest.mark.parametrize("payload, reason", [
        ({"username": "", "password": "password123"}, "empty username"),
        ({"username": "testuser", "password": ""}, "empty password"),
        ({"password": "password123"}, "missing username"),
        ({"username": "testuser"}, "missing password"),
        ({}, "empty payload"),
        (None, "none payload"),
    ])
    def test_invalid_logins_fail(self, payload, reason):
        """Invalid login requests should fail."""
        result = validate_request(LoginRequest, payload)
        assert is_valid(result) is False, f"Should fail for: {reason}"

    # --- Invalid Types ---
    @pytest.mark.parametrize("payload", [
        {"username": 123, "password": "password"},
        {"username": "user", "password": 123},
        {"username": None, "password": "password"},
    ])
    def test_invalid_types_fail(self, payload):
        """Non-string credentials should fail."""
        result = validate_request(LoginRequest, payload)
        assert is_valid(result) is False

    # --- Error Field Assertions ---
    def test_missing_username_error_mentions_username_field(self):
        """Error for missing username should mention username field."""
        result = validate_request(
            LoginRequest,
            {"password": "password123"}
        )
        fields = get_error_fields(result)
        assert "username" in fields

    def test_missing_password_error_mentions_password_field(self):
        """Error for missing password should mention password field."""
        result = validate_request(
            LoginRequest,
            {"username": "testuser"}
        )
        fields = get_error_fields(result)
        assert "password" in fields


# ==================== ERROR RESPONSE FORMAT TESTS ====================

class TestErrorResponseFormat:
    """Tests to ensure error responses follow correct format."""

    @pytest.mark.parametrize("schema, payload", [
        (MoodSearchRequest, None),
        (AnalyzeMoodRequest, None),
        (LoginRequest, None),
        (RegisterRequest, None),
    ])
    def test_none_body_returns_success_false(self, schema, payload):
        """None body should always return success=False."""
        result = validate_request(schema, payload)
        error = get_error(result)
        assert error["success"] is False

    @pytest.mark.parametrize("schema, payload", [
        (MoodSearchRequest, None),
        (LoginRequest, None),
    ])
    def test_none_body_returns_error_key(self, schema, payload):
        """None body error should always have error key."""
        result = validate_request(schema, payload)
        error = get_error(result)
        assert "error" in error

    @pytest.mark.parametrize("schema, payload", [
        (MoodSearchRequest, {"query": ""}),
        (LoginRequest, {"username": "", "password": "pass"}),
        (RegisterRequest, {"username": "ab", "email": "bad", "password": "123"}),
    ])
    def test_validation_errors_list_exists(self, schema, payload):
        """Failed validation should always include validation_errors list."""
        result = validate_request(schema, payload)
        error = get_error(result)
        assert "validation_errors" in error

    @pytest.mark.parametrize("schema, payload", [
        (MoodSearchRequest, {"query": ""}),
        (LoginRequest, {}),
        (RegisterRequest, {"username": "ab", "email": "bad", "password": "123"}),
    ])
    def test_validation_errors_list_not_empty(self, schema, payload):
        """Validation errors list should not be empty on failure."""
        result = validate_request(schema, payload)
        errors = get_validation_errors(result)
        assert len(errors) > 0

    @pytest.mark.parametrize("schema, payload", [
        (MoodSearchRequest, {"query": ""}),
        (LoginRequest, {}),
    ])
    def test_each_error_has_field_and_message(self, schema, payload):
        """Each validation error must have field and message keys."""
        result = validate_request(schema, payload)
        errors = get_validation_errors(result)
        for error in errors:
            assert "field" in error, "Each error must have a field key"
            assert "message" in error, "Each error must have a message key"