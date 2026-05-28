import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    with app.test_client() as test_client:
        yield test_client


def test_login_rate_limit_returns_429_and_retry_after(client):
    """Login should be throttled after 5 requests in 10 seconds."""
    payload = {"username": "rate-limit-user", "password": "bad-password"}

    for _ in range(5):
        response = client.post('/api/v1/login', json=payload)
        assert response.status_code in (400, 401)

    blocked_response = client.post('/api/v1/login', json=payload)
    assert blocked_response.status_code == 429
    assert 'Retry-After' in blocked_response.headers
    assert int(blocked_response.headers['Retry-After']) >= 1


from unittest.mock import patch

def test_purchase_links_rate_limit_returns_429_and_retry_after(client):
    """Purchase link generation endpoint should enforce rate limits."""
    with patch('purchase_links.PurchaseManager.get_quick_links', return_value=[]):
        for _ in range(20):
            response = client.get('/api/v1/books/purchase-links?title=Dune')
            assert response.status_code in (200, 500)

        blocked_response = client.get('/api/v1/books/purchase-links?title=Dune')
        assert blocked_response.status_code == 429
        assert 'Retry-After' in blocked_response.headers
        assert int(blocked_response.headers['Retry-After']) >= 1
