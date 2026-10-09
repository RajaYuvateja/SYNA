"""GroqCloud Integration for Clinical Triage.
Provides ultra-low-latency LLM entity extraction and Whisper audio transcription.
Model options: llama-3.3-70b-versatile, llama-3.1-8b-instant, whisper-large-v3.
"""
import json
import io
from typing import Any
from backend.app.config import settings

_groq_client = None


def get_groq_client():
    global _groq_client
    if not is_groq_configured():
        return None
    if _groq_client is None:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=settings.groq_api_key)
        except Exception:
            _groq_client = None
    return _groq_client


def is_groq_configured() -> bool:
    return bool(settings.groq_api_key and settings.groq_api_key.strip())


def extract_with_groq(text: str, prior: dict | None = None) -> dict | None:
    """Uses GroqCloud LLM with JSON mode to extract structured clinical entities.
    Returns None if Groq is not configured or on failure (falls back to deterministic rules).
    """
    client = get_groq_client()
    if not client:
        return None

    system_prompt = """You are a specialized clinical intake NLP parser assisting emergency triage nurses.
Extract clinical entities from the patient's statement.
Safety principle: Never diagnose or advise treatment. Only extract reported symptoms, severity, timing, and progression.

You must respond ONLY with valid JSON with the following exact keys:
{
  "symptoms": ["list", "of", "extracted", "symptoms"],
  "chief_complaint": "primary symptom or null",
  "severity": <integer 1 to 10 or null>,
  "age": <number in years or null>,
  "progression": "<getting worse | worsening | rapidly | suddenly | improving | null>",
  "onset_text": "<time string e.g. 30 mins ago, yesterday or null>",
  "aggravating": ["list", "of", "factors"],
  "relieving": ["list", "of", "factors"]
}
"""

    user_content = f"Patient/Reporter statement: {text}"
    if prior:
        user_content += f"\nPreviously extracted entities: {json.dumps(prior)}"

    try:
        response = client.chat.completions.create(
            model=settings.groq_model or "qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=500,
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        # Validate and merge with defaults
        base = prior or {
            "symptoms": [],
            "associated": [],
            "severity": None,
            "age": None,
            "progression": None,
            "onset_text": None,
            "chief_complaint": None,
            "aggravating": [],
            "relieving": [],
        }

        # Merge symptoms
        for s in data.get("symptoms", []):
            if s and s.lower() not in [x.lower() for x in base["symptoms"]]:
                base["symptoms"].append(s.lower())

        if data.get("chief_complaint") and not base.get("chief_complaint"):
            base["chief_complaint"] = data["chief_complaint"].lower()
        elif base["symptoms"] and not base.get("chief_complaint"):
            base["chief_complaint"] = base["symptoms"][0]

        if data.get("severity") is not None:
            try:
                base["severity"] = min(10, max(1, int(data["severity"])))
            except (ValueError, TypeError):
                pass

        if data.get("age") is not None:
            try:
                base["age"] = float(data["age"])
            except (ValueError, TypeError):
                pass

        if data.get("progression"):
            base["progression"] = str(data["progression"])

        if data.get("onset_text"):
            base["onset_text"] = str(data["onset_text"])

        for item in data.get("aggravating", []):
            clean_item = str(item).lower().strip()
            if clean_item in ("walking", "running", "stairs", "exercise", "physical activity", "movement", "moving"):
                clean_item = "exertion"
            if clean_item and clean_item not in base["aggravating"]:
                base["aggravating"].append(clean_item)

        for item in data.get("relieving", []):
            if item and item not in base["relieving"]:
                base["relieving"].append(item)

        return base
    except Exception as e:
        # Graceful fallback to deterministic extractor
        return None


def transcribe_with_groq_whisper(audio_bytes: bytes, filename: str = "audio.wav", language: str | None = None) -> dict | None:
    """Uses GroqCloud Whisper (whisper-large-v3) for ultra-fast audio transcription.
    Returns dict with text and language, or None if not configured.
    """
    client = get_groq_client()
    if not client:
        return None

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename

        kwargs: dict[str, Any] = {
            "file": audio_file,
            "model": "whisper-large-v3",
            "response_format": "verbose_json",
        }
        if language and language not in ("unknown", "en"):
            kwargs["language"] = language

        transcription = client.audio.transcriptions.create(**kwargs)
        return {
            "text": getattr(transcription, "text", str(transcription)),
            "language": getattr(transcription, "language", language or "en"),
            "confidence": 0.95,
            "provider": "groq_whisper",
        }
    except Exception:
        return None


def generate_followup_question(
    text: str,
    entities: dict,
    gaps: list[dict],
    language: str = "en",
    history: list[str] | None = None,
) -> str | None:
    """Uses Groq LLM to generate a single context-aware, clinically prioritized follow-up inquiry based on gaps and dialogue history."""
    client = get_groq_client()
    if not client or not gaps:
        return None

    system_prompt = """You are a compassionate clinical triage intake assistant.
Based on the patient's statement, conversation history, and missing protocol gaps, generate EXACTLY ONE clarifying question.
Do NOT repeat any questions that have already been answered in the conversation history.
Safety principle: Never diagnose, prescribe, or propose treatment. Only ask for missing symptom details.
Respond ONLY with the question itself in a concise, gentle tone."""

    history_ctx = "\n".join([f"- {h}" for h in history]) if history else f"- {text}"
    user_prompt = (
        f"Patient Conversation History:\n{history_ctx}\n"
        f"Latest Statement: {text}\n"
        f"Chief Complaint: {entities.get('chief_complaint')}\n"
        f"Missing Protocol Gaps: {[g.get('missing') for g in gaps]}\n"
        f"Target Language: {language}"
    )

    try:
        response = client.chat.completions.create(
            model=settings.groq_model or "qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=100,
        )
        return response.choices[0].message.content.strip().strip('"')
    except Exception:
        return None



def detect_semantic_contradictions(turns: list[str]) -> list[dict]:
    """Uses Groq LLM to detect semantic contradictions across multi-turn patient statements."""
    if len(turns) < 2:
        return []

    client = get_groq_client()
    if not client:
        return []

    system_prompt = """You are an expert clinical triage auditor. Analyze these chronological patient dialogue turns.
Detect if there are any SEMANTIC CONTRADICTIONS between what the patient stated in different turns (e.g., onset timing discrepancies, conflicting symptom locations, conflicting trauma mechanisms, or stark severity conflicts).

Respond ONLY with valid JSON in this exact shape:
{
  "contradictions": [
    {
      "field": "onset",
      "turn_a": 0,
      "turn_b": 1,
      "statement_a": "<excerpt from turn_a>",
      "statement_b": "<excerpt from turn_b>",
      "confidence": 0.85,
      "clarification": "<polite clarification question to resolve the conflict>"
    }
  ]
}
If there are no contradictions, return {"contradictions": []}.
"""

    turns_formatted = "\n".join([f"Turn {i}: {t}" for i, t in enumerate(turns)])
    try:
        response = client.chat.completions.create(
            model=settings.groq_model or "qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Dialogue turns:\n{turns_formatted}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=400,
        )
        data = json.loads(response.choices[0].message.content)
        return data.get("contradictions", [])
    except Exception:
        return []


def translate_with_groq(text: str, source_lang: str = "indic", target_lang: str = "en") -> str | None:
    """Uses GroqCloud LLM for high-accuracy translation of clinical patient dialogue."""
    client = get_groq_client()
    if not client or not text or not text.strip():
        return None

    src = (source_lang or "en").split("-")[0].lower()
    tgt = (target_lang or "en").split("-")[0].lower()

    LANG_NAMES = {
        "en": "English",
        "te": "Telugu",
        "hi": "Hindi",
        "ta": "Tamil",
        "kn": "Kannada",
        "ml": "Malayalam",
        "bn": "Bengali",
        "mr": "Marathi",
    }
    src_name = LANG_NAMES.get(src, source_lang)
    tgt_name = LANG_NAMES.get(tgt, target_lang)

    system_prompt = (
        f"You are an expert multilingual clinical triage translator. "
        f"Translate the clinical text accurately from {src_name} into {tgt_name}. "
        f"Preserve all symptoms, medical context, severity, and nuance faithfully. "
        f"Respond ONLY with the direct {tgt_name} translation without commentary, quotes, greetings, or explanations."
    )
    user_prompt = f"Text to translate ({src_name}): {text}"

    try:
        response = client.chat.completions.create(
            model=settings.groq_model or "qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=250,
        )
        translated = response.choices[0].message.content.strip().strip('"')
        return translated if translated else None
    except Exception:
        return None


