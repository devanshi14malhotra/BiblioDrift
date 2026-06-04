"""
tests/conftest.py
Shared pytest fixtures. No live server needed — uses Flask test client
with an in-memory SQLite database.
"""

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Make backend/ importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
for p in (ROOT, BACKEND):
    if p not in sys.path:
        sys.path.insert(0, p)

# Stub out heavy optional packages so tests don't need GPU/model downloads
for _mod in [
    "transformers", "sentence_transformers",
    "nltk", "nltk.tokenize", "nltk.tokenize.api",
    "huggingface_hub", "safetensors", "tokenizers", "tqdm", "joblib",
    "textblob", "textblob.blob", "textblob.base",
]:
    sys.modules.setdefault(_mod, MagicMock())

# Set required env vars before importing app so validation passes
os.environ.setdefault("GOOGLE_BOOKS_API_KEY", "fake-key-for-testing")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENAI_API_KEY", "fake-openai-key")
os.environ.setdefault("GROQ_API_KEY", "fake-groq-key")
os.environ.setdefault("GEMINI_API_KEY", "fake-gemini-key")
os.environ.setdefault("FLASK_ENV", "testing")

from backend.app import app as flask_app, db as _db
from backend.models import User


@pytest.fixture(scope="session")
def app():
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY="test-secret-key",
        SECRET_KEY="test-secret-key",
        RATELIMIT_ENABLED=False,
    )
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.drop_all()


@pytest.fixture
def client(app):
    with app.test_client() as c:
        with app.app_context():
            yield c
            _db.session.rollback()
            for tbl in reversed(_db.metadata.sorted_tables):
                _db.session.execute(tbl.delete())
            _db.session.commit()


@pytest.fixture
def test_user(app):
    with app.app_context():
        user = User(username="testuser", email="test@example.com")
        user.set_password("Password123!")
        _db.session.add(user)
        _db.session.commit()
        _db.session.refresh(user)
        return user


@pytest.fixture
def auth_headers(client, test_user):
    resp = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "Password123!"},
    )
    token = resp.get_json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


# --- Mocks for external services (issue #511 requirement) ---

@pytest.fixture
def mock_openai():
    with patch("backend.ai_service.openai") as m:
        m.ChatCompletion.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Mocked AI response"))]
        )
        yield m


@pytest.fixture
def mock_groq():
    with patch("backend.ai_service.groq") as m:
        m.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Mocked Groq response"))]
        )
        yield m


@pytest.fixture
def mock_gemini():
    with patch("backend.ai_service.genai") as m:
        m.GenerativeModel.return_value.generate_content.return_value = MagicMock(
            text="Mocked Gemini response"
        )
        yield m


@pytest.fixture
def mock_price_tracker():
    with patch("backend.price_tracker.price_tracker.PriceTracker.fetch_price") as m:
        m.return_value = {"price": 9.99, "currency": "USD", "source": "mock"}
        yield m