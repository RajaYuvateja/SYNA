import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from backend.speech_gateway.clients import SarvamClient, route_asr, synthesize_speech


def test_sarvam_client_configuration():
    with patch.dict("os.environ", {"SARVAM_API_KEY": "test_key_123"}):
        client = SarvamClient()
        assert client.is_configured is True
        assert client.headers["api-subscription-key"] == "test_key_123"

    with patch.dict("os.environ", {"SARVAM_API_KEY": ""}):
        client = SarvamClient()
        assert client.is_configured is False


def test_sarvam_asr_mock():
    async def run():
        client = SarvamClient()
        client.key = "mock_key"
        client.headers = {"api-subscription-key": "mock_key"}

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "transcript": "నా భర్తకు ఛాతీలో తీవ్రమైన నొప్పి ఉంది",
            "language_code": "te-IN",
            "language_probability": 0.94,
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await client.asr(b"fake_wav_bytes", lang="te", codemix=False)
            assert res["text"] == "నా భర్తకు ఛాతీలో తీవ్రమైన నొప్పి ఉంది"
            assert res["language"] == "te"
            assert res["confidence"] == 0.94
            assert res["provider"] == "sarvam"

    asyncio.run(run())


def test_sarvam_tts_mock():
    async def run():
        client = SarvamClient()
        client.key = "mock_key"
        client.headers = {"api-subscription-key": "mock_key"}

        import base64
        fake_audio = b"RIFF_FAKE_AUDIO_DATA"
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "audios": [base64.b64encode(fake_audio).decode()]
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            audio_bytes = await client.tts("దయచేసి కూర్చోండి", lang="te")
            assert audio_bytes == fake_audio

    asyncio.run(run())


def test_route_asr_with_sarvam():
    async def run():
        client = SarvamClient()
        client.key = "mock_key"
        client.headers = {"api-subscription-key": "mock_key"}

        with patch.object(client, "asr", new_callable=AsyncMock) as mock_asr:
            mock_asr.return_value = {
                "text": "Chest pain with sweating",
                "language": "en",
                "confidence": 0.92,
                "provider": "sarvam",
            }
            res = await route_asr(b"audio_bytes", "en", sv=client, codemixed=False)
            assert res["text"] == "Chest pain with sweating"
            assert res["provider"] == "sarvam"

    asyncio.run(run())


def test_synthesize_speech_with_sarvam():
    async def run():
        client = SarvamClient()
        client.key = "mock_key"
        client.headers = {"api-subscription-key": "mock_key"}

        with patch.object(client, "tts", new_callable=AsyncMock) as mock_tts:
            mock_tts.return_value = b"RIFF_WAV_BYTES"
            audio = await synthesize_speech("Hello", "en", sv=client)
            assert audio == b"RIFF_WAV_BYTES"

    asyncio.run(run())


def test_sarvam_translate_mock():
    async def run():
        client = SarvamClient()
        client.key = "mock_key"
        client.headers = {"api-subscription-key": "mock_key"}

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "translated_text": "I have severe chest pain",
            "source_language_code": "te-IN",
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await client.translate("నాకు ఛాతీలో తీవ్రమైన నొప్పి ఉంది", source_lang="te", target_lang="en-IN")
            assert "chest pain" in res.lower()

    asyncio.run(run())

