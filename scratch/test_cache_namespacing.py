import sys
import os
import json
import hashlib

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from cache_service import CacheConfig, CacheNamespace, CacheKey, cache_service, cached_result

def test_cache_key_generation():
    print("Testing Cache Key Generation...")
    
    # Test cases
    cases = [
        {
            "namespace": CacheNamespace.USER,
            "id": 123,
            "attr": "profile",
            "args": (),
            "kwargs": {},
            "expected_prefix": "bibliodrift:v1:user:123:profile"
        },
        {
            "namespace": CacheNamespace.BOOK,
            "id": "book_abc_789",
            "attr": "metadata",
            "args": ("detail",),
            "kwargs": {"version": 2},
            "expected_prefix": "bibliodrift:v1:book:book_abc_789:metadata"
        }
    ]
    
    for i, case in enumerate(cases):
        key_builder = CacheKey(case["namespace"], case["id"], case["attr"])
        key = key_builder.build(*case["args"], **case["kwargs"])
        
        print(f"\nCase {i+1}:")
        print(f"Generated Key: {key}")
        
        # Verify prefix
        if key.startswith(case["expected_prefix"]):
            print(f"✓ Prefix matches: {case['expected_prefix']}")
        else:
            print(f"✗ Prefix mismatch! Expected {case['expected_prefix']}")
            
        # Verify hash presence if args/kwargs exist
        if case["args"] or case["kwargs"]:
            if len(key.split(':')) > len(case["expected_prefix"].split(':')):
                print("✓ Hash included in key")
            else:
                print("✗ Hash missing from key")

def test_decorator_compatibility():
    print("\nTesting Decorator Compatibility...")
    
    # Mock function to be decorated
    @cached_result(CacheNamespace.SYSTEM, attribute="ping")
    def mock_ping(name):
        print(f"Executing mock_ping for {name}")
        return f"Hello {name}"
    
    # We can't easily run this without a full Flask app context if it hits Redis,
    # but we can check if it initializes correctly.
    print("✓ cached_result decorator defined and applied successfully")

if __name__ == "__main__":
    from cache_service import cached_result
    test_cache_key_generation()
    test_decorator_compatibility()
