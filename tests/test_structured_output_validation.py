import pytest
from unittest.mock import patch

from backend.ai_service import _validate_book_recommendations
from backend.reader_identity.profile_generator import ReaderProfileGenerator


def test_validate_book_recommendations_accepts_valid_data():
    raw = [
        {"title": "Test Book", "author": "Test Author", "reason": "Strong match"}
    ]

    validated = _validate_book_recommendations(raw)

    assert validated == raw


def test_validate_book_recommendations_rejects_invalid_data():
    raw = [
        {"title": "Test Book", "reason": "Missing author field"}
    ]

    validated = _validate_book_recommendations(raw)

    assert validated == []


def test_generate_profile_returns_valid_reader_profile():
    generator = ReaderProfileGenerator()

    with patch.object(generator.sentiment_engine, 'analyze_reviews', return_value={
        'reader_mood': 'calm',
        'sentiment_score': 0.68,
    }), patch.object(generator.cluster_engine, 'cluster_reviews', return_value=['Reflective Reader']), patch.object(
        generator.embedding_engine,
        'compare_texts',
        return_value=0.75,
    ):
        result = generator.generate_profile(['Fantasy'], ['A quiet, thoughtful review.'])

    assert result['success'] is True
    assert result['reader_profile']['archetype'] == 'Deep Thinker'
    assert result['reader_profile']['genres'] == ['Fantasy']
    assert result['reader_profile']['review_count'] == 1
    assert result['reader_profile']['reader_mood'] == 'calm'
    assert result['reader_profile']['sentiment_score'] == 0.68
    assert result['reader_profile']['reader_cluster'] == 'Reflective Reader'
