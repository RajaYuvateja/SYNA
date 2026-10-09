import pytest
from unittest.mock import MagicMock, patch
from backend.app import groq_client
from backend.app import engine


def test_groq_not_configured_by_default():
    # When GROQ_API_KEY is not set or empty
    with patch.object(groq_client.settings, "groq_api_key", ""):
        assert groq_client.is_groq_configured() is False
        assert groq_client.extract_with_groq("severe headache") is None
        assert groq_client.transcribe_with_groq_whisper(b"audio") is None


def test_engine_extract_fallback_when_groq_fails_or_unconfigured():
    # Verify deterministic rules continue working 100% when Groq is not configured
    text = "My husband has chest pain and sweating, severe 9/10, started 30 mins ago"
    e = engine.extract(text)
    assert "chest pain" in e["symptoms"]
    assert "sweating" in e["symptoms"]
    assert e["severity"] == 9
    assert e["chief_complaint"] == "chest pain"


def test_groq_extract_mock():
    # Simulate Groq Cloud LLM response
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = """{
        "symptoms": ["chest pain", "shortness of breath", "sweating"],
        "chief_complaint": "chest pain",
        "severity": 8,
        "age": 52,
        "progression": "worsening",
        "onset_text": "45 minutes ago",
        "aggravating": ["exertion"],
        "relieving": []
    }"""
    mock_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with patch.object(groq_client, "get_groq_client", return_value=mock_client):
        res = groq_client.extract_with_groq("52yo male with worsening chest pain 8/10 and dyspnea on exertion")
        assert res is not None
        assert "chest pain" in res["symptoms"]
        assert "shortness of breath" in res["symptoms"]
        assert res["severity"] == 8
        assert res["age"] == 52.0
        assert res["progression"] == "worsening"
        assert res["onset_text"] == "45 minutes ago"
