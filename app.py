# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
from ai_service import generate_book_note, get_ai_recommendations, get_book_mood_tags_safe, generate_chat_response, llm_service
from models import db, User, Book, ShelfItem, BookNote, ReadingGoal, ReadingStats, Collection, CollectionItem, PriceHistory, PriceAlert, Review, register_user, login_user
from price_tracker import get_price_tracker
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
    SetGoalRequest,
    GetStatsRequest,
    CollectionRequest,
    UpdateCollectionRequest,
    AddToCollectionRequest,
    ReviewRequest,
    SetPriceAlertRequest,
    GetPriceHistoryRequest,
    GetAlertsRequest,
    format_validation_errors,
    validate_jwt_secret,
    is_production_mode
)
from collections import defaultdict, deque
from math import ceil
from time import time
from error_responses import (
    ErrorCodes, error_response, success_response,
    validation_error, missing_fields_error, invalid_json_error,
    auth_error, forbidden_error, unauthorized_access_error,
    not_found_error, resource_exists_error, rate_limit_error,
    internal_error, service_unavailable_error
)

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
        return error_response(ErrorCodes.ENDPOINT_NOT_FOUND, "Endpoint not found", 404)
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


def rate_limit(endpoint_name: str, max_requests: int = None):
    """Decorator to apply rate limiting to an endpoint.
    
    Args:
        endpoint_name: The name of the endpoint for rate limiting
        max_requests: Optional custom max requests limit (uses RATE_LIMIT_MAX_REQUESTS if not provided)
    """
    def decorator(f):
        def wrapped(*args, **kwargs):
            # Use custom max_requests if provided, otherwise use global default
            global RATE_LIMIT_MAX_REQUESTS
            original_max = RATE_LIMIT_MAX_REQUESTS
            try:
                if max_requests is not None:
                    RATE_LIMIT_MAX_REQUESTS = max_requests
                
                limited, retry_after = _rate_limited(endpoint_name)
            finally:
                if max_requests is not None:
                    RATE_LIMIT_MAX_REQUESTS = original_max
                    
            if limited:
                response = jsonify({
                    "success": False,
                    "error": "Rate limit exceeded. Try again shortly.",
                    "retry_after": retry_after
                })
                response.status_code = 429
                response.headers['Retry-After'] = retry_after
                return response
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__
        return wrapped
    return decorator

# Initialize AI service if available
if MOOD_ANALYSIS_AVAILABLE:
    ai_service = AIBookService()


# ==================== JWT SECRET VALIDATION AT STARTUP ====================
def _validate_jwt_secret_startup():
    """
    Validate JWT_SECRET_KEY at application startup.
    This function runs before the server starts to prevent insecure configurations.
    """
    is_prod = is_production_mode()
    is_valid, message = validate_jwt_secret()
    
    if not is_valid:
        if is_prod:
            # In production, refuse to start with insecure configuration
            print("\n" + "="*70)
            print("CRITICAL SECURITY ERROR - APPLICATION REFUSING TO START")
            print("="*70)
            print(f"\n{message}")
            print("\nFor production deployment, you MUST:")
            print("  1. Set JWT_SECRET_KEY environment variable to a secure value")
            print("  2. Use a minimum of 32 characters for the secret key")
            print("  3. Use a cryptographically strong random string")
            print("\nExample:")
            print("  export JWT_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')")
            print("="*70 + "\n")
            import sys
            sys.exit(1)
        else:
            # In development, show warning but allow startup
            print("\n" + "="*70)
            print("WARNING: INSECURE JWT SECRET KEY CONFIGURATION")
            print("="*70)
            print(f"\n{message}")
            print("\nThis is acceptable for DEVELOPMENT only.")
            print("For production, you MUST set a secure JWT_SECRET_KEY.")
            print("="*70 + "\n")
    else:
        # Secret is valid, show confirmation in development mode
        if not is_prod:
            print("\n" + "="*70)
            print("JWT SECRET KEY CONFIGURATION: OK")
            print("="*70)
            print("Using a secure JWT secret key.")
            print("="*70 + "\n")


# Run JWT secret validation at module load time (before any requests)
_validate_jwt_secret_startup()

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
@rate_limit('analyze_mood')
def handle_analyze_mood():
    """Analyze book mood using GoodReads reviews."""
    if not MOOD_ANALYSIS_AVAILABLE:
        return service_unavailable_error("Mood analysis not available - missing dependencies")
    
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
            return success_response(
                data={"mood_analysis": mood_analysis}
            )
        else:
            return not_found_error("Mood analysis for this book")
            
    except Exception as e:
        return internal_error(str(e))

