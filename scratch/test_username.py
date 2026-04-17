import sys
import os

# Add root and backend to path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'backend'))

from validators import RegisterRequest, validate_request
import json

def test_username(username):
    print(f"Testing username: '{username}'")
    data = {"username": username, "email": "test@example.com", "password": "password123"}
    is_valid, result = validate_request(RegisterRequest, data)
    if is_valid:
        print(f"[VALID] {result.username}")
    else:
        print(f"[INVALID]")
        for error in result.get('validation_errors', []):
            print(f"   - {error['field']}: {error['message']}")

if __name__ == "__main__":
    print("Testing username: 'john-doe'")
    test_username("john-doe")
    
    print("Testing username: 'john_doe'")
    test_username("john_doe")
    
    print("Testing username: ' john_doe '")
    test_username(" john_doe ")
    
    print("Testing username: 'johndoe123'")
    test_username("johndoe123")
    
    print("Testing username: 'john!doe'")
    test_username("john!doe")
