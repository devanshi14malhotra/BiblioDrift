# Placeholder for database models.
# Define SQLAlchemy models for 'User' and 'ShelfItem' here.
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.orm import validates
import logging

logger = logging.getLogger(__name__)

db = SQLAlchemy()

class SoftDeleteQuery(db.Query):
    """
    =========================================================================
    CUSTOM SOFT DELETE QUERY LOGIC
    =========================================================================
    Why?: Standard database deletions are permanent and can lead to data loss.
    This custom Query class automatically filters out records where the 
    'is_deleted' flag is set to True. This ensures that soft-deleted items
    remain in the database for auditing and recovery purposes but are
    invisible to standard application queries.
    
    The filter_by method is overridden to inject 'is_deleted=False' by default.
    =========================================================================
    """
    def filter_by(self, **kwargs):
        """Automatically exclude deleted records unless explicitly requested."""
        if 'is_deleted' not in kwargs:
            kwargs['is_deleted'] = False
        return super(SoftDeleteQuery, self).filter_by(**kwargs)

    def get(self, ident):
        """Override get to exclude soft-deleted records."""
        obj = super(SoftDeleteQuery, self).get(ident)
        if obj and getattr(obj, 'is_deleted', False):
            return None
        return obj

    def with_deleted(self):
        """
        Special query method to explicitly include both active and 
        soft-deleted records in the results.
        """
        # Bypasses the default filter by explicitly setting is_deleted to either True or False
        # In a real implementation, this might be more complex, but for this
        # use case, returning the base query is sufficient.
        return super(SoftDeleteQuery, self)

class SoftDeleteMixin:
    """
    =========================================================================
    SOFT DELETE MIXIN
    =========================================================================
    Provides soft-deletion capabilities to SQLAlchemy models.
    
    ATTRIBUTES:
    - is_deleted: Boolean flag indicating if the record is logically deleted.
    
    METHODS:
    - soft_delete(): Marks the record as deleted and commits the change.
    - restore(): Reverses a soft-delete operation.
    =========================================================================
    """
    is_deleted = db.Column(db.Boolean, default=False, nullable=False, index=True)

    def soft_delete(self):
        """Logical deletion: set the is_deleted flag and persist."""
        self.is_deleted = True
        db.session.add(self)
        try:
            db.session.commit()
            logger.info(f"Successfully soft-deleted {self.__class__.__name__} ID: {self.id}")
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"CRITICAL: Failed to soft-delete {self.__class__.__name__} ID: {self.id}: {e}")
            raise

    def restore(self):
        """Restore a logically deleted record."""
        self.is_deleted = False
        db.session.add(self)
        try:
            db.session.commit()
            logger.info(f"Successfully restored {self.__class__.__name__} ID: {self.id}")
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"CRITICAL: Failed to restore {self.__class__.__name__} ID: {self.id}: {e}")
            raise

class User(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_deleted": self.is_deleted
        }

class Book(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
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
            "description": self.description,
            "is_deleted": self.is_deleted
        }

