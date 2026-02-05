# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from ai_service import generate_book_note, get_ai_recommendations, get_book_mood_tags_safe, generate_chat_response, llm_service
from ai_service import generate_book_note, get_ai_recommendations, get_book_mood_tags_safe
from models import db, User, register_user, login_user
from collections import defaultdict, deque
from math import ceil
from time import time
from datetime import datetime

# Try to import enhanced mood analysis
try:
    from mood_analysis.ai_service_enhanced import AIBookService
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False
    import logging
    logging.getLogger(__name__).warning("Mood analysis package not available - some endpoints will be disabled")

app = Flask(__name__)
CORS(app)

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 30
_request_log = defaultdict(deque)
_request_calls = 0


def _cleanup_expired_keys(cutoff: float) -> None:
    """Remove keys whose newest timestamp is already outside the window."""
    stale_keys = [key for key, dq in _request_log.items() if not dq or dq[-1] <= cutoff]
    for key in stale_keys:
        _request_log.pop(key, None)


def _rate_limited(endpoint: str) -> tuple[bool, int]:
    """Sliding window limiter per IP/endpoint, returns limit flag and wait time."""
    global _request_calls
    key = f"{request.remote_addr}|{endpoint}"
    now = time()
    window_start = now - RATE_LIMIT_WINDOW
    _request_calls += 1

    dq = _request_log[key]
    while dq and dq[0] <= window_start:
        dq.popleft()

    if len(dq) >= RATE_LIMIT_MAX_REQUESTS:
        oldest = dq[0]
        retry_after = max(1, ceil(RATE_LIMIT_WINDOW - (now - oldest)))
        return True, retry_after

    dq.append(now)

    if _request_calls % 100 == 0:
        _cleanup_expired_keys(window_start)

    return False, 0

# Initialize AI service if available
if MOOD_ANALYSIS_AVAILABLE:
    ai_service = AIBookService()

@app.route('/')
def index():
    """Simple index page showing available API endpoints."""
    endpoints_info = {
        "service": "BiblioDrift Mood Analysis API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET /": "This page - API documentation",
            "GET /api/v1/health": "Health check endpoint",
            "POST /api/v1/generate-note": "Generate AI book notes",
            "POST /api/v1/chat": "Chat with bookseller",
            "POST /api/v1/mood-search": "Search books by mood/vibe"
        },
        "note": "All endpoints except / and /api/v1/health require POST requests with JSON body",
        "example_usage": {
            "chat": {
                "url": "/api/v1/chat",
                "method": "POST",
                "body": {"message": "I want something cozy for a rainy evening"}
            },
            "mood_search": {
                "url": "/api/v1/mood-search", 
                "method": "POST",
                "body": {"query": "mystery thriller"}
            }
        }
    }
    
    if MOOD_ANALYSIS_AVAILABLE:
        endpoints_info["endpoints"]["POST /api/v1/analyze-mood"] = "Analyze book mood from GoodReads"
        endpoints_info["endpoints"]["POST /api/v1/mood-tags"] = "Get mood tags for a book"
        endpoints_info["example_usage"]["mood_analysis"] = {
            "url": "/api/v1/analyze-mood",
            "method": "POST", 
            "body": {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald"}
        }
    else:
        endpoints_info["note"] += " | Mood analysis endpoints disabled (missing dependencies)"
    
    return jsonify(endpoints_info)

@app.route('/api/v1/analyze-mood', methods=['POST'])
def handle_analyze_mood():
    """Analyze book mood using GoodReads reviews."""
    limited, retry_after = _rate_limited('analyze_mood')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    if not MOOD_ANALYSIS_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "Mood analysis not available - missing dependencies"
        }), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        title = data.get('title', '')
        author = data.get('author', '')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        mood_analysis = ai_service.analyze_book_mood(title, author)
        
        if mood_analysis:
            return jsonify({
                "success": True,
                "mood_analysis": mood_analysis
            })
        else:
            return jsonify({
                "success": False,
                "error": "Could not analyze mood for this book"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/mood-tags', methods=['POST'])
def handle_mood_tags():
    """Get mood tags for a book."""
    limited, retry_after = _rate_limited('mood_tags')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        title = data.get('title', '')
        author = data.get('author', '')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        mood_tags = get_book_mood_tags_safe(title, author)
        return jsonify({
            "success": True,
            "mood_tags": mood_tags
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/mood-search', methods=['POST'])
def handle_mood_search():
    """Search for books based on mood/vibe."""
    limited, retry_after = _rate_limited('mood_search')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        mood_query = data.get('query', '')
        
        if not mood_query:
            return jsonify({"error": "Query is required"}), 400
        
        recommendations = get_ai_recommendations(mood_query)
        return jsonify({
            "success": True,
            "recommendations": recommendations,
            "query": mood_query
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/generate-note', methods=['POST'])
def handle_generate_note():
    """Generate AI-powered book note with optional mood analysis."""
    limited, retry_after = _rate_limited('generate_note')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        description = data.get('description', '')
        title = data.get('title', '')
        author = data.get('author', '')
        
        vibe = generate_book_note(description, title, author)
        return jsonify({"vibe": vibe})
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/chat', methods=['POST'])
def handle_chat():
    """Handle chat messages and generate bookseller responses."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        user_message = data.get('message', '')
        conversation_history = data.get('history', [])
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        # Validate and limit conversation history
        if not isinstance(conversation_history, list):
            conversation_history = []
        
        # Limit history size for security and performance
        conversation_history = conversation_history[-10:]  # Only keep last 10 messages
        
        # Validate each message in history
        validated_history = []
        for msg in conversation_history:
            if isinstance(msg, dict) and 'type' in msg and 'content' in msg:
                if len(str(msg.get('content', ''))) <= 1000:  # Limit message size
                    validated_history.append(msg)
        
        # Generate contextual response based on conversation history
        response = generate_chat_response(user_message, validated_history)
        
        # Try to get book recommendations based on the message
        recommendations = get_ai_recommendations(user_message)
        
        return jsonify({
            "success": True,
            "response": response,
            "recommendations": recommendations,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "BiblioDrift AI Service",
        "version": "2.0.0",
        "features": {
            "mood_analysis_available": MOOD_ANALYSIS_AVAILABLE,
            "llm_service_available": llm_service.is_available(),
            "openai_configured": llm_service.openai_client is not None,
            "groq_configured": llm_service.groq_client is not None,
            "gemini_configured": llm_service.gemini_model is not None,
            "preferred_llm": llm_service.preferred_llm
        }
    })

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///biblio.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


@app.route('/api/v1/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    try:
        register_user(username, email, password)
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    if login_user(username, password):
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"error": "Invalid username or password"}), 401

with app.app_context():
    db.create_all()  # creates User & ShelfItem tables

if __name__ == '__main__':
    import os
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('FLASK_HOST', '127.0.0.1')  # Default to localhost for security
    
    if debug_mode:
        print("--- BIBLIODRIFT MOOD ANALYSIS SERVER STARTING ON PORT", port, "---")
        print("Available endpoints:")
        print("  POST /api/v1/generate-note - Generate AI book notes")
        if MOOD_ANALYSIS_AVAILABLE:
            print("  POST /api/v1/analyze-mood - Analyze book mood from GoodReads")
            print("  POST /api/v1/mood-tags - Get mood tags for a book")
        else:
            print("  [DISABLED] Mood analysis endpoints (missing dependencies)")
        print("  POST /api/v1/mood-search - Search books by mood/vibe")
        print("  POST /api/v1/chat - Chat with bookseller")
        print("  GET  /api/v1/health - Health check")
    
    app.run(debug=debug_mode, port=port, host=host)