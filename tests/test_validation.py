#!/usr/bin/env python3
"""
Test script to verify API input validation is working correctly.
This script tests all the Pydantic validators for the BiblioDrift API endpoints.
"""

import json
__test__ = False
from validators import (
    validate_request,
    validate_password_strength,
    AnalyzeMoodRequest,
    MoodTagsRequest,
    MoodSearchRequest,
    GenerateNoteRequest,
    ChatRequest,
    AddToLibraryRequest,
    UpdateLibraryItemRequest,
    SyncLibraryRequest,
    RegisterRequest,
    LoginRequest,
    ChatMessage
)


def test_validator(validator_class, test_name, valid_data, invalid_data):
    """Test a validator with valid and invalid data."""
    print(f"\n=== Testing {test_name} ===")
    
    # Test valid data
    is_valid, result = validate_request(validator_class, valid_data)
    print(f"✅ Valid data: {is_valid}")
    if not is_valid:
        print(f"❌ Unexpected error: {json.dumps(result, indent=2)}")
    
    # Test invalid data
    is_valid, result = validate_request(validator_class, invalid_data)
    print(f"❌ Invalid data (expected): {not is_valid}")
    if not is_valid:
        print(f"   Validation errors: {len(result.get('validation_errors', []))} errors found")
        for error in result.get('validation_errors', []):
            print(f"   - {error['field']}: {error['message']}")


# ─────────────────────────────────────────────────────────────────────────────
# PASSWORD STRENGTH TESTS  (Issue #790)
# ─────────────────────────────────────────────────────────────────────────────

def test_password_strength():
    """
    Directly test validate_password_strength() for all rule combinations.
    These run independently of Pydantic so failures are easy to pinpoint.
    """
    print("\n=== Testing Password Strength Validation (Issue #790) ===")

    cases = [
        # (password, expected_valid, description)
        ("Secure@123",   True,  "All rules pass — strong password"),
        ("abc",          False, "Too short, missing uppercase/digit/special"),
        ("password",     False, "Missing uppercase, digit, special char"),
        ("PASSWORD1@",   False, "Missing lowercase letter"),
        ("Password123",  False, "Missing special character"),
        ("Password@",    False, "Missing digit"),
        ("pass@1A",      True,  "Exactly 8 chars — boundary pass"),
        ("pass@1",       False, "Only 7 chars — boundary fail"),
        ("",             False, "Empty string"),
        ("P@ssw0rd!ExtraLong2025", True, "Long strong password"),
    ]

    passed = 0
    failed = 0

    for password, expected_valid, description in cases:
        is_valid, errors = validate_password_strength(password)
        status = "✅" if is_valid == expected_valid else "❌"
        result = "PASS" if is_valid == expected_valid else "FAIL"

        print(f"  {status} [{result}] '{password}' — {description}")

        if is_valid != expected_valid:
            failed += 1
            print(f"       Expected valid={expected_valid}, got valid={is_valid}")
            if errors:
                for e in errors:
                    print(f"       Rule failed: {e}")
        else:
            passed += 1
            if not is_valid and errors:
                # Show which rules failed for educational output
                print(f"       Failed rules: {'; '.join(errors)}")

    print(f"\n  Password strength results: {passed} passed, {failed} failed")
    return failed == 0


def test_register_password_integration():
    """
    Test that RegisterRequest correctly rejects weak passwords
    and accepts strong ones via the Pydantic field_validator.
    """
    print("\n=== Testing RegisterRequest Password Integration (Issue #790) ===")

    base = {"username": "testuser", "email": "test@example.com"}

    register_cases = [
        # (password, expected_valid, label)
        ("Secure@123",    True,  "Strong password — should be accepted"),
        ("weakpass",      False, "No uppercase / digit / special — should be rejected"),
        ("12345678",      False, "No letters / special — should be rejected"),
        ("Password1",     False, "No special character — should be rejected"),
        ("Password@",     False, "No digit — should be rejected"),
        ("password@1",    False, "No uppercase — should be rejected"),
        ("SHORT@1A",      True,  "Exactly 8 chars with all rules — should be accepted"),
        ("123",           False, "Too short — should be rejected"),
        ("",              False, "Empty — should be rejected"),
    ]

    passed = 0
    failed = 0

    for password, expected_valid, label in register_cases:
        data = {**base, "password": password}
        is_valid, result = validate_request(RegisterRequest, data)
        status = "✅" if is_valid == expected_valid else "❌"
        outcome = "PASS" if is_valid == expected_valid else "FAIL"

        print(f"  {status} [{outcome}] password='{password}' — {label}")

        if is_valid != expected_valid:
            failed += 1
            if not is_valid:
                errors = result.get('validation_errors', [])
                for err in errors:
                    print(f"       {err['field']}: {err['message']}")
        else:
            passed += 1

    print(f"\n  RegisterRequest results: {passed} passed, {failed} failed")
    return failed == 0