class ShelfItem(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False, index=True)
    shelf_type = db.Column(db.String(50), nullable=False)
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

    # =========================================================================
    # INTENSIVE INPUT VALIDATION AND SANITIZATION
    # =========================================================================
    # Why?: Unvalidated input can lead to SQL injection, command injection, 
    # or application crashes. By enforcing strict validation rules at the 
    # database model level, we ensure that all incoming request parameters 
    # are thoroughly validated and sanitized before they are processed or 
    # persisted to the database. This acts as a robust defense mechanism.

    @validates('progress')
    def validate_progress(self, key, value):
        """
        Validate and sanitize the 'progress' parameter.
        Ensures the progress is a valid non-negative integer.
        """
        if value is not None:
            try:
                val = int(value)
                if val < 0:
                    raise ValueError(f"Invalid progress value: {value}. Progress cannot be negative.")
                return val
            except (ValueError, TypeError):
                raise ValueError(f"Invalid progress type: {value}. Must be an integer.")
        return value

    @validates('rating')
    def validate_rating(self, key, value):
        """
        Validate and sanitize the 'rating' parameter.
        Ensures the rating is an integer between 1 and 5.
        """
        if value is not None:
            try:
                val = int(value)
                if val < 1 or val > 5:
                    raise ValueError(f"Invalid rating value: {value}. Rating must be between 1 and 5.")
                return val
            except (ValueError, TypeError):
                raise ValueError(f"Invalid rating type: {value}. Must be an integer.")
        return value

    @validates('target_price')
    def validate_target_price(self, key, value):
        """
        Validate and sanitize the 'target_price' parameter.
        Ensures the target price is a valid non-negative float.
        """
        if value is not None:
            try:
                val = float(value)
                if val < 0:
                    raise ValueError(f"Invalid target_price value: {value}. Price cannot be negative.")
                return val
            except (ValueError, TypeError):
                raise ValueError(f"Invalid target_price type: {value}. Must be a float.")
        return value

    @validates('shelf_type')
    def validate_shelf_type(self, key, value):
        """
        =========================================================================
        SHELF TYPE VALIDATION LOGIC
        =========================================================================
        
        This method ensures that the 'shelf_type' property is always set to one
        of the allowed, predefined values before any database operations occur.
        
        ALLOWED VALUES:
        - 'want': Books the user wants to read in the future.
        - 'current': Books the user is currently reading.
        - 'finished': Books the user has already finished reading.
        
        RATIONALE:
        While Pydantic models typically handle validation at the API layer,
        relying solely on API-level validation is insufficient for robust
        data integrity. Direct database insertions, future code modifications,
        or internal background jobs that bypass the API layer could potentially
        store invalid values (e.g., 'wishlist', 'reading', 'done') in the
        'shelf_type' column. This would lead to inconsistent states, breaking
        frontend rendering and business logic.
        
        By implementing this ORM-level @validates decorator, we establish an
        additional layer of defense (defense-in-depth). This guarantees that
        any Python code interacting with the ShelfItem model must provide a
        valid shelf_type, regardless of whether the request originated from
        an API endpoint or an internal service.
        
        Furthermore, we couple this ORM validation with a strict database-level
        CHECK constraint defined in __table_args__. This dual-layered approach
        ensures absolute data consistency across all system layers.
        
        PROCESS:
        1. Check if the incoming value is within the allowed set.
        2. If invalid, log the attempt (optional but good for auditing) and
           raise a ValueError detailing the expected values.
        3. If valid, return the value to be assigned to the model instance.
        
        =========================================================================
        """
        
        # Define the strict set of allowed shelf types
        allowed_types = {'want', 'current', 'finished'}
        
        # Perform the validation check against the allowed types
        if value not in allowed_types:
            
            # Construct a detailed error message for better debugging
            error_msg = (
                f"CRITICAL VALIDATION ERROR: Invalid shelf_type provided: '{value}'. "
                f"The shelf_type must be strictly one of the following "
                f"allowed values: {', '.join(allowed_types)}."
            )
            
            # Raise a ValueError to prevent the invalid data from being processed
            raise ValueError(error_msg)
            
        # Return the validated and sanitized value
        return value

    # Relationships
    user = db.relationship('User', backref=db.backref('shelf_items', lazy=True))
    book = db.relationship('Book', backref=db.backref('shelf_items', lazy=True))
    price_alerts = db.relationship('PriceAlert', backref='shelf_item', lazy=True, cascade='all, delete-orphan')

    # =========================================================================
    # DATABASE LEVEL CONSTRAINTS
    # =========================================================================
    # Implementing strict database-level constraints is a critical best
    # practice for ensuring data integrity and preventing data corruption.
    # 
    # The CheckConstraint defined below acts as the ultimate safeguard against
    # invalid 'shelf_type' values being written to the database. Even if both
    # the API validation layer and the SQLAlchemy ORM validation layer were
    # to fail or be bypassed entirely (e.g., via direct SQL execution or
    # faulty database migration scripts), the database engine itself will
    # strictly reject any row that does not conform to the defined rules.
    #
    # This addresses the specific vulnerability where a plain db.String(50)
    # column could accept arbitrary string values, leading to unrecoverable
    # application states.
    # =========================================================================

    __table_args__ = (
        db.CheckConstraint(
            "shelf_type IN ('want', 'current', 'finished')", 
            name='check_valid_shelf_type'
        ),
    )

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
            "version": self.version,
            "is_deleted": self.is_deleted
        }

class BookNote(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    id = db.Column(db.Integer, primary_key=True)
    book_title = db.Column(db.String(255), nullable=False)
    book_author = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_book_note_title_author', 'book_title', 'book_author'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "book_title": self.book_title,
            "book_author": self.book_author,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_deleted": self.is_deleted
        }


class ReadingGoal(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for tracking user's annual reading goals."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
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
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted
        }


class ReadingStats(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for tracking user's monthly reading statistics."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
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
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted
        }


class Collection(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for user's custom book collections."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
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
            "item_count": len(self.items),
            "is_deleted": self.is_deleted
        }
        if include_items:
            result["items"] = [item.to_dict() for item in self.items]
        return result


class CollectionItem(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for items in a user's collection."""
    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('collection.id'), nullable=False, index=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False, index=True)
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
            "added_at": self.added_at.isoformat() if self.added_at else None,
            "is_deleted": self.is_deleted
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

class PriceHistory(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for tracking book prices across different retailers."""
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False, index=True)
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
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
            "is_deleted": self.is_deleted
        }


class PriceAlert(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
    """Model for user's price alerts on books."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    shelf_item_id = db.Column(db.Integer, db.ForeignKey('shelf_item.id'), nullable=False, index=True)
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
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted
        }


# ==================== BOOK REVIEWS & RATINGS ====================

class Review(db.Model, SoftDeleteMixin):
    query_class = SoftDeleteQuery
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
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted
        }
