from unittest.mock import Mock, patch


def test_books_search_proxies_key_server_side(client):
    upstream = Mock()
    upstream.status_code = 200
    upstream.json.return_value = {"items": [{"id": "book-1"}], "totalItems": 1}

    with patch("backend.app.requests.get", return_value=upstream) as mock_get:
        response = client.get(
            "/api/v1/books/search?q=cozy%20mystery&maxResults=6&printType=books&langRestrict=en"
        )

    assert response.status_code == 200
    assert response.get_json()["items"][0]["id"] == "book-1"

    _, kwargs = mock_get.call_args
    assert kwargs["timeout"] == 6
    assert kwargs["params"]["q"] == "cozy mystery"
    assert kwargs["params"]["maxResults"] == 6
    assert kwargs["params"]["printType"] == "books"
    assert kwargs["params"]["langRestrict"] == "en"
    assert kwargs["params"]["key"] == "test-dummy-google-books-key"


def test_books_search_rejects_missing_query(client):
    response = client.get("/api/v1/books/search?maxResults=6")

    assert response.status_code == 400
    payload = response.get_json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "VALIDATION_ERROR"


def test_books_search_caps_max_results(client):
    response = client.get("/api/v1/books/search?q=fiction&maxResults=100")

    assert response.status_code == 400
    assert response.get_json()["error"]["message"] == "maxResults must be between 1 and 40"


def test_books_search_handles_upstream_failure(client):
    upstream = Mock()
    upstream.status_code = 503

    with patch("backend.app.requests.get", return_value=upstream):
        response = client.get("/api/v1/books/search?q=fiction")

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "SERVICE_UNAVAILABLE"
