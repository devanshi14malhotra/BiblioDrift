# Placeholder for database models.
# Define SQLAlchemy models for 'User' and 'ShelfItem' here.
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class ShelfItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    google_books_id = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    authors = db.Column(db.String(255))
    thumbnail = db.Column(db.String(500))
    shelf_type = db.Column(db.String(50), nullable=False)  # 'want-to-read', 'currently-reading', 'favorites'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to access user details if needed
    user = db.relationship('User', backref=db.backref('shelf_items', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "google_books_id": self.google_books_id,
            "title": self.title,
            "authors": self.authors,
            "thumbnail": self.thumbnail,
            "shelf_type": self.shelf_type,
            "created_at": self.created_at.isoformat()
        }

def register_user(username, email, password):
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
        print("User registered successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"Error registering user: {e}")

def login_user(identifier, password):
    # Try finding by username first
    user = User.query.filter_by(username=identifier).first()
    
    # If not found, try finding by email
    if not user:
        user = User.query.filter_by(email=identifier).first()

    if user and user.check_password(password):
        print("Login successful!")
        return user
    print("Invalid username/email or password.")
    return None
