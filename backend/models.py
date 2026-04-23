# Placeholder for database models.
# Define SQLAlchemy models for 'User' and 'ShelfItem' here.
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import logging

logger = logging.getLogger(__name__)

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    google_books_id = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    authors = db.Column(db.String(500))
    thumbnail = db.Column(db.String(500))
    description = db.Column(db.Text)
    categories = db.Column(db.String(255))
    average_rating = db.Column(db.Float)
    page_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "google_books_id": self.google_books_id,
            "title": self.title,
            "authors": self.authors,
            "thumbnail": self.thumbnail,
            "description": self.description
        }

class ShelfItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    shelf_type = db.Column(db.Enum('want', 'current', 'finished', name='shelf_item_types'), nullable=False)
    progress = db.Column(db.Integer, default=0)
    rating = db.Column(db.Integer)
    finished_at = db.Column(db.DateTime, nullable=True)  # Timestamp when book was marked as finished
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    # Price tracking fields
    price_alert = db.Column(db.Boolean, default=False)  # Enable/disable price alerts
    target_price = db.Column(db.Float, nullable=True)  # User's target price for alerts

    # Versioning for optimistic locking
    version = db.Column(db.Integer, default=1, nullable=False)

    # Relationships
    user = db.relationship('User', backref=db.backref('shelf_items', lazy=True))
    book = db.relationship('Book', backref=db.backref('shelf_items', lazy=True))
    price_alerts = db.relationship('PriceAlert', backref='shelf_item', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "google_books_id": self.book.google_books_id if self.book else None,
            "title": self.book.title if self.book else None,
            "authors": self.book.authors if self.book else None,
            "thumbnail": self.book.thumbnail if self.book else None,
            "shelf_type": self.shelf_type,
            "progress": self.progress,
            "rating": self.rating,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "price_alert": self.price_alert,
            "target_price": self.target_price,
            "version": self.version
        }

class BookNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_title = db.Column(db.String(255), nullable=False)
    book_author = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_book_note_title_author', 'book_title', 'book_author'),
    )


class ReadingGoal(db.Model):
    """Model for tracking user's annual reading goals."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    target_books = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('reading_goals', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'year', name='uq_user_year_goal'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "year": self.year,
            "target_books": self.target_books,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ReadingStats(db.Model):
    """Model for tracking user's monthly reading statistics."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    books_completed = db.Column(db.Integer, default=0)
    pages_read = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('reading_stats', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'year', 'month', name='uq_user_year_month_stats'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "year": self.year,
            "month": self.month,
            "books_completed": self.books_completed,
            "pages_read": self.pages_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Collection(db.Model):
    """Model for user's custom book collections."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('collections', lazy=True))
    items = db.relationship('CollectionItem', backref='collection', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'name', name='uq_user_collection_name'),
    )

    def to_dict(self, include_items=False):
        result = {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "item_count": len(self.items)
        }
        if include_items:
            result["items"] = [item.to_dict() for item in self.items]
        return result


class CollectionItem(db.Model):
    """Model for items in a user's collection."""
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collection.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    book = db.relationship('Book', backref=db.backref('collection_items', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('collection_id', 'book_id', name='uq_collection_book'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "collection_id": self.collection_id,
            "book_id": self.book_id,
            "google_books_id": self.book.google_books_id if self.book else None,
            "title": self.book.title if self.book else None,
            "authors": self.book.authors if self.book else None,
            "thumbnail": self.book.thumbnail if self.book else None,
            "added_at": self.added_at.isoformat() if self.added_at else None
        }


def register_user(username, email, password):
    """Register a new user in the database."""
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
        logger.info(f"User {username} registered successfully")
        return user
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error registering user {username}: {e}")
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error registering user {username}: {e}")
        raise

def login_user(identifier, password):
    # Try finding by username first
    user = User.query.filter_by(username=identifier).first()
    
    # If not found, try finding by email
    if not user:
        user = User.query.filter_by(email=identifier).first()

    if user and user.check_password(password):
        logger.info("Login successful")
        return user
    logger.warning("Invalid username/email or password")
    return None


# ==================== PRICE TRACKING MODELS ====================

class PriceHistory(db.Model):
    """Model for tracking book prices across different retailers."""
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    retailer = db.Column(db.String(50), nullable=False)  # 'google_books', 'amazon', 'barnes_noble', etc.
    price = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='USD')  # ISO currency code
    checked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    book = db.relationship('Book', backref=db.backref('price_history', lazy=True))
    
    __table_args__ = (
        db.Index('idx_price_history_book_retailer', 'book_id', 'retailer'),
        db.Index('idx_price_history_checked_at', 'checked_at'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "book_id": self.book_id,
            "google_books_id": self.book.google_books_id if self.book else None,
            "title": self.book.title if self.book else None,
            "retailer": self.retailer,
            "price": self.price,
            "currency": self.currency,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None
        }


class PriceAlert(db.Model):
    """Model for user's price alerts on books."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    shelf_item_id = db.Column(db.Integer, db.ForeignKey('shelf_item.id'), nullable=False)
    target_price = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    notified_at = db.Column(db.DateTime, nullable=True)  # Timestamp when user was notified
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = db.relationship('User', backref=db.backref('price_alerts', lazy=True))
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'shelf_item_id', name='uq_user_shelf_item_alert'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "shelf_item_id": self.shelf_item_id,
            "book_id": self.shelf_item.book_id if self.shelf_item else None,
            "google_books_id": self.shelf_item.book.google_books_id if self.shelf_item and self.shelf_item.book else None,
            "title": self.shelf_item.book.title if self.shelf_item and self.shelf_item.book else None,
            "authors": self.shelf_item.book.authors if self.shelf_item and self.shelf_item.book else None,
            "thumbnail": self.shelf_item.book.thumbnail if self.shelf_item and self.shelf_item.book else None,
            "target_price": self.target_price,
            "is_active": self.is_active,
            "notified_at": self.notified_at.isoformat() if self.notified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


# ==================== BOOK REVIEWS & RATINGS ====================

class Review(db.Model):
    """Model for user book reviews and ratings."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 star rating
    review_text = db.Column(db.Text, nullable=True)  # Optional detailed review
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = db.relationship('User', backref=db.backref('reviews', lazy=True))
    book = db.relationship('Book', backref=db.backref('reviews', lazy=True))
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'book_id', name='uq_user_book_review'),
        db.Index('idx_review_book_id', 'book_id'),
        db.Index('idx_review_user_id', 'user_id'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "book_id": self.book_id,
            "google_books_id": self.book.google_books_id if self.book else None,
            "title": self.book.title if self.book else None,
            "authors": self.book.authors if self.book else None,
            "thumbnail": self.book.thumbnail if self.book else None,
            "rating": self.rating,
            "review_text": self.review_text,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
