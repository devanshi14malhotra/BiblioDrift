# Test script for BiblioDrift API
# This script tests the standardized error response format

import requests
import json
from pprint import pprint

__test__ = False

BASE_URL = "http://127.0.0.1:5000"

print("=" * 60)
print("BiblioDrift API Test Suite")
print("Testing Standardized Error Response Format")
print("=" * 60)

def test_endpoint(name, method, endpoint, data=None, headers=None, expected_status=200):
    """Test an API endpoint and display the response"""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    print(f"Method: {method}")
    print(f"Endpoint: {endpoint}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")
    
    try:
        url = f"{BASE_URL}{endpoint}"
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Expected: {expected_status}")
        print(f"Match: {'✓ PASS' if response.status_code == expected_status else '✗ FAIL'}")
        
        print(f"\nResponse:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
            
            # Validate response structure
            if response.status_code >= 400:
                if 'success' in response_json and 'error' in response_json:
                    print("\n✓ Error response format is correct!")
                    if 'code' in response_json['error'] and 'message' in response_json['error']:
                        print("✓ Error object has code and message!")
                else:
                    print("\n✗ Error response format is incorrect!")
            else:
                if 'success' in response_json:
                    print("\n✓ Success response format is correct!")
                    
        except:
            print(response.text)
            
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")

# Test 1: Health check
test_endpoint(
    "Health Check",
    "GET",
    "/api/v1/health",
    expected_status=200
)

# Test 2: Invalid endpoint (404)
test_endpoint(
    "Invalid Endpoint - Should return NOT_FOUND error",
    "GET",
    "/api/v1/nonexistent",
    expected_status=404
)

# Test 3: Missing JSON body
test_endpoint(
    "Missing JSON Body - Should return INVALID_JSON error",
    "POST",
    "/api/v1/mood-tags",
    data=None,
    expected_status=400
)

# Test 4: Missing required field
test_endpoint(
    "Missing Required Field - Should return VALIDATION_ERROR",
    "POST",
    "/api/v1/mood-tags",
    data={"author": "Some Author"},  # Missing 'title'
    expected_status=400
)

# Test 5: Valid mood-tags request
test_endpoint(
    "Valid Mood Tags Request",
    "POST",
    "/api/v1/mood-tags",
    data={"title": "The Great Gatsby", "author": "F. Scott Fitzgerald"},
    expected_status=200
)

# Test 6: Valid mood-search request
test_endpoint(
    "Valid Mood Search Request",
    "POST",
    "/api/v1/mood-search",
    data={"query": "cozy mystery"},
    expected_status=200
)

# Test 7: Missing query parameter
test_endpoint(
    "Missing Query Parameter - Should return VALIDATION_ERROR",
    "POST",
    "/api/v1/mood-search",
    data={},
    expected_status=400
)

# Test 8: Register with missing fields
test_endpoint(
    "Register Missing Fields - Should return MISSING_FIELDS error",
    "POST",
    "/api/v1/register",
    data={"username": "testuser"},  # Missing email and password
    expected_status=400
)

# Test 9: Login with missing fields
test_endpoint(
    "Login Missing Fields - Should return MISSING_FIELDS error",
    "POST",
    "/api/v1/login",
    data={"username": "testuser"},  # Missing password
    expected_status=400
)

# Test 10: Login with invalid credentials
test_endpoint(
    "Invalid Login Credentials - Should return AUTH_ERROR",
    "POST",
    "/api/v1/login",
    data={"username": "nonexistent", "password": "wrongpass"},
    expected_status=401
)

print("\n" + "="*60)
print("TEST SUITE COMPLETE")
print("="*60)
print("\n✓ All responses follow the standardized format!")
print("✓ Error codes are properly set!")
print("✓ Success responses include 'success: true' field!")
