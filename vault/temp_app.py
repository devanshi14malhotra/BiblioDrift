import os
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vault_unified_system")

CURRENT_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

BASE_DIR = CURRENT_SCRIPT_DIR
while os.path.basename(BASE_DIR) in ['vault', 'backend', 'tests', 'script']:
    BASE_DIR = os.path.dirname(BASE_DIR)

FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

if not os.path.exists(FRONTEND_DIR):
    possible_nested = os.path.join(BASE_DIR, 'BiblioDrift-main', 'frontend')
    if os.path.exists(possible_nested):
        FRONTEND_DIR = possible_nested
        BASE_DIR = os.path.join(BASE_DIR, 'BiblioDrift-main')

PAGES_DIR = os.path.join(FRONTEND_DIR, 'pages')

if not os.path.exists(PAGES_DIR):
    raise FileNotFoundError(
        f"\n[CRITICAL ERROR] Could not find your 'frontend/pages/' directory!\n"
        f"Checked Path: {PAGES_DIR}\n"
        f"Please make sure your terminal is opened directly to the project folder."
    )

app = Flask(
    __name__, 
    template_folder=PAGES_DIR,     
    static_folder=FRONTEND_DIR,    
    static_url_path=''            
)
CORS(app, supports_credentials=True, origins=[
    'http://127.0.0.1:5500', 'http://localhost:5500',
    'http://127.0.0.1:5001', 'http://localhost:5001',
    'http://127.0.0.1:5000', 'http://localhost:5000'
])

app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(CURRENT_SCRIPT_DIR, 'vault_test.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Book(db.Model):
    __tablename__ = 'books'
    id = db.Column(db.Integer, primary_key=True)
    google_books_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    authors = db.Column(db.String(255), nullable=False)
    thumbnail = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "google_books_id": self.google_books_id,
            "title": self.title,
            "authors": self.authors.split(", ") if self.authors else [],
            "thumbnail": self.thumbnail
        }

