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


def test_security_headers_are_present_on_api_responses(client):
    response = client.get(
        '/api/v1/health',
        headers={'Origin': 'http://localhost:5500'},
    )

    assert response.status_code == 200
    assert response.headers['Content-Security-Policy'].startswith("default-src 'self'")
    assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']
    assert response.headers['Strict-Transport-Security'] == 'max-age=31536000; includeSubDomains'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert response.headers['Permissions-Policy'] == 'geolocation=(), microphone=(), camera=()'
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5500'
    assert response.headers['Access-Control-Allow-Credentials'] == 'true'
