import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from flask import Flask
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.models import MoodCache, db
from backend.mood_analysis.ai_service_enhanced import AIBookService, CacheConfig


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
def clear_mood_cache(flask_app):
    with flask_app.app_context():
        MoodCache.query.delete()
        db.session.commit()
        yield
        MoodCache.query.delete()
        db.session.commit()


def test_analyze_book_mood_persists_to_db(flask_app):
    with flask_app.app_context():
        service = AIBookService()

        with patch.object(service.scraper, 'get_book_reviews', return_value=['review one']), \
             patch.object(
                 service.mood_analyzer,
                 'determine_primary_mood',
                 return_value={
                     'primary_moods': [{'mood': 'cozy'}],
                     'bibliodrift_vibe': 'Warm and inviting',
                 },
             ):
            result = service.analyze_book_mood('The Test Book', 'Test Author')

        cache_key = 'the test book|test author'
        cached_entry = MoodCache.query.filter_by(cache_key=cache_key).first()

        assert result == {
            'primary_moods': [{'mood': 'cozy'}],
            'bibliodrift_vibe': 'Warm and inviting',
        }
        assert cached_entry is not None
        assert json.loads(cached_entry.analysis_json) == result


def test_analyze_book_mood_uses_cached_row(flask_app):
    with flask_app.app_context():
        service = AIBookService()

        with patch.object(service.scraper, 'get_book_reviews', return_value=['review one']), \
             patch.object(
                 service.mood_analyzer,
                 'determine_primary_mood',
                 return_value={
                     'primary_moods': [{'mood': 'mysterious'}],
                     'bibliodrift_vibe': 'Quiet and mysterious',
                 },
             ):
            first_result = service.analyze_book_mood('Cached Book', 'Cached Author')

        with patch.object(service.scraper, 'get_book_reviews', side_effect=AssertionError('scraper should not run')), \
             patch.object(service.mood_analyzer, 'determine_primary_mood', side_effect=AssertionError('analyzer should not run')):
            second_result = service.analyze_book_mood('Cached Book', 'Cached Author')

        assert second_result == first_result
        assert MoodCache.query.filter_by(cache_key='cached book|cached author').count() == 1


def test_analyze_book_mood_refreshes_stale_row(flask_app):
    with flask_app.app_context():
        service = AIBookService()

        with patch.object(service.scraper, 'get_book_reviews', return_value=['old review']), \
             patch.object(
                 service.mood_analyzer,
                 'determine_primary_mood',
                 return_value={
                     'primary_moods': [{'mood': 'dark'}],
                     'bibliodrift_vibe': 'Dark and brooding',
                 },
             ):
            service.analyze_book_mood('Stale Book', 'Stale Author')

        cached_entry = MoodCache.query.filter_by(cache_key='stale book|stale author').first()
        cached_entry.updated_at = datetime.now(timezone.utc) - timedelta(seconds=CacheConfig.MOOD_ANALYSIS_TTL + 10)
        db.session.commit()

        with patch.object(service.scraper, 'get_book_reviews', return_value=['fresh review']), \
             patch.object(
                 service.mood_analyzer,
                 'determine_primary_mood',
                 return_value={
                     'primary_moods': [{'mood': 'uplifting'}],
                     'bibliodrift_vibe': 'Bright and uplifting',
                 },
             ):
            refreshed_result = service.analyze_book_mood('Stale Book', 'Stale Author')

        refreshed_entry = MoodCache.query.filter_by(cache_key='stale book|stale author').first()

        assert refreshed_result == {
            'primary_moods': [{'mood': 'uplifting'}],
            'bibliodrift_vibe': 'Bright and uplifting',
        }
        assert json.loads(refreshed_entry.analysis_json) == refreshed_result