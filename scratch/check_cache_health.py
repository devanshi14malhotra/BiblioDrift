
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask
from backend.cache_service import cache_service

def test_cache_health():
    app = Flask(__name__)
    
    # Simulate app context for initialization
    with app.app_context():
        print("Initializing Cache Service...")
        cache_service.init_app(app)
        
        print("\n--- Cache Health Check ---")
        health = cache_service.check_health()
        for key, value in health.items():
            print(f"{key}: {value}")
            
        print("\n--- Cache Statistics ---")
        stats = cache_service.get_stats()
        for key, value in stats.items():
            if key != 'redis_memory':
                print(f"{key}: {value}")
        
        if 'redis_memory' in stats:
            print("\n--- Redis Memory Usage ---")
            for m_key, m_val in stats['redis_memory'].items():
                print(f"  {m_key}: {m_val}")

if __name__ == "__main__":
    test_cache_health()
