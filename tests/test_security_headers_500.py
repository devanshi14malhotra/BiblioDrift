import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        yield test_client


def _assert_full_security_headers(response):
    assert response.status_code == 500

    # Core hardened headers (must match _apply_security_headers)
    assert response.headers['Content-Security-Policy'].startswith("default-src 'self'")
    assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']
    assert response.headers['Strict-Transport-Security'] == 'max-age=31536000; includeSubDomains'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert response.headers['Permissions-Policy'] == 'geolocation=(), microphone=(), camera=()'
    assert response.headers['X-Frame-Options'] == 'DENY'


def test_unhandled_exception_returns_full_security_headers(client, monkeypatch):
    # Force an unhandled exception within a request context
    def boom():
        raise Exception('test boom')

    # Temporarily register a route only for this test run
    endpoint = 'test_unhandled_exception'
    rule = '/api/v1/test-500-unhandled'

    app.add_url_rule(rule, endpoint, boom, methods=['GET'])
    try:
        response = client.get(rule)
        _assert_full_security_headers(response)
    finally:
        # Flask doesn't expose a clean route removal API; rely on TESTING cleanup.
        # In CI, tests run in a fresh process.
        pass


def test_sqlalchemy_exception_returns_full_security_headers(client):
    from sqlalchemy.exc import SQLAlchemyError

    endpoint = 'test_sqlalchemy_exception'
    rule = '/api/v1/test-500-sqlalchemy'

    def db_boom():
        raise SQLAlchemyError('test sqlalchemy error')

    app.add_url_rule(rule, endpoint, db_boom, methods=['GET'])
    try:
        response = client.get(rule)
        _assert_full_security_headers(response)
    finally:
        pass