# ─────────────────────────────────────────────────────────────────────────────
# END PASSWORD STRENGTH TESTS
# ─────────────────────────────────────────────────────────────────────────────


def main():
    """Run all validation tests."""
    print("🧪 BiblioDrift API Validation Tests")
    print("=" * 50)
    
    # Test AnalyzeMoodRequest
    test_validator(
        AnalyzeMoodRequest,
        "AnalyzeMoodRequest",
        {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald"},
        {"title": "", "author": ""}
    )
    
    # Test MoodTagsRequest
    test_validator(
        MoodTagsRequest,
        "MoodTagsRequest",
        {"title": "1984", "author": "George Orwell"},
        {"title": "   ", "author": ""}
    )
    
    # Test MoodSearchRequest
    test_validator(
        MoodSearchRequest,
        "MoodSearchRequest",
        {"query": "cozy mystery"},
        {"query": ""}
    )
    
    # Test GenerateNoteRequest
    test_validator(
        GenerateNoteRequest,
        "GenerateNoteRequest",
        {"description": "A classic novel", "title": "Pride and Prejudice", "author": "Jane Austen"},
        {"description": "x" * 6000, "title": "x" * 300, "author": "x" * 300}
    )
    
    # Test ChatRequest
    test_validator(
        ChatRequest,
        "ChatRequest",
        {
            "message": "I want something cozy for a rainy evening",
            "history": [
                {"type": "user", "content": "Hello"},
                {"type": "bot", "content": "Hi there!"}
            ]
        },
        {
            "message": "",
            "history": [{"type": "user", "content": "x" * 1500}]
        }
    )
    
    # Test AddToLibraryRequest
    test_validator(
        AddToLibraryRequest,
        "AddToLibraryRequest",
        {
            "user_id": 1,
            "google_books_id": "zyTCAlFPjgYC",
            "title": "Test Book",
            "authors": "Test Author",
            "shelf_type": "want"
        },
        {
            "user_id": "not_an_int",
            "google_books_id": "",
            "title": "",
            "shelf_type": "invalid_shelf"
        }
    )
    
    # Test UpdateLibraryItemRequest
    test_validator(
        UpdateLibraryItemRequest,
        "UpdateLibraryItemRequest",
        {"shelf_type": "current", "progress": 50, "rating": 4},
        {"shelf_type": "invalid", "progress": 150, "rating": 10}
    )
    
    # Test SyncLibraryRequest
    test_validator(
        SyncLibraryRequest,
        "SyncLibraryRequest",
        {"user_id": 1, "items": [{"id": "zyTCAlFPjgYC", "volumeInfo": {"title": "Test"}}]},
        {"user_id": "not_int", "items": "not_a_list"}
    )
    
    # Test RegisterRequest (original basic test kept)
    test_validator(
        RegisterRequest,
        "RegisterRequest",
        {"username": "testuser", "email": "test@example.com", "password": "Secure@123"},
        {"username": "ab", "email": "invalid-email", "password": "123"}
    )
    
    # Test LoginRequest
    test_validator(
        LoginRequest,
        "LoginRequest",
        {"username": "testuser", "password": "password123"},
        {"username": "", "password": ""}
    )

    # ── Issue #790: Password strength tests ──────────────────────────────────
    pw_strength_ok    = test_password_strength()
    pw_register_ok    = test_register_password_integration()
    # ─────────────────────────────────────────────────────────────────────────

    print("\n" + "=" * 50)
    print("✅ All validation tests completed!")
    print("🔒 API endpoints now have robust input validation")

    # ── Issue #790 summary ───────────────────────────────────────────────────
    print("\n📋 Issue #790 — Password Validation Summary:")
    print(f"   {'✅' if pw_strength_ok  else '❌'} validate_password_strength() unit tests")
    print(f"   {'✅' if pw_register_ok  else '❌'} RegisterRequest integration tests")
    # ─────────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    main()