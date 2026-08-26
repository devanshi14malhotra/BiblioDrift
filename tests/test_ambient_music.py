"""Tests for ambient music mapping (#1404): unit tests for the mapper and
an endpoint check that /api/v1/mood-search includes an ambient_music payload."""

# Load the mapper module directly: importing the mood_analysis package pulls in
# heavy NLP deps that conftest deliberately stubs out for the test environment.
import importlib.util
import os

_SPEC = importlib.util.spec_from_file_location(
    "ambient_music",
    os.path.join(
        os.path.dirname(__file__), "..", "backend", "mood_analysis", "ambient_music.py"
    ),
)
_ambient_music = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_ambient_music)

get_ambient_music = _ambient_music.get_ambient_music
DEFAULT_PLAYLIST = _ambient_music.DEFAULT_PLAYLIST
self_check = _ambient_music.self_check


def test_cozy_query_maps_to_cozy_playlist():
    result = get_ambient_music("cozy autumn night with warm tea")
    assert result["genre"] == "Cozy Reading Cafe"
    assert result["spotify_embed_url"].startswith("https://open.spotify.com/embed/")


def test_dark_query_maps_to_dark_academia():
    result = get_ambient_music("dark academia gothic mystery", primary_moods=["dark"])
    assert result["genre"] == "Dark Academia Jazz"


def test_unknown_query_falls_back_to_default():
    result = get_ambient_music("zzz qqq xyz")
    assert result == DEFAULT_PLAYLIST


def test_self_check():
    self_check()


def test_mood_search_includes_ambient_music(client):
    """Endpoint returns ambient_music in data (AI recommendations are mocked
    away by patching; we only assert on the new field's presence/shape)."""
    from unittest.mock import patch
    from flask import url_for

    client.application.config["WTF_CSRF_ENABLED"] = False
    with patch("backend.app.get_ai_recommendations", return_value=["book1"]):
        resp = client.post(
            "/api/v1/mood-search",
            json={"query": "cozy mystery"},
        )
    assert resp.status_code == 200
    body = resp.get_json()
    # success_response flattens the data dict into the top-level JSON body
    assert "ambient_music" in body
    assert set(body["ambient_music"].keys()) == {"genre", "spotify_embed_url"}
