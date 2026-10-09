"""Provider clients for Speech-to-Text, Text-to-Speech, and Machine Translation.
Primary Indic Speech Provider: Sarvam AI.
Supports Groq Whisper for low-latency ASR and Google Cloud Translation.
Includes dev fallback modes when credentials are not supplied.
"""
import os
import base64
import time
import struct
import httpx


# A minimal 0.5s silent 16kHz mono WAV header + data for offline/dev TTS fallback
def _generate_silent_wav(duration_sec: float = 0.5, sample_rate: int = 16000) -> bytes:
    num_samples = int(duration_sec * sample_rate)
    data = b"\x00\x00" * num_samples
    data_size = len(data)
    # WAV Header
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,       # Subchunk1Size (16 for PCM)
        1,        # AudioFormat (1 for PCM)
        1,        # NumChannels (1 mono)
        sample_rate,
        sample_rate * 2,  # ByteRate
        2,        # BlockAlign
        16,       # BitsPerSample
        b"data",
        data_size,
    )
    return header + data


class SarvamClient:
    """Sarvam AI client for high-accuracy Indic Speech-to-Text, Code-mixed ASR, and Text-to-Speech."""
    BASE = "https://api.sarvam.ai"

    def __init__(self):
        self.key = os.getenv("SARVAM_API_KEY", "").strip()
        self.headers = {"api-subscription-key": self.key}

    @property
    def is_configured(self) -> bool:
        return bool(self.key)

    async def asr(self, audio: bytes, lang: str | None = None, codemix: bool = False) -> dict:
        if not self.is_configured:
            raise RuntimeError("SARVAM_API_KEY is not configured.")
        data = {
            "model": "saaras:v3" if codemix else "saarika:v2.5",
            "language_code": f"{lang}-IN" if lang and lang != "unknown" else "unknown",
        }
        ep = "/speech-to-text-translate" if codemix else "/speech-to-text"
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                self.BASE + ep,
                headers=self.headers,
                data=data,
                files={"file": ("input_audio.wav", audio, "audio/wav")},
            )
            r.raise_for_status()
            j = r.json()
        return {
            "text": j.get("transcript", ""),
            "language": (j.get("language_code") or "").split("-")[0] or lang or "en",
            "confidence": float(j.get("language_probability") or 0.88),
            "provider": "sarvam",
            "english": j.get("transcript") if codemix else None,
        }

    async def tts(self, text: str, lang: str) -> bytes:
        if not self.is_configured:
            raise RuntimeError("SARVAM_API_KEY is not configured.")
        lang_code = f"{lang}-IN" if "-" not in lang else lang
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                self.BASE + "/text-to-speech",
                headers=self.headers,
                json={"inputs": [text], "target_language_code": lang_code, "model": "bulbul:v3"},
            )
            r.raise_for_status()
        return base64.b64decode(r.json()["audios"][0])

    async def translate(self, text: str, source_lang: str, target_lang: str = "en-IN") -> str:
        """Translates Indic text using Sarvam AI Mayura Translation model (mayura:v1)."""
        if not self.is_configured:
            raise RuntimeError("SARVAM_API_KEY is not configured.")
        if not text or not text.strip():
            return ""

        # Normalize language codes (e.g. 'te' -> 'te-IN', 'en' -> 'en-IN')
        src_clean = source_lang.split("-")[0].lower() if source_lang else "te"
        tgt_clean = target_lang.split("-")[0].lower() if target_lang else "en"

        src_code = f"{src_clean}-IN" if src_clean not in ("en", "en-IN") else "en-IN"
        tgt_code = f"{tgt_clean}-IN" if tgt_clean not in ("en", "en-IN") else "en-IN"

        if src_code == tgt_code:
            return text

        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(
                self.BASE + "/translate",
                headers={**self.headers, "Content-Type": "application/json"},
                json={
                    "input": text.strip(),
                    "source_language_code": src_code,
                    "target_language_code": tgt_code,
                    "model": "mayura:v1",
                    "mode": "formal",
                },
            )
            r.raise_for_status()
            data = r.json()
            translated = (data.get("translated_text") or "").strip()

            # Align key clinical medical terms from the glossary if present
            if tgt_code == "en-IN" and translated:
                for indic_term, en_term in CLINICAL_MEDICAL_GLOSSARY.items():
                    if indic_term in text and en_term.lower() not in translated.lower():
                        translated += f" ({en_term})"

            return translated or text



