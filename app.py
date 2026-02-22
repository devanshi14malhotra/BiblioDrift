# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
from ai_service import generate_book_note, get_ai_recommendations, get_book_mood_tags_safe, generate_chat_response, llm_service
from models import db, User, Book, ShelfItem, BookNote, register_user, login_user
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
    format_validation_errors
)
from collections import defaultdict, deque
from math import ceil
from time import time

# Load environment variables from .env file
load_dotenv()

# Try to import enhanced mood analysis
try:
    from mood_analysis.ai_service_enhanced import AIBookService
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False
    import logging
    logging.getLogger(__name__).warning("Mood analysis package not available - some endpoints will be disabled")

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'default-dev-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
jwt = JWTManager(app)
CORS(app)

@app.errorhandler(404)
def page_not_found(e):
    # Check if request accepts JSON (API)
    if request.path.startswith('/api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    # Serve custom HTML for browser requests
    return app.send_static_file('404.html'), 404

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

@app.route('/api/v1/config', methods=['GET'])
def get_config():
    """Serve public configuration values like Google Books API Key."""
    return jsonify({
        "google_books_key": os.getenv('GOOGLE_BOOKS_API_KEY', '')
    })

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
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(AnalyzeMoodRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        title = validated_data.title
        author = validated_data.author
        
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
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(MoodTagsRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        title = validated_data.title
        author = validated_data.author
        
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
        
        # Check cache
        cached_note = BookNote.query.filter_by(book_title=title, book_author=author).first()
        if cached_note:
            print(f"Cache hit for {title} by {author}")
            return jsonify({"vibe": cached_note.content})
        
        vibe = generate_book_note(description, title, author)
        
        # Save to cache
        try:
            if vibe and title and author: # Ensure we have valid data to cache
                new_note = BookNote(book_title=title, book_author=author, content=vibe)
                db.session.add(new_note)
                db.session.commit()
        except Exception as e:
            print(f"Failed to cache note: {e}")
            db.session.rollback()

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
            "gemini_configured": llm_service.gemini_client is not None,
            "preferred_llm": llm_service.preferred_llm
        }
    })



@app.route('/api/v1/library', methods=['POST'])
@jwt_required()
def add_to_library():
    """Add a book to the user's shelf."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    required_fields = ['user_id', 'google_books_id', 'title', 'shelf_type']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Ensure user matches token
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized access to another user's library"}), 403
    
    try:
        # Check if the book exists in the Book table
        book = Book.query.filter_by(google_books_id=data['google_books_id']).first()
        if not book:
            book = Book(
                google_books_id=data['google_books_id'],
                title=data['title'],
                authors=data.get('authors', ''),
                thumbnail=data.get('thumbnail', '')
            )
            db.session.add(book)
            db.session.commit() # Commit to get book.id

        # Check if ShelfItem exists
        existing_item = ShelfItem.query.filter_by(user_id=data['user_id'], book_id=book.id).first()
        if existing_item:
            # Update shelf if exists
            existing_item.shelf_type = data['shelf_type']
            item = existing_item
        else:
            item = ShelfItem(
                user_id=data['user_id'],
                book_id=book.id,
                shelf_type=data['shelf_type']
            )
            db.session.add(item)
        
        db.session.commit()
        return jsonify({"message": "Book added to shelf", "item": item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/library/<int:user_id>', methods=['GET'])
@jwt_required()
def get_library(user_id):
    """Get all books in a user's library."""
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
        
    try:
        items = ShelfItem.query.filter_by(user_id=user_id).all()
        # Ensure join loads correctly or use manual load if lazy loading fails
        return jsonify({"library": [item.to_dict() for item in items]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/library/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_library_item(item_id):
    """Update a library item (e.g. move to different shelf)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return jsonify({"error": "Item not found"}), 404
            
        if str(item.user_id) != str(current_user_id):
             return jsonify({"error": "Unauthorized"}), 403

        if 'shelf_type' in data:
            item.shelf_type = data['shelf_type']
            
        db.session.commit()
        return jsonify({"message": "Item updated", "item": item.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/library/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_library(item_id):
    """Remove a book from the library."""
    current_user_id = get_jwt_identity()
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return jsonify({"error": "Item not found"}), 404
        
        if str(item.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
            
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Item removed"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///biblio.db')
if app.config['SQLALCHEMY_DATABASE_URI'] and app.config['SQLALCHEMY_DATABASE_URI'].startswith("postgres://"):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


@app.route('/api/v1/library/sync', methods=['POST'])
@jwt_required()
def sync_library():
    """Sync a list of books from local storage to the user's account."""
    current_user_id = get_jwt_identity()
    data = request.json
    user_id = data.get('user_id')
    
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
        
    items = data.get('items', [])
    
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400
        
    synced_count = 0
    errors = 0
    
    for item_data in items:
        try:
            # 1. Ensure Book Exists
            google_id = item_data.get('id')
            book = Book.query.filter_by(google_books_id=google_id).first()
            
            if not book:
                volume_info = item_data.get('volumeInfo', {})
                image_links = volume_info.get('imageLinks', {})
                authors = volume_info.get('authors', [])
                if isinstance(authors, list):
                    authors = ", ".join(authors)

                book = Book(
                    google_books_id=google_id,
                    title=volume_info.get('title', 'Untitled'),
                    authors=authors,
                    thumbnail=image_links.get('thumbnail', '')
                )
                db.session.add(book)
                db.session.commit() # Need ID for next step

            # 2. Check ShelfItem
            existing_item = ShelfItem.query.filter_by(user_id=user_id, book_id=book.id).first()
            if not existing_item:
                new_item = ShelfItem(
                    user_id=user_id,
                    book_id=book.id,
                    shelf_type=item_data.get('shelf', 'want')
                )
                db.session.add(new_item)
                synced_count += 1
                
        except Exception:
            errors += 1
            db.session.rollback() # Rollback on individual item error but continue
    
    try:
        db.session.commit()
        return jsonify({"message": f"Synced {synced_count} items", "errors": errors}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/register', methods=['POST'])
def register():
    # Register a new user and return JWT token
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    # check if user exists
    if User.query.filter((User.username==username) | (User.email==email)).first():
        return jsonify({"error": "User already exists"}), 409

    try:
        register_user(username, email, password)
        # Fetch the user to get ID
        user = User.query.filter_by(username=username).first()
        
        # Create JWT token
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "message": "User registered successfully",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/login', methods=['POST'])
def login():
    # Authenticate user and return JWT token
    data = request.json
    username_or_email = data.get('username')
    password = data.get('password')
    
    if not username_or_email or not password:
        return jsonify({"error": "Missing fields"}), 400

    # Try to find user by username or email
    user = User.query.filter((User.username==username_or_email) | (User.email==username_or_email)).first()
    
    if user and user.check_password(password):
        # Create JWT token
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        }), 200
        
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