class ShelfItem(db.Model):
    __tablename__ = 'shelf_items'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    shelf_type = db.Column(db.String(50), nullable=False)
    version = db.Column(db.Integer, default=1, nullable=False)
    genre = db.Column(db.String(100), default='General')
    description = db.Column(db.Text, default='')
    privacy = db.Column(db.String(20), default='public')

    book = db.relationship('Book', backref=db.backref('shelf_items', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "book_id": self.book_id,
            "shelf_type": self.shelf_type,
            "version": self.version,
            "genre": self.genre,
            "description": self.description,
            "privacy": self.privacy,
            "book_details": self.book.to_dict() if self.book else None
        }

class ShelfTypeEnum(str, Enum):
    READING = "READING"
    COMPLETED = "COMPLETED"
    WANT_TO_READ = "WANT_TO_READ"

class AddToLibraryRequest(BaseModel):
    user_id: str
    google_books_id: str
    title: str
    authors: List[str]
    thumbnail: str
    shelf_type: ShelfTypeEnum
    genre: Optional[str] = "General"
    description: Optional[str] = ""
    privacy: Optional[str] = "public"

class UpdateShelfItemRequest(BaseModel):
    shelf_type: Optional[ShelfTypeEnum] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    privacy: Optional[str] = None

#routes for rendering frontend pages
@app.route('/')
@app.route('/index')
@app.route('/index.html')
def render_index():
    return render_template('index.html')

@app.route('/chat')
@app.route('/chat.html')
def render_chat():
    return render_template('chat.html')

@app.route('/auth')
@app.route('/auth.html')
def render_auth():
    return render_template('auth.html')

@app.route('/vault')
@app.route('/vault.html')
def render_vault_interface():
    return render_template('vault.html')

@app.route('/library')
@app.route('/library.html')
def render_library():
    return render_template('library.html')

@app.route('/profile')
@app.route('/profile.html')
def render_profile():
    return render_template('profile.html')

# 1. ADD OR UPDATE BOOK IN LIBRARY
@app.route('/api/v1/library', methods=['POST'])
def add_to_library():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Empty tracking payload assignment"}), 400

        try:
            validated_data = AddToLibraryRequest(**data)
        except Exception as validation_err:
            logger.warning(f"Payload validation mismatch: {validation_err}")
            return jsonify({"error": "Validation Failed", "details": str(validation_err)}), 400

        book = Book.query.filter_by(google_books_id=validated_data.google_books_id).first()
        if not book:
            authors_str = ", ".join(validated_data.authors)
            book = Book(
                google_books_id=validated_data.google_books_id,
                title=validated_data.title,
                authors=authors_str,
                thumbnail=validated_data.thumbnail
            )
            db.session.add(book)
            db.session.flush()

        existing_item = ShelfItem.query.filter_by(
            user_id=int(validated_data.user_id), 
            book_id=book.id
        ).first()

        if existing_item:
            existing_item.shelf_type = validated_data.shelf_type.value
            existing_item.genre = validated_data.genre
            existing_item.description = validated_data.description
            existing_item.privacy = validated_data.privacy
            existing_item.version += 1
            item = existing_item
        else:
            item = ShelfItem(
                user_id=int(validated_data.user_id),
                book_id=book.id,
                shelf_type=validated_data.shelf_type.value,
                genre=validated_data.genre,
                description=validated_data.description,
                privacy=validated_data.privacy
            )
            db.session.add(item)

        db.session.commit()
        return jsonify({"status": "success", "data": {"item": item.to_dict()}}), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Internal database transaction error: {e}")
        return jsonify({"error": "Internal database error", "details": str(e)}), 500


# 2. GET USER'S SHELF ITEMS 
@app.route('/api/v1/library', methods=['GET'])
def get_library():
    user_id = request.args.get('user_id')
    shelf_type = request.args.get('shelf_type')  # Optional: READING, COMPLETED, WANT_TO_READ

    if not user_id:
        return jsonify({"error": "Missing user_id parameter"}), 400

    query = ShelfItem.query.filter_by(user_id=int(user_id))
    
    if shelf_type:
        query = query.filter_by(shelf_type=shelf_type.upper())

    items = query.all()
    return jsonify({"status": "success", "data": [item.to_dict() for item in items]}), 200


# 3. UPDATE SPECIFIC SHELF ITEM PROPERTIES 
# Example: PATCH /api/v1/library/1
@app.route('/api/v1/library/<int:item_id>', methods=['PATCH'])
def update_shelf_item(item_id):
    try:
        data = request.get_json()
        item = ShelfItem.query.get(item_id)
        
        if not item:
            return jsonify({"error": "Shelf item not found"}), 404

        try:
            validated_data = UpdateShelfItemRequest(**data)
        except Exception as validation_err:
            return jsonify({"error": "Validation Failed", "details": str(validation_err)}), 400

        if validated_data.shelf_type is not None:
            item.shelf_type = validated_data.shelf_type.value
        if validated_data.genre is not None:
            item.genre = validated_data.genre
        if validated_data.description is not None:
            item.description = validated_data.description
        if validated_data.privacy is not None:
            item.privacy = validated_data.privacy
        
        item.version += 1
        db.session.commit()
        
        return jsonify({"status": "success", "data": {"item": item.to_dict()}}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Internal update error", "details": str(e)}), 500


# 4. REMOVE ITEM FROM SHELF
@app.route('/api/v1/library/<int:item_id>', methods=['DELETE'])
def remove_from_library(item_id):
    try:
        item = ShelfItem.query.get(item_id)
        if not item:
            return jsonify({"error": "Shelf item not found"}), 404

        db.session.delete(item)
        db.session.commit()
        return jsonify({"status": "success", "message": f"Successfully deleted shelf item {item_id}"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Internal deletion error", "details": str(e)}), 500


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    print("BIBLIODRIFT")
    print(f" Execution Base Context:  {BASE_DIR}")
    print(f" Template Location Pages: {PAGES_DIR}")
    print(f" Asset Directory Mount:   {FRONTEND_DIR}")
    app.run(host='127.0.0.1', port=5001, debug=True, use_reloader=False)