# Multilingual Clinical Medical Glossary for accurate Indic term alignment
CLINICAL_MEDICAL_GLOSSARY = {
    # Telugu terms
    "ఛాతీలో నొప్పి": "chest pain",
    "గుండెపోటు": "heart attack",
    "శ్వాస కష్టం": "shortness of breath",
    "చెమటలు": "sweating",
    "స్పృహతప్పి": "unconscious",
    "రక్తస్రావం": "bleeding",
    "వాంతులు": "vomiting",
    "విరేచనాలు": "diarrhea",
    # Tamil terms
    "நெஞ்சு வலி": "chest pain",
    "மூச்சுத்திணறல்": "shortness of breath",
    "காய்ச்சல்": "fever",
    "மயக்கம்": "unconscious",
    "ரத்தப்போக்கு": "bleeding",
    # Hindi terms
    "सीने में दर्द": "chest pain",
    "सांस लेने में तकलीफ": "shortness of breath",
    "बेहोश": "unconscious",
    "खून बह रहा": "bleeding",
    "दिल का दौरा": "heart attack",
    # Kannada terms
    "ಎದೆ ನೋವು": "chest pain",
    "ಉಸಿರಾಟದ ತೊಂದರೆ": "shortness of breath",
    "ಜ್ವರ": "fever",
    "ಪ್ರಜ್ಞೆ ತಪ್ಪಿದೆ": "unconscious",
}


class GoogleTranslateClient:
    """Cloud Translation Advanced v3. Integrates medical glossary to keep clinical terms stable."""

    def __init__(self):
        from google.cloud import translate_v3 as t
        self.t = t
        self.c = t.TranslationServiceClient()
        self.project = os.getenv("GOOGLE_PROJECT_ID")
        self.glossary = os.getenv("GOOGLE_GLOSSARY_ID")

    def translate(self, text: str, target: str, source: str | None = None) -> str:
        parent = f"projects/{self.project}/locations/{'us-central1' if self.glossary else 'global'}"
        req = {
            "parent": parent,
            "contents": [text],
            "target_language_code": target,
            "mime_type": "text/plain",
        }
        if source:
            req["source_language_code"] = source
        if self.glossary:
            req["glossary_config"] = {"glossary": f"{parent}/glossaries/{self.glossary}"}
            return self.c.translate_text(request=req).glossary_translations[0].translated_text
        return self.c.translate_text(request=req).translations[0].translated_text

    def to_english(self, text: str, source: str | None = None) -> str:
        # Check against local clinical medical glossary for exact symptom stability
        translated = self.translate(text, "en", source)
        for indic_term, en_term in CLINICAL_MEDICAL_GLOSSARY.items():
            if indic_term in text and en_term.lower() not in translated.lower():
                translated += f" ({en_term})"
        return translated

    def from_english(self, text: str, target: str) -> str:
        return self.translate(text, target, "en")


async def route_asr(audio: bytes, lang: str, sv: SarvamClient, codemixed: bool = False) -> dict:
    """ASR Routing:
    1. If GroqCloud is configured, Groq Whisper-large-v3 provides high-speed transcription.
    2. Primary Indic Speech Gateway: Sarvam AI (Saarika for native Indic, Saaras for code-mixed).
    3. If no external keys are configured, returns a helpful mock transcript in dev mode.
    """
    # 1. Groq Whisper check
    try:
        from backend.app.groq_client import is_groq_configured, transcribe_with_groq_whisper
        if is_groq_configured():
            groq_trans = transcribe_with_groq_whisper(audio, language=lang if lang in ("en", "hi", "ta", "te", "bn", "mr") else None)
            if groq_trans and groq_trans.get("text"):
                return groq_trans
    except Exception:
        pass

    # 2. Main Indic Speech Provider: Sarvam AI
    if sv.is_configured:
        try:
            return await sv.asr(audio, lang, codemix=codemixed)
        except Exception as e:
            if not codemixed:
                # Retry with code-mix endpoint if normal fails
                try:
                    return await sv.asr(audio, lang, codemix=True)
                except Exception:
                    pass
            raise RuntimeError(f"Sarvam ASR error: {str(e)}")

    # 3. Dev Fallback Simulation when no keys are configured
    return {
        "text": f"Audio received ({len(audio)} bytes) - Dev Voice Simulation: patient reporting chest pain radiating to jaw with sweating, started 30 mins ago, 9/10",
        "language": lang or "en",
        "confidence": 0.88,
        "provider": "dev_simulation",
        "dev_notice": "SARVAM_API_KEY is not configured. Dev fallback simulation used.",
    }


async def synthesize_speech(text: str, lang: str, sv: SarvamClient) -> bytes:
    """Synthesizes speech using Sarvam AI Bulbul TTS. Falls back to silent audio in dev mode."""
    if sv.is_configured:
        try:
            return await sv.tts(text, lang)
        except Exception as e:
            print(f"[Warning] Sarvam TTS call failed: {e}")

    # Return minimal silent WAV for development/offline mode
    return _generate_silent_wav()
