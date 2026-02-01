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
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class ShelfItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Add fields later as per app requirements

def register_user(username, email, password):
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
        print("User registered successfully!")
    except:
        db.session.rollback()
        print("Username or email already exists.")

def login_user(username, password):
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        print("Login successful!")
        return True
    print("Invalid username or password.")
    return False
