"""
tests/test_llm.py

Proper pytest test suite for the LLMService in backend/ai_service.py.
All external LLM calls are mocked — no real API keys required.
"""

import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_service(openai=None, groq=None, gemini=None):
    """
    Return a bare LLMService instance with clients pre-set without
    triggering the real _setup_* methods (which read live API keys).
    """
    from ai_service import LLMService
    svc = LLMService.__new__(LLMService)
    svc.openai_client = openai
    svc.groq_client = groq
    svc.gemini_client = gemini
    svc.preferred_llm = 'groq'
    svc.config = {
        'openai_model': 'gpt-3.5-turbo',
        'openai_temperature': 0.7,
        'openai_max_tokens': 500,
        'groq_model': 'llama-3.1-8b-instant',
        'groq_temperature': 0.7,
        'groq_max_tokens': 500,
        'gemini_model': 'models/gemini-2.0-flash-lite',
        'gemini_temperature': 0.7,
        'gemini_max_tokens': 500,
        'default_max_tokens': 150,
        'book_note_max_tokens': 400,
        'recommendation_max_tokens': 150,
        'category_books_max_tokens': 600,
        'test_max_tokens': 10,
    }
    return svc


# ---------------------------------------------------------------------------
# is_available()
# ---------------------------------------------------------------------------

class TestIsAvailable:
    def test_returns_false_when_no_clients(self):
        svc = _make_service()
        assert svc.is_available() is False

    def test_returns_true_with_groq_client(self):
        svc = _make_service(groq=MagicMock())
        assert svc.is_available() is True

    def test_returns_true_with_openai_client(self):
        svc = _make_service(openai=True)
        assert svc.is_available() is True

    def test_returns_true_with_gemini_client(self):
        svc = _make_service(gemini=MagicMock())
        assert svc.is_available() is True

    def test_returns_true_when_all_clients_set(self):
        svc = _make_service(openai=True, groq=MagicMock(), gemini=MagicMock())
        assert svc.is_available() is True


# ---------------------------------------------------------------------------
# generate_text()
# ---------------------------------------------------------------------------

class TestGenerateText:
    def test_returns_none_when_no_service_available(self):
        svc = _make_service()
        result = svc.generate_text("hello")
        assert result is None

    def test_delegates_to_groq_when_preferred(self):
        svc = _make_service(groq=MagicMock())
        svc.preferred_llm = 'groq'

        with patch.object(svc, '_generate_with_groq', return_value='groq response') as mock_groq:
            result = svc.generate_text("test prompt")

        assert result == 'groq response'
        mock_groq.assert_called_once()

    def test_falls_back_to_groq_when_preferred_unavailable(self):
        """preferred=openai but openai is None → falls back to groq."""
        svc = _make_service(groq=MagicMock())
        svc.preferred_llm = 'openai'  # preferred, but openai_client is None

        with patch.object(svc, '_generate_with_groq', return_value='fallback') as mock_groq:
            result = svc.generate_text("fallback test")

        assert result == 'fallback'
        mock_groq.assert_called_once()

    def test_uses_default_max_tokens_when_none_given(self):
        svc = _make_service(groq=MagicMock())

        with patch.object(svc, '_generate_with_groq', return_value='ok') as mock_groq:
            svc.generate_text("prompt")

        _, called_tokens = mock_groq.call_args[0]
        assert called_tokens == svc.config['default_max_tokens']

    def test_respects_explicit_max_tokens(self):
        svc = _make_service(groq=MagicMock())

        with patch.object(svc, '_generate_with_groq', return_value='ok') as mock_groq:
            svc.generate_text("prompt", max_tokens=42)

        _, called_tokens = mock_groq.call_args[0]
        assert called_tokens == 42


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

class TestLLMServiceSingleton:
    def test_llm_service_is_importable(self):
        from ai_service import llm_service
        assert llm_service is not None

    def test_llm_service_has_is_available(self):
        from ai_service import llm_service
        assert callable(llm_service.is_available)

    def test_llm_service_has_generate_text(self):
        from ai_service import llm_service
        assert callable(llm_service.generate_text)

    def test_llm_service_unavailable_without_real_keys(self, monkeypatch):
        """
        In CI the keys are fake strings. The _setup_* methods create real
        client objects only when the SDK accepts the key. For providers that
        validate eagerly (OpenAI, Gemini) a fake key raises, so the client
        stays None. Groq may or may not validate eagerly; we mock the import.
        """
        with patch('ai_service.GROQ_AVAILABLE', False), \
             patch('ai_service.OPENAI_AVAILABLE', False), \
             patch('ai_service.GEMINI_AVAILABLE', False):
            from ai_service import LLMService
            svc = LLMService()
            assert svc.is_available() is False