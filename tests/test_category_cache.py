"""
Fixed tests for get_category_books caching.
Run: python -m pytest test_category_cache.py -v
CRITICAL: make sure to transfer this file to the backend folder for correct results 
"""
import pytest
from unittest.mock import patch
from flask import Flask


# ---------------------------------------------------------------
# FIXTURES — run once, shared across all tests
# ---------------------------------------------------------------

@pytest.fixture(scope='module')
def flask_app():
    """
    Cache needs a Flask app to initialize.
    Without this, decorator sees is_initialized=False
    and skips cache entirely — which is what broke all 5 tests.
    """
    app = Flask(__name__)
    app.config['TESTING'] = True

    from cache_service import cache_service
    cache_service.is_initialized = False   # force fresh init
    cache_service.init_app(app)

    return app


@pytest.fixture(autouse=True)
def clear_cache_between_tests(flask_app):
    """
    Wipe cache before every test.
    Without this, result from test 1 bleeds into test 2.
    """
    with flask_app.app_context():
        from cache_service import cache_service
        if cache_service.cache:
            cache_service.cache.clear()
        yield


# ---------------------------------------------------------------
# Test 1
# ---------------------------------------------------------------
def test_ai_called_only_once_for_same_inputs(flask_app):
    with flask_app.app_context():
        with patch('ai_service.llm_service.is_available', return_value=True), \
             patch('ai_service.llm_service.generate_text',
                   return_value='[{"title":"Test Book","author":"Test Author","reason":"fits"}]') as mock_llm:

            from ai_service import get_category_books

            result1 = get_category_books("Rainy Reads", "quiet and melancholy", 5)
            result2 = get_category_books("Rainy Reads", "quiet and melancholy", 5)
            result3 = get_category_books("Rainy Reads", "quiet and melancholy", 5)

            assert mock_llm.call_count == 1, (
                f"LLM called {mock_llm.call_count} times. Expected 1. Cache broken."
            )
            assert result1 == result2 == result3


# ---------------------------------------------------------------
# Test 2
# ---------------------------------------------------------------
def test_different_categories_get_different_cache_keys(flask_app):
    with flask_app.app_context():
        with patch('ai_service.llm_service.is_available', return_value=True), \
             patch('ai_service.llm_service.generate_text',
                   return_value='[{"title":"Book","author":"Author","reason":"fits"}]') as mock_llm:

            from ai_service import get_category_books

            get_category_books("Rainy Reads", "quiet and melancholy", 5)
            get_category_books("Adventure Shelf", "thrilling and bold", 5)

            assert mock_llm.call_count == 2, (
                f"Expected 2 LLM calls for 2 categories. Got {mock_llm.call_count}."
            )


# ---------------------------------------------------------------
# Test 3
# ---------------------------------------------------------------
def test_different_counts_get_different_cache_keys(flask_app):
    with flask_app.app_context():
        with patch('ai_service.llm_service.is_available', return_value=True), \
             patch('ai_service.llm_service.generate_text',
                   return_value='[{"title":"Book","author":"Author","reason":"fits"}]') as mock_llm:

            from ai_service import get_category_books

            get_category_books("Rainy Reads", "quiet and melancholy", 5)
            get_category_books("Rainy Reads", "quiet and melancholy", 10)

            assert mock_llm.call_count == 2, (
                f"count=5 and count=10 shared cache entry. Got {mock_llm.call_count} calls."
            )


# ---------------------------------------------------------------
# Test 4
# ---------------------------------------------------------------
def test_cached_result_matches_original_result(flask_app):
    with flask_app.app_context():
        with patch('ai_service.llm_service.is_available', return_value=True), \
             patch('ai_service.llm_service.generate_text',
                   return_value='[{"title":"The Road","author":"Cormac McCarthy","reason":"bleak and quiet"}]'):

            from ai_service import get_category_books

            expected = [{"title": "The Road", "author": "Cormac McCarthy", "reason": "bleak and quiet"}]

            first_call  = get_category_books("Dark Shelf", "bleak and quiet", 5)
            second_call = get_category_books("Dark Shelf", "bleak and quiet", 5)

            assert first_call == expected,  f"First call wrong: {first_call}"
            assert second_call == expected, f"Cached call wrong: {second_call}"
            assert first_call == second_call


# ---------------------------------------------------------------
# Test 5
# ---------------------------------------------------------------
def test_none_result_is_not_cached(flask_app):
    with flask_app.app_context():
        with patch('ai_service.llm_service.is_available', return_value=True), \
             patch('ai_service.llm_service.generate_text', return_value=None) as mock_llm:

            from ai_service import get_category_books

            result1 = get_category_books("Broken Shelf", "some vibe", 5)
            result2 = get_category_books("Broken Shelf", "some vibe", 5)

            assert mock_llm.call_count == 2, (
                f"Failure cached. LLM called {mock_llm.call_count} times, expected 2."
            )
            assert result1 == []
            assert result2 == []