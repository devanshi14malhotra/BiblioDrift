import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.models import PasswordResetToken, User, db
from backend.password_reset_service import (
    create_password_reset_token,
    request_password_reset,
    reset_password_with_token,
)


@pytest.fixture(scope='module')
def flask_app():
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    db.init_app(app)

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def clean_tables(flask_app):
    with flask_app.app_context():
        PasswordResetToken.query.delete()
        User.query.delete()
        db.session.commit()
        yield
        PasswordResetToken.query.delete()
        User.query.delete()
        db.session.commit()


def _create_user(email='reader@example.com'):
    user = User(username='reader', email=email)
    user.set_password('old-password-1')
    db.session.add(user)
    db.session.commit()
    return user


def test_request_password_reset_returns_token_for_known_email(flask_app):
    with flask_app.app_context():
        _create_user()
        token = request_password_reset('reader@example.com')
        assert token
        assert PasswordResetToken.query.count() == 1


def test_request_password_reset_unknown_email_returns_none(flask_app):
    with flask_app.app_context():
        token = request_password_reset('missing@example.com')
        assert token is None
        assert PasswordResetToken.query.count() == 0


def test_reset_password_with_valid_token(flask_app):
    with flask_app.app_context():
        user = _create_user()
        plain = create_password_reset_token(user)
        ok, message = reset_password_with_token(plain, 'new-password-9')
        assert ok is True
        assert 'successfully' in message.lower()
        assert user.check_password('new-password-9')


def test_reset_password_rejects_reused_token(flask_app):
    with flask_app.app_context():
        user = _create_user()
        plain = create_password_reset_token(user)
        assert reset_password_with_token(plain, 'new-password-9')[0] is True
        ok, _ = reset_password_with_token(plain, 'another-password')
        assert ok is False