@app.route('/api/v1/mood-tags', methods=['POST'])
@rate_limit('mood_tags')
def handle_mood_tags():
    """Get mood tags for a book."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(MoodTagsRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        title = validated_data.title
        author = validated_data.author
        
        mood_tags = get_book_mood_tags_safe(title, author)
        return success_response(
            data={"mood_tags": mood_tags}
        )
        
    except Exception as e:
        return internal_error(str(e))

@app.route('/api/v1/mood-search', methods=['POST'])
@rate_limit('mood_search')
def handle_mood_search():
    """Search for books based on mood/vibe."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(MoodSearchRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        mood_query = validated_data.query
        
        recommendations = get_ai_recommendations(mood_query)
        return success_response(
            data={
                "recommendations": recommendations,
                "query": mood_query
            }
        )
        
    except Exception as e:
        return internal_error(str(e))

@app.route('/api/v1/generate-note', methods=['POST'])
@rate_limit('generate_note')
def handle_generate_note():
    """Generate AI-powered book note with optional mood analysis."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(GenerateNoteRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        description = validated_data.description
        title = validated_data.title
        author = validated_data.author
        
        # Check cache
        cached_note = BookNote.query.filter_by(book_title=title, book_author=author).first()
        if cached_note:
            print(f"Cache hit for {title} by {author}")
            return success_response(data={"vibe": cached_note.content})
        
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

        return success_response(data={"vibe": vibe})
        
    except Exception as e:
        return internal_error(str(e))

@app.route('/api/v1/chat', methods=['POST'])
@rate_limit('chat')
def handle_chat():
    """Handle chat messages and generate bookseller responses."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(ChatRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        user_message = validated_data.message
        conversation_history = validated_data.history or []
        
        # Convert Pydantic models to dicts for the AI service
        validated_history = []
        for msg in conversation_history:
            if hasattr(msg, 'dict'):
                validated_history.append(msg.dict())
            else:
                validated_history.append(msg)
        
        # Generate contextual response based on conversation history
        response = generate_chat_response(user_message, validated_history)
        
        # Try to get book recommendations based on the message
        recommendations = get_ai_recommendations(user_message)
        
        return success_response(
            data={
                "response": response,
                "recommendations": recommendations,
                "timestamp": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        return internal_error(str(e))

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
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(AddToLibraryRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        # Ensure user matches token
        if str(validated_data.user_id) != str(current_user_id):
            return unauthorized_access_error("Cannot access another user's library")
        
        # Check if the book exists in the Book table
        book = Book.query.filter_by(google_books_id=validated_data.google_books_id).first()
        if not book:
            book = Book(
                google_books_id=validated_data.google_books_id,
                title=validated_data.title,
                authors=validated_data.authors,
                thumbnail=validated_data.thumbnail
            )
            db.session.add(book)
            db.session.flush() # Flush to get book.id without committing

        # Check if ShelfItem exists
        existing_item = ShelfItem.query.filter_by(user_id=validated_data.user_id, book_id=book.id).first()
        if existing_item:
            # Update shelf if exists
            existing_item.shelf_type = validated_data.shelf_type.value
            item = existing_item
        else:
            item = ShelfItem(
                user_id=validated_data.user_id,
                book_id=book.id,
                shelf_type=validated_data.shelf_type.value
            )
            db.session.add(item)
        
        db.session.commit()
        return success_response(
            data={"message": "Book added to shelf", "item": item.to_dict()},
            status_code=201
        )
    except Exception as e:
        db.session.rollback()
        return internal_error(str(e))

@app.route('/api/v1/library/<int:user_id>', methods=['GET'])
@jwt_required()
def get_library(user_id):
    """Get all books in a user's library."""
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return forbidden_error("Cannot access another user's library")
        
    try:
        items = ShelfItem.query.options(joinedload(ShelfItem.book)).filter_by(user_id=user_id).all()
        # Ensure join loads correctly or use manual load if lazy loading fails
        return success_response(data={"library": [item.to_dict() for item in items]})
    except Exception as e:
        return internal_error(str(e))

# ==================== READING STATS HELPER FUNCTIONS ====================
def _update_reading_stats(user_id, book):
    """Update reading stats when a book is finished."""
    now = datetime.utcnow()
    year = now.year
    month = now.month
    
    # Get or create stats record for this month
    stats = ReadingStats.query.filter_by(
        user_id=user_id, year=year, month=month
    ).first()
    
    if not stats:
        stats = ReadingStats(
            user_id=user_id,
            year=year,
            month=month,
            books_completed=0,
            pages_read=0
        )
        db.session.add(stats)
    
    # Increment books completed
    stats.books_completed += 1
    
    # Add pages read if available
    if book and book.page_count:
        stats.pages_read += book.page_count
    
    db.session.commit()


def _calculate_reading_streak(user_id):
    """Calculate the user's current reading streak in days."""
    # Get all finished books sorted by finished_at descending
    finished_items = ShelfItem.query.filter_by(
        user_id=user_id, shelf_type='finished'
    ).filter(ShelfItem.finished_at.isnot(None)).order_by(
        ShelfItem.finished_at.desc()
    ).all()
    
    if not finished_items:
        return 0
    
    # Check if the most recent finish was today or yesterday
    now = datetime.utcnow()
    today = now.date()
    most_recent = finished_items[0].finished_at.date()
    
    # If the most recent finish is more than 1 day ago, streak is broken
    if (today - most_recent).days > 1:
        return 0
    
    # Count consecutive days
    streak = 1
    prev_date = most_recent
    
    for item in finished_items[1:]:
        finish_date = item.finished_at.date()
        days_diff = (prev_date - finish_date).days
        
        if days_diff == 1:
            streak += 1
            prev_date = finish_date
        elif days_diff > 1:
            break
        # If days_diff == 0, same day, don't increment but continue
    
    return streak


def _get_yearly_stats(user_id, year):
    """Get yearly reading statistics."""
    stats = ReadingStats.query.filter_by(
        user_id=user_id, year=year
    ).all()
    
    total_books = sum(s.books_completed for s in stats)
    total_pages = sum(s.pages_read for s in stats)
    
    # Get monthly breakdown
    monthly = {s.month: s.books_completed for s in stats}
    
    return {
        "total_books": total_books,
        "total_pages": total_pages,
        "monthly": monthly
    }


# ==================== LIBRARY ENDPOINTS ====================
@app.route('/api/v1/library/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_library_item(item_id):
    """Update a library item (e.g. move to different shelf)."""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(UpdateLibraryItemRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        item = ShelfItem.query.get(item_id)
        if not item:
            return not_found_error("Library item")
            
        if str(item.user_id) != str(current_user_id):
             return forbidden_error("Cannot modify another user's library item")

        # Update fields if provided
        if validated_data.shelf_type is not None:
            item.shelf_type = validated_data.shelf_type.value
            
        db.session.commit()
        return success_response(data={"message": "Item updated", "item": item.to_dict()})
    except Exception as e:
        db.session.rollback()
        return internal_error(str(e))

@app.route('/api/v1/library/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_library(item_id):
    """Remove a book from the library."""
    current_user_id = get_jwt_identity()
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return not_found_error("Library item")
        
        if str(item.user_id) != str(current_user_id):
            return forbidden_error("Cannot delete another user's library item")
            
        db.session.delete(item)
        db.session.commit()
        return success_response(data={"message": "Item removed"})
    except Exception as e:
        db.session.rollback()
        return internal_error(str(e))


app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///biblio.db')
if app.config['SQLALCHEMY_DATABASE_URI'] and app.config['SQLALCHEMY_DATABASE_URI'].startswith("postgres://"):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Initialize price tracker with database
price_tracker = get_price_tracker(db)


@app.route('/api/v1/library/sync', methods=['POST'])
@jwt_required()
def sync_library():
    """Sync a list of books from local storage to the user's account."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(SyncLibraryRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        user_id = validated_data.user_id
        items = validated_data.items
        
        if str(user_id) != str(current_user_id):
            return forbidden_error("Cannot sync to another user's library")
        
        synced_count = 0
        errors = 0
        
        for item_data in items:
            try:
                # Validate required fields for each item
                if not isinstance(item_data, dict):
                    errors += 1
                    continue
                    
                google_id = item_data.get('id')
                if not google_id:
                    errors += 1
                    continue
                
                # 1. Ensure Book Exists
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
                    shelf_type = item_data.get('shelf', 'want')
                    # Validate shelf type
                    if shelf_type not in ['want', 'current', 'finished']:
                        shelf_type = 'want'
                        
                    new_item = ShelfItem(
                        user_id=user_id,
                        book_id=book.id,
                        shelf_type=shelf_type
                    )
                    db.session.add(new_item)
                    synced_count += 1
                    
            except Exception:
                errors += 1
                db.session.rollback() # Rollback on individual item error but continue
        
        db.session.commit()
        return success_response(data={"message": f"Synced {synced_count} items", "errors": errors})
    except Exception as e:
        db.session.rollback()
        return internal_error(str(e))

@app.route('/api/v1/register', methods=['POST'])
@rate_limit('auth', max_requests=5)
def register():
    """Register a new user and return JWT token."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(RegisterRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        username = validated_data.username
        email = validated_data.email
        password = validated_data.password

        # check if user exists
        if User.query.filter((User.username==username) | (User.email==email)).first():
            return resource_exists_error("User")

        register_user(username, email, password)
        # Fetch the user to get ID
        user = User.query.filter_by(username=username).first()
        
        # Create JWT token
        access_token = create_access_token(identity=str(user.id))
        
        return success_response(
            data={
                "message": "User registered successfully",
                "access_token": access_token,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            },
            status_code=201
        )
    except Exception as e:
        return validation_error(str(e))

@app.route('/api/v1/login', methods=['POST'])
@rate_limit('auth', max_requests=5)
def login():
    """Authenticate user and return JWT token."""
    try:
        data = request.get_json()
        
        # Validate request using Pydantic
        is_valid, validated_data = validate_request(LoginRequest, data)
        if not is_valid:
            return jsonify(validated_data), 400
        
        username_or_email = validated_data.username
        password = validated_data.password

        # Try to find user by username or email
        user = User.query.filter((User.username==username_or_email) | (User.email==username_or_email)).first()
        
        if user and user.check_password(password):
            # Create JWT token
            access_token = create_access_token(identity=str(user.id))
            
            return success_response(
                data={
                    "message": "Login successful",
                    "access_token": access_token,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email
                    }
                }
            )
            
        return auth_error("Invalid username or password")
    except Exception as e:
        return internal_error(str(e))


# ==================== READING STATS ENDPOINTS ====================
@app.route('/api/v1/stats/goal', methods=['POST'])
@jwt_required()
def set_reading_goal():
    """Set or update annual reading goal."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request
    is_valid, validated_data = validate_request(SetGoalRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    # Ensure user matches token
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        # Check if goal already exists for this year
        existing_goal = ReadingGoal.query.filter_by(
            user_id=data['user_id'], year=data['year']
        ).first()
        
        if existing_goal:
            existing_goal.target_books = data['target_books']
            goal = existing_goal
        else:
            goal = ReadingGoal(
                user_id=data['user_id'],
                year=data['year'],
                target_books=data['target_books']
            )
            db.session.add(goal)
        
        db.session.commit()
        return jsonify({
            "message": "Reading goal set successfully",
            "goal": goal.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/stats', methods=['GET'])
@jwt_required()
def get_reading_stats():
    """Get reading statistics for the user."""
    user_id = request.args.get('user_id', type=int)
    year = request.args.get('year', datetime.now().year, type=int)
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        # Get yearly stats
        yearly_stats = _get_yearly_stats(user_id, year)
        
        # Get current streak
        current_streak = _calculate_reading_streak(user_id)
        
        # Get reading goal for the year
        goal = ReadingGoal.query.filter_by(user_id=user_id, year=year).first()
        
        # Get this month's stats
        now = datetime.utcnow()
        current_month_stats = ReadingStats.query.filter_by(
            user_id=user_id, year=year, month=now.month
        ).first()
        
        return jsonify({
            "user_id": user_id,
            "year": year,
            "books_this_year": yearly_stats["total_books"],
            "pages_this_year": yearly_stats["total_pages"],
            "books_this_month": current_month_stats.books_completed if current_month_stats else 0,
            "pages_this_month": current_month_stats.pages_read if current_month_stats else 0,
            "current_streak": current_streak,
            "goal": goal.to_dict() if goal else None,
            "monthly_breakdown": yearly_stats["monthly"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/stats/leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    """Get community reading leaderboard."""
    year = request.args.get('year', datetime.now().year, type=int)
    limit = request.args.get('limit', 10, type=int)
    
    try:
        # Get all goals for the year
        goals = ReadingGoal.query.filter_by(year=year).all()
        
        leaderboard = []
        for goal in goals:
            user = User.query.get(goal.user_id)
            yearly_stats = _get_yearly_stats(goal.user_id, year)
            
            leaderboard.append({
                "user_id": goal.user_id,
                "username": user.username if user else "Unknown",
                "target_books": goal.target_books,
                "books_completed": yearly_stats["total_books"],
                "pages_read": yearly_stats["total_pages"],
                "progress_percentage": round((yearly_stats["total_books"] / goal.target_books * 100), 1) if goal.target_books > 0 else 0
            })
        
        # Sort by books completed descending
        leaderboard.sort(key=lambda x: x["books_completed"], reverse=True)
        
        # Limit results
        leaderboard = leaderboard[:limit]
        
        return jsonify({
            "year": year,
            "leaderboard": leaderboard
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== COLLECTIONS ENDPOINTS ====================
@app.route('/api/v1/collections', methods=['POST'])
@jwt_required()
def create_collection():
    """Create a new collection."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request
    is_valid, validated_data = validate_request(CollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    # Ensure user matches token
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        # Check if collection with same name already exists
        existing = Collection.query.filter_by(
            user_id=data['user_id'], name=data['name']
        ).first()
        
        if existing:
            return jsonify({"error": "Collection with this name already exists"}), 409
        
        collection = Collection(
            user_id=data['user_id'],
            name=data['name'],
            description=data.get('description', ''),
            is_public=data.get('is_public', False)
        )
        db.session.add(collection)
        db.session.commit()
        
        return jsonify({
            "message": "Collection created successfully",
            "collection": collection.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections', methods=['GET'])
@jwt_required()
def get_collections():
    """Get user's collections."""
    user_id = request.args.get('user_id', type=int)
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    current_user_id = get_jwt_identity()
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        collections = Collection.query.filter_by(user_id=user_id).order_by(Collection.created_at.desc()).all()
        return jsonify({
            "collections": [c.to_dict() for c in collections]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['GET'])
@jwt_required()
def get_collection(collection_id):
    """Get a single collection with its items."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        # Check access - owner can view private, anyone can view public
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        return jsonify({
            "collection": collection.to_dict(include_items=True)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['PUT'])
@jwt_required()
def update_collection(collection_id):
    """Update a collection."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request
    is_valid, validated_data = validate_request(UpdateCollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        # Update fields if provided
        if 'name' in data and data['name']:
            # Check if new name already exists for this user
            existing = Collection.query.filter(
                Collection.user_id == collection.user_id,
                Collection.name == data['name'],
                Collection.id != collection_id
            ).first()
            if existing:
                return jsonify({"error": "Collection with this name already exists"}), 409
            collection.name = data['name']
        
        if 'description' in data:
            collection.description = data['description']
        
        if 'is_public' in data:
            collection.is_public = data['is_public']
        
        db.session.commit()
        
        return jsonify({
            "message": "Collection updated successfully",
            "collection": collection.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>', methods=['DELETE'])
@jwt_required()
def delete_collection(collection_id):
    """Delete a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        db.session.delete(collection)
        db.session.commit()
        
        return jsonify({"message": "Collection deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books', methods=['POST'])
@jwt_required()
def add_book_to_collection(collection_id):
    """Add a book to a collection."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request
    is_valid, validated_data = validate_request(AddToCollectionRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        # Check if book exists in Book table
        book = Book.query.filter_by(google_books_id=data['google_books_id']).first()
        if not book:
            book = Book(
                google_books_id=data['google_books_id'],
                title=data['title'],
                authors=data.get('authors', ''),
                thumbnail=data.get('thumbnail', '')
            )
            db.session.add(book)
            db.session.flush()
        
        # Check if book already in collection
        existing_item = CollectionItem.query.filter_by(
            collection_id=collection_id, book_id=book.id
        ).first()
        
        if existing_item:
            return jsonify({"error": "Book already in collection"}), 409
        
        # Add book to collection
        item = CollectionItem(
            collection_id=collection_id,
            book_id=book.id
        )
        db.session.add(item)
        db.session.commit()
        
        return jsonify({
            "message": "Book added to collection",
            "item": item.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books', methods=['GET'])
@jwt_required()
def get_collection_books(collection_id):
    """Get all books in a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        # Check access
        if not collection.is_public and str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        items = CollectionItem.query.filter_by(collection_id=collection_id).order_by(CollectionItem.added_at.desc()).all()
        
        return jsonify({
            "collection": collection.to_dict(),
            "books": [item.to_dict() for item in items]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/<int:collection_id>/books/<int:book_id>', methods=['DELETE'])
@jwt_required()
def remove_book_from_collection(collection_id, book_id):
    """Remove a book from a collection."""
    current_user_id = get_jwt_identity()
    
    try:
        collection = Collection.query.get(collection_id)
        if not collection:
            return jsonify({"error": "Collection not found"}), 404
        
        if str(collection.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized"}), 403
        
        item = CollectionItem.query.filter_by(collection_id=collection_id, book_id=book_id).first()
        if not item:
            return jsonify({"error": "Book not found in collection"}), 404
        
        db.session.delete(item)
        db.session.commit()
        
        return jsonify({"message": "Book removed from collection"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/collections/public', methods=['GET'])
def get_public_collections():
    """Browse public collections."""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        collections = Collection.query.filter_by(is_public=True).order_by(
            Collection.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # Get total count
        total = Collection.query.filter_by(is_public=True).count()
        
        result = []
        for c in collections:
            collection_data = c.to_dict()
            # Add owner username
            user = User.query.get(c.user_id)
            collection_data['owner_username'] = user.username if user else "Unknown"
            result.append(collection_data)
        
        return jsonify({
            "collections": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== BOOK REVIEWS & RATINGS ENDPOINTS ====================

@app.route('/api/v1/reviews', methods=['POST'])
@jwt_required()
def create_or_update_review():
    """Create or update a book review (requires JWT)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request using Pydantic
    is_valid, validated_data = validate_request(ReviewRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    # Ensure user matches token
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized access to another user's reviews"}), 403
    
    try:
        # Check if book exists in Book table
        book = Book.query.filter_by(google_books_id=data['google_books_id']).first()
        if not book:
            book = Book(
                google_books_id=data['google_books_id'],
                title=data.get('title', 'Unknown'),
                authors=data.get('authors', ''),
                thumbnail=data.get('thumbnail', '')
            )
            db.session.add(book)
            db.session.flush()
        
        # Check if review already exists for this user/book combination
        existing_review = Review.query.filter_by(
            user_id=data['user_id'], book_id=book.id
        ).first()
        
        if existing_review:
            # Update existing review
            existing_review.rating = data['rating']
            existing_review.review_text = data.get('review_text', '')
            review = existing_review
            message = "Review updated successfully"
        else:
            # Create new review
            review = Review(
                user_id=data['user_id'],
                book_id=book.id,
                rating=data['rating'],
                review_text=data.get('review_text', '')
            )
            db.session.add(review)
            message = "Review created successfully"
        
        db.session.commit()
        return jsonify({
            "message": message,
            "review": review.to_dict()
        }), 201 if not existing_review else 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/reviews/<book_id>', methods=['GET'])
def get_book_reviews(book_id):
    """Get all reviews for a book (public endpoint)."""
    try:
        # Get book by google_books_id (string) or internal id (int)
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        # Get all reviews for this book
        reviews = Review.query.filter_by(book_id=book.id).order_by(
            Review.created_at.desc()
        ).all()
        
        # Calculate average rating
        total_rating = sum(r.rating for r in reviews)
        average_rating = round(total_rating / len(reviews), 1) if reviews else 0
        
        return jsonify({
            "book_id": book.id,
            "google_books_id": book.google_books_id,
            "title": book.title,
            "authors": book.authors,
            "thumbnail": book.thumbnail,
            "average_rating": average_rating,
            "total_reviews": len(reviews),
            "reviews": [review.to_dict() for review in reviews]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/users/<user_id>/reviews', methods=['GET'])
@jwt_required()
def get_user_reviews(user_id):
    """Get user's reviews (requires JWT, user can only view their own reviews)."""
    current_user_id = get_jwt_identity()
    
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized - you can only view your own reviews"}), 403
    
    try:
        reviews = Review.query.filter_by(user_id=user_id).order_by(
            Review.created_at.desc()
        ).all()
        
        return jsonify({
            "user_id": user_id,
            "total_reviews": len(reviews),
            "reviews": [review.to_dict() for review in reviews]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_review(review_id):
    """Delete a review (requires JWT, user can only delete their own reviews)."""
    current_user_id = get_jwt_identity()
    
    try:
        review = Review.query.get(review_id)
        if not review:
            return jsonify({"error": "Review not found"}), 404
        
        # Check if user owns the review
        if str(review.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - you can only delete your own reviews"}), 403
        
        db.session.delete(review)
        db.session.commit()
        
        return jsonify({"message": "Review deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== PRICE ALERT ENDPOINTS ====================

@app.route('/api/v1/books/<book_id>/alert', methods=['POST'])
@jwt_required()
def create_price_alert(book_id):
    """Create a price alert for a book (requires JWT)."""
    data = request.json
    current_user_id = get_jwt_identity()
    
    # Validate request using Pydantic
    is_valid, validated_data = validate_request(SetPriceAlertRequest, data)
    if not is_valid:
        return jsonify(validated_data), 400
    
    # Ensure user matches token
    if str(data['user_id']) != str(current_user_id):
        return jsonify({"error": "Unauthorized access to another user's alerts"}), 403
    
    try:
        # Verify book exists
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        # Verify shelf item belongs to user
        shelf_item = ShelfItem.query.get(data['shelf_item_id'])
        if not shelf_item:
            return jsonify({"error": "Shelf item not found"}), 404
        
        if str(shelf_item.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - shelf item belongs to another user"}), 403
        
        # Verify shelf item belongs to the same book
        if shelf_item.book_id != book.id:
            return jsonify({"error": "Shelf item does not match the specified book"}), 400
        
        # Create price alert using price tracker
        result = price_tracker.create_price_alert(
            user_id=data['user_id'],
            shelf_item_id=data['shelf_item_id'],
            target_price=data['target_price']
        )
        
        if result.get('success'):
            return jsonify({
                "message": "Price alert created successfully",
                "alert": result['alert']
            }), 201
        else:
            return jsonify({
                "error": result.get('error', 'Failed to create price alert')
            }), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/books/<book_id>/prices', methods=['GET'])
@jwt_required()
def get_price_history(book_id):
    """Get price history for a book (requires JWT)."""
    current_user_id = get_jwt_identity()
    
    # Get optional query parameters
    retailer = request.args.get('retailer')
    limit = request.args.get('limit', 30, type=int)
    
    # Validate limit
    if limit < 1 or limit > 100:
        limit = 30
    
    try:
        # Verify book exists
        book = None
        if book_id.isdigit():
            book = Book.query.get(int(book_id))
        else:
            book = Book.query.filter_by(google_books_id=book_id).first()
        
        if not book:
            return jsonify({"error": "Book not found"}), 404
        
        # Get price history using price tracker
        history = price_tracker.get_price_history(
            book_id=book.id,
            retailer=retailer,
            limit=limit
        )
        
        # Also try to get latest prices
        latest_prices = price_tracker.get_latest_prices(book.id)
        
        return jsonify({
            "book_id": book.id,
            "google_books_id": book.google_books_id,
            "title": book.title,
            "authors": book.authors,
            "price_history": history,
            "latest_prices": latest_prices
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts', methods=['GET'])
@jwt_required()
def get_user_alerts():
    """Get user's price alerts (requires JWT)."""
    current_user_id = get_jwt_identity()
    user_id = request.args.get('user_id', type=int)
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    # Ensure user matches token
    if str(user_id) != str(current_user_id):
        return jsonify({"error": "Unauthorized - you can only view your own alerts"}), 403
    
    try:
        # Get alerts using price tracker
        alerts = price_tracker.get_user_alerts(
            user_id=user_id,
            active_only=active_only
        )
        
        return jsonify({
            "user_id": user_id,
            "active_only": active_only,
            "total_alerts": len(alerts),
            "alerts": alerts
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/alerts/<int:alert_id>', methods=['DELETE'])
@jwt_required()
def delete_price_alert(alert_id):
    """Delete a price alert (requires JWT, user can only delete their own alerts)."""
    current_user_id = get_jwt_identity()
    
    try:
        alert = PriceAlert.query.get(alert_id)
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        
        # Check if user owns the alert
        if str(alert.user_id) != str(current_user_id):
            return jsonify({"error": "Unauthorized - you can only delete your own alerts"}), 403
        
        # Delete using price tracker
        result = price_tracker.delete_price_alert(
            alert_id=alert_id,
            user_id=current_user_id
        )
        
        if result.get('success'):
            return jsonify({
                "message": "Price alert deleted successfully"
            }), 200
        else:
            return jsonify({
                "error": result.get('error', 'Failed to delete price alert')
            }), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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