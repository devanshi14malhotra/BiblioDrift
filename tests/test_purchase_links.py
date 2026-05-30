import os
os.environ['APP_ENV'] = 'testing'
import pytest
import json
import sys
from unittest.mock import patch
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_purchase_links_missing_title(client):
    """Test purchase-links endpoint with missing title parameter."""
    response = client.get('/api/v1/books/purchase-links')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False
    assert 'error' in data
    assert data['error'] == 'Title is required'

@patch('purchase_links.purchase_manager.PurchaseManager.get_quick_links')
def test_purchase_links_success(mock_get_quick_links, client):
    """Test purchase-links endpoint with valid parameters and mocked manager."""
    mock_get_quick_links.return_value = [
        {
            'platform': 'google_books',
            'name': 'Google Books',
            'url': 'https://books.google.com/books?id=zyTCAlFPjgYC',
            'available': True,
            'color': '#EA4335',
            'icon': 'fa-solid fa-book'
        }
    ]
    
    response = client.get('/api/v1/books/purchase-links?title=Dune&author=Frank+Herbert&isbn=9780441172719')
    data = json.loads(response.data)
    print("RESPONSE DATA:", data)
    assert response.status_code == 200
    assert data['success'] is True
    assert 'links' in data
    
    links = data['links']
    assert len(links) == 1
    assert links[0]['name'] == 'Google Books'
    assert links[0]['url'] == 'https://books.google.com/books?id=zyTCAlFPjgYC'
    assert links[0]['color'] == '#EA4335'
    assert links[0]['icon'] == 'fa-solid fa-book'
