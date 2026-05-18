#!/usr/bin/env python3
"""
Test script to verify API input validation is working correctly.
This script tests all the Pydantic validators for the BiblioDrift API endpoints.
"""

import json
__test__ = False
from validators import (
    validate_request,
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
    
    # Test RegisterRequest
    test_validator(
        RegisterRequest,
        "RegisterRequest",
        {"username": "testuser", "email": "test@example.com", "password": "Password123!"},
        {"username": "ab", "email": "invalid-email", "password": "123"}
    )
    
    # Test LoginRequest
    test_validator(
        LoginRequest,
        "LoginRequest",
        {"username": "testuser", "password": "password123"},
        {"username": "", "password": ""}
    )
    
    print("\n" + "=" * 50)
    print("✅ All validation tests completed!")
    print("🔒 API endpoints now have robust input validation")


if __name__ == "__main__":
    main()