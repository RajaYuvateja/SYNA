"""FastAPI Application for Clinical Voice Triage & Nurse Intake Handoff.
Orchestrates speech gateway, translation, clinical engine, and live nurse queue.
Safety Principle: The system NEVER diagnoses or recommends treatment.
It is an intake aid collecting symptoms, identifying protocol gaps, scoring priority,
and handing off to clinical nurses who make every final triage decision.
"""
import os
import sys
import base64
import uuid
import json
import asyncio
import pathlib
from typing import Literal

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from datetime import datetime, timezone

# Ensure project root and backend dir are in sys.path
APP_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

for p in (str(PROJECT_ROOT), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.app import engine
    from backend.app.config import settings
    from backend.speech_gateway.clients import (
        SarvamClient,
        GoogleTranslateClient,
        route_asr,
        synthesize_speech,
    )
    from backend.database import seed as sd
    from backend.database.db import (
        init_db,
        persist_session,
        persist_transcript,
        persist_message,
        get_session_messages,
        save_nurse_notes,
        persist_audit_log,
        record_intake_metric,
        load_all_persisted_sessions,
        get_analytics_summary,
        is_redis_active,
        _db_backend,
    )
except ImportError:
    import engine
    from config import settings
    from speech_gateway.clients import (
        SarvamClient,
        GoogleTranslateClient,
        route_asr,
        synthesize_speech,
    )
    from database import seed as sd
    from database.db import (
        init_db,
        persist_session,
        persist_transcript,
        persist_message,
        get_session_messages,
        save_nurse_notes,
        persist_audit_log,
        record_intake_metric,
        load_all_persisted_sessions,
        get_analytics_summary,
        is_redis_active,
        _db_backend,
    )

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description="Multilingual Clinical Voice Triage & Nurse Handoff Intake Aid (Never diagnoses).",
)

# Enable CORS for decoupled frontend development and external hospital clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory + Redis + Persistent session store
SESS: dict[str, dict] = {}
NURSES: set[WebSocket] = set()
_clients: dict = {}

# Initialize database and restore existing sessions on server startup
try:
    init_db()
    SESS.update(load_all_persisted_sessions())
except Exception as _e:
    print(f"[Startup] Persistence init warning: {_e}")


def clients():
    if not _clients:
        _clients["sv"] = SarvamClient()
        try:
            _clients["gt"] = GoogleTranslateClient()
        except Exception:
            _clients["gt"] = None  # dev passthrough if Google credentials not configured
    return _clients


# Pydantic Request Models
class NewSession(BaseModel):
    source: str = "patient"
    language: str = "en"
    channel: str = "kiosk"
    eta_minutes: int | None = None
    telemetry: dict | None = None


class Utterance(BaseModel):
    text: str | None = None
    english_text: str | None = None
    audio_b64: str | None = None
    language: str | None = None
    codemixed: bool = False
    asr_confidence: float = 0.9


class TranscribeTranslateRequest(BaseModel):
    audio_b64: str | None = None
    text: str | None = None
    language: str = "te"
    target_language: str = "en"
    codemixed: bool = False


class NurseNotes(BaseModel):
    nurse_id: str = "nurse-1"
    notes: str
    mark_reviewed: bool = True


class Confirm(BaseModel):
    text: str


class Override(BaseModel):
    nurse_id: str
    action: Literal["accept", "escalate", "downgrade", "override"]
    new_tier: str | None = None
    reason: str


class AmbulanceTelemetry(BaseModel):
    session_id: str | None = None
    chief_complaint: str = "In-transit medical emergency"
    eta_minutes: int = 10
    telemetry: dict = Field(default_factory=dict)
    paramedic_unit: str = "EMS-Unit-1"
    fast_code: str | None = None


class QuestionnaireAnswerRequest(BaseModel):
    question_id: str
    answer: str
    clarification: str | None = None


class ConfirmReportRequest(BaseModel):
    patient_name: str | None = None
    notes: str | None = None


class CorrectStatementRequest(BaseModel):
    corrected_text: str
    language: str | None = None


class UpdateLanguageRequest(BaseModel):
    language: str


def public(session_id: str, s: dict) -> dict:
    """Formats safe public session representation for the nurse dashboard and clients."""
    entities = s.get("entities") or {}
    risk_info = s.get("risk") or {}
    is_emerg = bool(risk_info.get("is_emergency")) or s.get("escalation_status") == "escalated"
    return {
        "id": session_id,
        "patient_name": s.get("patient_name") or entities.get("name"),
        "source": s.get("source", "patient"),
        "language": s.get("language", "en"),
        "channel": s.get("channel", "kiosk"),
        "status": s.get("status", "pending_review"),
        "final_tier": s.get("final_tier") or risk_info.get("tier"),
        "eta_minutes": s.get("eta_minutes"),
        "telemetry": s.get("telemetry"),
        "paramedic_unit": s.get("paramedic_unit"),
        "fast_code": s.get("fast_code"),
        "entities": entities,
        "gaps": s.get("gaps") or [],
        "contradictions": s.get("contradictions") or [],
        "timeline": s.get("timeline") or [],
        "red_flags": s.get("red_flags") or [],
        "risk": s.get("risk"),
        "next_question": s.get("next_question"),
        "next_question_en": s.get("next_question_en") or s.get("next_question"),
        "next_question_native": s.get("next_question_native"),
        "questionnaire": s.get("questionnaire") or [],
        "patient_answers": s.get("patient_answers") or {},
        "readback_en": s.get("readback_en"),
        "handoff": s.get("handoff"),
        "audit": s.get("audit") or [],
        "transcripts": s.get("transcripts") or [],
        "messages": s.get("messages") or [],
        "started_at": s.get("started_at"),
        "created_at": s.get("started_at") or s.get("created_at"),
        "submitted_at": s.get("submitted_at"),
        "reviewed_at": s.get("reviewed_at"),
        "confirmed_at": s.get("confirmed_at"),
        "last_activity_at": s.get("last_activity_at") or s.get("updated_at") or s.get("started_at"),
        "escalation_status": "escalated" if is_emerg else (s.get("escalation_status") or "none"),
        "nurse_notes": s.get("nurse_notes", ""),
        "summary": s.get("summary"),
        "emergency_guidance": s.get("emergency_guidance"),
        "confirmed": s.get("confirmed", False),
        "lifecycle_status": s.get("lifecycle_status") or ("archived" if s.get("status") in ("verified", "completed", "admitted", "discharged") else "active"),
        "archived_at": s.get("archived_at"),
        "verified_at": s.get("verified_at") or (s.get("reviewed_at") if s.get("status") == "verified" else None),
        "verified_by": s.get("verified_by") or (s.get("audit")[-1]["nurse_id"] if s.get("audit") and s.get("status") == "verified" else None),
    }


def get_session_or_404(session_id: str) -> dict:
    session = SESS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


async def push(session_id: str):
    """Pushes live session updates to all connected nurse WebSocket clients."""
    if session_id not in SESS:
        return
    msg = json.dumps({"type": "update", "session": public(session_id, SESS[session_id])})
    dead = set()
    for ws in list(NURSES):
        try:
            await asyncio.wait_for(ws.send_text(msg), timeout=0.5)
        except Exception:
            dead.add(ws)
    for ws in dead:
        NURSES.discard(ws)


async def push_reload():
    """Notifies all nurse dashboards to reload the complete queue."""
    msg = json.dumps({"type": "reload"})
    dead = set()
    for ws in list(NURSES):
        try:
            await asyncio.wait_for(ws.send_text(msg), timeout=0.5)
        except Exception:
            dead.add(ws)
    for ws in dead:
        NURSES.discard(ws)


# REST API Endpoints

@app.get("/api/health")
def health_check():
    c = clients()
    try:
        from backend.app.groq_client import is_groq_configured
        groq_active = is_groq_configured()
    except Exception:
        groq_active = False
    return {
        "status": "healthy",
        "service": settings.app_title,
        "version": settings.app_version,
        "active_sessions": len(SESS),
        "connected_nurses": len(NURSES),
        "storage": {
            "backend": _db_backend,
            "redis_live_sync": is_redis_active(),
            "restored_sessions": len(SESS),
        },
        "providers": {
            "groq": groq_active,
            "sarvam": c["sv"].is_configured,
            "google_translate": c["gt"] is not None,
        },
    }


@app.post("/api/sessions")
async def create_session(b: NewSession):
    session_id = str(uuid.uuid4())
    s = engine.new_session(source=b.source, language=b.language, channel=b.channel)
    s.update(eta_minutes=b.eta_minutes, telemetry=b.telemetry)
    SESS[session_id] = s
    persist_session(session_id, s)
    return {"id": session_id, "session": public(session_id, s)}


@app.post("/api/ambulance/telemetry")
async def stream_ambulance_telemetry(b: AmbulanceTelemetry):
    """Streams live paramedic telemetry, ETA, and broadcasts pre-arrival alerts to receiving hospitals."""
    sid = b.session_id or str(uuid.uuid4())
    s = SESS.get(sid) or engine.new_session(source="paramedic", channel="ambulance")
    s.update(
        eta_minutes=b.eta_minutes,
        telemetry=b.telemetry,
        paramedic_unit=b.paramedic_unit,
        fast_code=b.fast_code,
    )
    if not s.get("transcripts"):
        summary_text = f"Ambulance Pre-Arrival Alert [{b.paramedic_unit}]: {b.chief_complaint}. Code: {b.fast_code or 'Priority Emergency'}. Telemetry: SpO2 {b.telemetry.get('spo2', 'N/A')}%, HR {b.telemetry.get('hr', 'N/A')} bpm, BP {b.telemetry.get('bp', 'N/A')}."
        engine.process_turn(s, native=summary_text, english=summary_text, asr_conf=1.0)

    SESS[sid] = s
    persist_session(sid, s)

    # Broadcast pre-arrival alert to receiving nurse stations
    alert_msg = json.dumps({
        "type": "ambulance_alert",
        "session_id": sid,
        "eta_minutes": b.eta_minutes,
        "fast_code": b.fast_code,
        "paramedic_unit": b.paramedic_unit,
        "telemetry": b.telemetry,
        "session": public(sid, s),
    })
    for ws in list(NURSES):
        try:
            await ws.send_text(alert_msg)
        except Exception:
            NURSES.discard(ws)

    return {"status": "transmitted", "session_id": sid, "session": public(sid, s)}


async def translate_to_english(text: str, lang: str) -> str:
    """Translates Indic patient speech/text to English with a robust multi-tier pipeline:
    1. Primary: Sarvam AI Mayura Translation API (mayura:v1)
    2. Fallback: GroqCloud LLM Translation (Qwen 27B / GPT-OSS)
    3. Fallback: Google Cloud Translation Client (if configured)
    4. Fallback: Native text (if completely offline / dev fallback)
    """
    if not text or not text.strip():
        return ""
    clean_lang = (lang or "en").split("-")[0].lower()
    if clean_lang in ("en", "english"):
        return text.strip()

    c = clients()

    # 1. Primary Indic Gateway: Sarvam AI Mayura Translation
    if c.get("sv") and c["sv"].is_configured:
        try:
            translated = await c["sv"].translate(text, clean_lang, "en-IN")
            if translated and translated.strip() and translated.strip() != text.strip():
                return translated.strip()
        except Exception as e:
            print(f"[Translation] Sarvam translation error: {e}")

    # 2. Secondary Fallback: GroqCloud LLM Translation
    try:
        from backend.app.groq_client import translate_with_groq, is_groq_configured
        if is_groq_configured():
            groq_trans = translate_with_groq(text, source_lang=clean_lang)
            if groq_trans and groq_trans.strip() and groq_trans.strip() != text.strip():
                return groq_trans.strip()
    except Exception as e:
        print(f"[Translation] Groq translation error: {e}")

    # 3. Tertiary Fallback: Google Cloud Translation
    if c.get("gt"):
        try:
            return c["gt"].to_english(text, clean_lang)
        except Exception:
            pass

    return text.strip()


async def translate_from_english(text: str, target_lang: str) -> str:
    """Translates clinical English text/questions to the patient's native regional language (e.g. Hindi, Telugu, Tamil).
    1. Primary: Sarvam AI Mayura Translation API (mayura:v1)
    2. Fallback: GroqCloud LLM Translation (Qwen 27B / Llama 3)
    3. Fallback: Google Cloud Translation (if configured)
    4. Fallback: English text
    """
    if not text or not text.strip():
        return ""
    clean_target = (target_lang or "en").split("-")[0].lower()
    if clean_target in ("en", "english"):
        return text.strip()

    c = clients()

    # 1. Primary Indic Gateway: Sarvam AI Mayura Translation (en-IN -> target)
    if c.get("sv") and c["sv"].is_configured:
        try:
            translated = await c["sv"].translate(text, source_lang="en", target_lang=clean_target)
            if translated and translated.strip() and translated.strip() != text.strip():
                return translated.strip()
        except Exception as e:
            print(f"[Translation] Sarvam Mayura en->{clean_target} error: {e}")

    # 2. Secondary Fallback: GroqCloud LLM Translation
    try:
        from backend.app.groq_client import translate_with_groq, is_groq_configured
        if is_groq_configured():
            groq_trans = translate_with_groq(text, source_lang="en", target_lang=clean_target)
            if groq_trans and groq_trans.strip() and groq_trans.strip() != text.strip():
                return groq_trans.strip()
    except Exception as e:
        print(f"[Translation] Groq en->{clean_target} translation error: {e}")

    # 3. Tertiary Fallback: Google Cloud Translation Client
    if c.get("gt"):
        try:
            return c["gt"].from_english(text, clean_target)
        except Exception:
            pass

    return text.strip()


@app.post("/api/speech/transcribe-translate")
async def transcribe_and_translate(req: TranscribeTranslateRequest):
    """Real-time Speech Recognition and Translation preview endpoint (Features 1 & 2).
    Allows patient to see original recognized words + English translation in the composer
    BEFORE submitting the message.
    """
    native = req.text or ""
    conf = 0.95
    lang = req.language or "en"
    c = clients()

    if req.audio_b64:
        try:
            audio_bytes = base64.b64decode(req.audio_b64)
            r = await route_asr(audio_bytes, req.language, c["sv"], req.codemixed)
            native = r.get("text", "")
            conf = float(r.get("confidence", 0.88))
            if r.get("language"):
                lang = r["language"]
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"ASR Speech Recognition error: {str(e)}")

    if not native or not native.strip():
        return {
            "original_text": "",
            "english_text": "",
            "language": lang,
            "confidence": conf,
        }

    english = await translate_to_english(native, lang)

    return {
        "original_text": native,
        "english_text": english,
        "language": lang,
        "confidence": conf,
    }


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    s = get_session_or_404(session_id)
    return public(session_id, s)


@app.get("/api/sessions/{session_id}/messages")
def get_messages(session_id: str):
    s = get_session_or_404(session_id)
    db_msgs = get_session_messages(session_id)
    if db_msgs:
        return {"session_id": session_id, "messages": db_msgs}
    return {"session_id": session_id, "messages": s.get("messages", [])}


@app.post("/api/sessions/{session_id}/nurse-notes")
async def save_nurse_notes_endpoint(session_id: str, b: NurseNotes):
    s = get_session_or_404(session_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    s["nurse_notes"] = b.notes
    if b.mark_reviewed:
        s["reviewed_at"] = now_iso
    s["updated_at"] = now_iso
    save_nurse_notes(session_id, b.notes, b.nurse_id)
    s["summary"] = engine.generate_clinical_summary(s)
    persist_session(session_id, s)
    await push(session_id)
    return {
        "session_id": session_id,
        "nurse_notes": s["nurse_notes"],
        "reviewed_at": s.get("reviewed_at"),
        "status": s["status"],
        "summary": s["summary"],
    }


@app.post("/api/sessions/{session_id}/utterance")
async def process_utterance(session_id: str, u: Utterance):
    s = get_session_or_404(session_id)
    native, conf = u.text, u.asr_confidence
    if u.language and u.language.strip():
        s["language"] = u.language.strip().split("-")[0].lower()

    if u.audio_b64:
        c = clients()
        try:
            audio_bytes = base64.b64decode(u.audio_b64)
            r = await route_asr(audio_bytes, s["language"], c["sv"], u.codemixed)
            native = r.get("text", "")
            conf = float(r.get("confidence", 0.88))
            if r.get("language"):
                s["language"] = r["language"].split("-")[0].lower()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"ASR Speech Recognition error: {str(e)}")

    if not native or not native.strip():
        raise HTTPException(status_code=400, detail="Either 'text' or 'audio_b64' is required.")

    # If english_text was reviewed/edited by patient in composer preview, preserve it.
    # Otherwise, or if english_text was identical to the non-English native text, translate via Indic gateway.
    if u.english_text and u.english_text.strip() and (u.english_text.strip() != native.strip() or s.get("language") in ("en", "en-IN")):
        english = u.english_text.strip()
    else:
        english = await translate_to_english(native, s.get("language", "en"))

    sub_time = datetime.now(timezone.utc).isoformat()
    s["submitted_at"] = sub_time
    if not s.get("started_at"):
        s["started_at"] = sub_time

    # Persist patient message with authoritative backend timestamp
    patient_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    patient_msg = {
        "id": patient_msg_id,
        "session_id": session_id,
        "sender": "patient",
        "language": s.get("language", "en"),
        "original_text": native,
        "english_text": english,
        "created_at": sub_time,
        "submitted_at": sub_time,
        "status": "submitted",
    }
    s.setdefault("messages", []).append(patient_msg)
    persist_message(
        session_id=session_id,
        sender="patient",
        language=s.get("language", "en"),
        original_text=native,
        english_text=english,
        msg_id=patient_msg_id,
        created_at=sub_time,
        submitted_at=sub_time,
    )

    # Pipeline Stages 2-9 & 11
    engine.process_turn(s, native=native, english=english, asr_conf=conf)

    # Stage 4 translation & separation for follow-up question
    # Ensure next_question is strictly English, and next_question_native is in the patient's language
    next_q_en = s.get("next_question_en") or s.get("next_question")
    next_q_native = s.get("next_question_native")

    lang = s.get("language", "en")
    clean_lang = (lang or "en").split("-")[0].lower()

    if next_q_en:
        # If native question wasn't generated alongside, translate the English question to the native language
        if not next_q_native:
            if clean_lang == "en":
                next_q_native = next_q_en
            else:
                next_q_native = await translate_from_english(next_q_en, clean_lang)

        # Guard: Check if Indic characters leaked into next_q_en (Bug 1 & Bug 2 safety net)
        if any('\u0900' <= char <= '\u0d7f' for char in next_q_en):
            eng_trans = await translate_to_english(next_q_en, clean_lang)
            if eng_trans and not any('\u0900' <= char <= '\u0d7f' for char in eng_trans):
                if not next_q_native or next_q_native == next_q_en:
                    next_q_native = next_q_en
                next_q_en = eng_trans
            else:
                # Safe fallback if translation fails (never display Telugu as English, Requirement 8)
                next_q_en = "Clinical follow-up question pending translation"

        # Safety: Ensure next_q_native is non-empty
        if not next_q_native or not next_q_native.strip():
            next_q_native = next_q_en

        s["next_question"] = next_q_en
        s["next_question_en"] = next_q_en
        s["next_question_native"] = next_q_native
    else:
        next_q_en = None
        next_q_native = None
        s["next_question"] = None
        s["next_question_en"] = None
        s["next_question_native"] = None

    reply = {
        "id": session_id,
        "next_question": next_q_en,
        "next_question_en": next_q_en,
        "next_question_native": next_q_native,
        "questionnaire": s.get("questionnaire", []),
        "patient_answers": s.get("patient_answers", {}),
        "readback_en": s.get("readback_en"),
        "risk": s.get("risk"),
        "emergency": s.get("risk", {}).get("is_emergency", False) if s.get("risk") else False,
        "emergency_guidance": s.get("emergency_guidance"),
        "summary": s.get("summary"),
        "submitted_at": sub_time,
        "session": public(session_id, s),
    }

    # Stage 10 readback translation
    if s.get("readback_en"):
        reply["readback_native"] = await translate_from_english(s["readback_en"], s.get("language", "en"))
    else:
        reply["readback_native"] = None

    # Persist assistant follow-up question as a message
    if next_q_en:
        ai_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
        ai_native = next_q_native or next_q_en
        ai_msg = {
            "id": ai_msg_id,
            "session_id": session_id,
            "sender": "assistant",
            "language": s.get("language", "en"),
            "original_text": ai_native,
            "english_text": next_q_en,
            "created_at": sub_time,
            "submitted_at": sub_time,
            "status": "sent",
        }
        s.setdefault("messages", []).append(ai_msg)
        persist_message(
            session_id=session_id,
            sender="assistant",
            language=s.get("language", "en"),
            original_text=ai_native,
            english_text=next_q_en,
            msg_id=ai_msg_id,
            created_at=sub_time,
            submitted_at=sub_time,
        )

    # Persist session, transcript, and intake metrics
    persist_session(session_id, s)
    persist_transcript(session_id, len(s["transcripts"]) - 1, native, english, conf)
    record_intake_metric(session_id, len(s["transcripts"]), 0.5, "sarvam")

    reply["messages"] = s.get("messages", [])

    await push(session_id)
    return reply


@app.post("/api/sessions/{session_id}/tts")
async def text_to_speech(session_id: str, b: Confirm):
    s = get_session_or_404(session_id)
    c = clients()
    lang = s.get("language", "en")
    try:
        audio = await synthesize_speech(b.text, lang, c["sv"])
        return {"audio_b64": base64.b64encode(audio).decode(), "status": "success"}
    except Exception as e:
        return {"audio_b64": "", "status": "fallback", "error": str(e)}


INDIC_AFFIRMATIONS = {
    # English
    "yes", "yes that's correct", "correct", "that is correct", "yep", "yeah", "sure", "right", "exactly",
    # Hindi / Urdu
    "haan", "ha", "sahi", "sahi hai", "thik", "thik hai", "bilkul", "haanji", "haan ji", "ji haan",
    "हाँ", "सही", "सही है", "ठीक", "ठीक है", "बिल्कुल", "हाँजी", "जी हाँ",
    # Telugu
    "avunu", "alage", "nijame", "sari", "sarle", "correcte", "avunandi",
    "అవును", "సరి", "నిజమే", "కరెక్ట్", "కరెక్టే", "అలాగే", "అవునండి",
    # Tamil
    "aama", "aamam", "sari", "unmai", "appadithan", "aamanga", "seri",
    "சரி", "ஆமா", "ஆமாம்", "உண்மை", "அப்பத்தான்", "அப்படியேதான்", "ஆமாங்க",
    # Kannada
    "houdu", "sari", "karedide", "adhe", "houdhu",
    "ಹೌದು", "ಸರಿ", "ಖಂಡಿತ", "ಹೌದ್ರಿ",
    # Malayalam
    "athe", "shari", "athaanu", "sheri", "theerchayayum",
    "അതെ", "ശരി", "തീർച്ചയായും", "അതാണ്",
    # Bengali
    "hyan", "thik", "sothik", "ekdom", "haan",
    "হ্যাঁ", "ঠিক", "সঠিক", "একদম",
    # Marathi
    "ho", "hoy", "barobar", "kharay", "nakkich",
    "हो", "होय", "बरोबर", "खरं आहे", "नक्कीच",
    # Gujarati
    "haa", "barabar", "sachu", "saachu",
    "હા", "બરાબર", "સાચું",
    # Punjabi
    "haan", "sahi", "haan ji", "bilkul", "aaho",
    "ਹਾਂ", "ਸਹੀ", "ਹਾਂਜੀ", "ਆਹੋ",
    # Odia
    "han", "thik", "satare", "agya",
    "ହଁ", "ଠିକ", "ସତ", "ଆଜ୍ଞା",
}


@app.post("/api/sessions/{session_id}/confirm")
async def confirm_intake(session_id: str, b: Confirm):
    s = get_session_or_404(session_id)
    user_input = b.text.lower().strip()
    is_confirmed = (
        user_input in INDIC_AFFIRMATIONS
        or any(user_input.startswith(aff + " ") or user_input == aff for aff in INDIC_AFFIRMATIONS)
    )

    if not is_confirmed:
        # Treat as correction utterance
        return await process_utterance(session_id, Utterance(text=b.text))

    s["confirmed"] = True
    now_iso = datetime.now(timezone.utc).isoformat()
    s["confirmed_at"] = now_iso
    persist_session(session_id, s)
    await push(session_id)
    return {"confirmed": True, "status": "intake_complete"}


@app.post("/api/sessions/{session_id}/questionnaire-answer")
async def answer_questionnaire(session_id: str, b: QuestionnaireAnswerRequest):
    """Saves answer to a symptom question.
    Immediately tests for red-flag warning signs and triggers emergency escalation workflow
    without waiting for full questionnaire completion.
    """
    s = get_session_or_404(session_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    
    s.setdefault("patient_answers", {})[b.question_id] = b.answer
    if b.clarification:
        s.setdefault("patient_answer_clarifications", {})[b.question_id] = b.clarification

    # Re-evaluate questionnaire answers
    q_list = s.get("questionnaire") or []
    eval_res = engine.evaluate_questionnaire_answers(q_list, s["patient_answers"])
    s["questionnaire"] = eval_res["questions"]

    # CRITICAL RED FLAG HANDLING: Check if answer triggers an immediate emergency
    new_red_flags = eval_res.get("red_flags", [])
    existing_flags = s.setdefault("red_flags", [])
    emergency_escalated = False
    for rf in new_red_flags:
        if rf not in existing_flags:
            existing_flags.append(rf)
            emergency_escalated = True

    # Re-evaluate clinical risk score and emergency guidance
    min_asr = min((t.get("asr_confidence") or 0.9) for t in s.get("transcripts", [])) if s.get("transcripts") else 0.9
    s["risk"] = engine.risk(s["entities"], s["red_flags"], s.get("source", "patient"), min_asr)
    s["emergency_guidance"] = engine.check_emergency_guidance(s["red_flags"], s["entities"])

    if s["risk"].get("is_emergency") or emergency_escalated:
        s["escalation_status"] = "escalated"
        s["final_tier"] = "critical"

    s["summary"] = engine.generate_clinical_summary(s)
    s["last_activity_at"] = now_iso
    s["updated_at"] = now_iso

    persist_session(session_id, s)
    await push(session_id)

    return {
        "session_id": session_id,
        "questionnaire": s["questionnaire"],
        "patient_answers": s["patient_answers"],
        "is_emergency": bool(s["risk"].get("is_emergency")),
        "escalation_status": s.get("escalation_status"),
        "red_flags": s.get("red_flags"),
        "session": public(session_id, s),
    }


@app.post("/api/sessions/{session_id}/confirm-report")
async def confirm_report_endpoint(session_id: str, b: ConfirmReportRequest = ConfirmReportRequest()):
    """Saves patient report verification and locks verified clinical statements."""
    s = get_session_or_404(session_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    s["confirmed"] = True
    s["confirmed_at"] = now_iso
    s["submitted_at"] = s.get("submitted_at") or now_iso
    if b.patient_name:
        s["patient_name"] = b.patient_name
        s.setdefault("entities", {})["name"] = b.patient_name
    s["last_activity_at"] = now_iso
    s["updated_at"] = now_iso

    persist_session(session_id, s)
    await push(session_id)
    return {
        "status": "confirmed",
        "session_id": session_id,
        "confirmed_at": now_iso,
        "session": public(session_id, s),
    }


@app.post("/api/sessions/{session_id}/correct-statement")
async def correct_statement_endpoint(session_id: str, b: CorrectStatementRequest):
    """Allows patient to correct statement or transcription before final report confirmation."""
    s = get_session_or_404(session_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    lang = b.language or s.get("language", "en")
    s["language"] = lang

    english = await translate_to_english(b.corrected_text, lang)

    # Maintain correction history
    s.setdefault("transcripts", []).append({
        "native": b.corrected_text,
        "english": english,
        "asr_confidence": 1.0,
        "is_correction": True,
        "corrected_at": now_iso,
    })

    corr_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    corr_msg = {
        "id": corr_msg_id,
        "session_id": session_id,
        "sender": "patient",
        "language": lang,
        "original_text": b.corrected_text,
        "english_text": english,
        "created_at": now_iso,
        "submitted_at": now_iso,
        "status": "corrected",
    }
    s.setdefault("messages", []).append(corr_msg)
    persist_message(
        session_id=session_id,
        sender="patient",
        language=lang,
        original_text=b.corrected_text,
        english_text=english,
        msg_id=corr_msg_id,
        created_at=now_iso,
        submitted_at=now_iso,
        status="corrected",
    )

    # Reprocess clinical turn and refresh adaptive questions
    engine.process_turn(s, native=b.corrected_text, english=english, asr_conf=1.0)
    s["last_activity_at"] = now_iso
    s["updated_at"] = now_iso

    persist_session(session_id, s)
    await push(session_id)
    return {
        "status": "statement_corrected",
        "original_text": b.corrected_text,
        "english_text": english,
        "session": public(session_id, s),
    }


@app.get("/api/sessions/{session_id}/sbar")
def get_session_sbar(session_id: str):
    """Generates structured SBAR handover record for attending nurse and physician review."""
    s = get_session_or_404(session_id)
    e = s.get("entities") or {}
    r = s.get("risk") or {}
    tier = (s.get("final_tier") or r.get("tier") or "STABLE").upper()
    score = r.get("score", 0)
    conf = f"{round(r.get('confidence', 0.9) * 100)}%" if r.get("confidence") else "N/A"
    reasoning = r.get("reasoning", "Pending nurse review")

    audit_lines = "\n".join(f"[{a.get('at')}] {a.get('nurse_id')} performed {a.get('action', '').upper()}: {a.get('reason')}" for a in s.get("audit", [])) or "No nurse audit actions recorded yet."

    sbar_text = f"""CLINICAL SBAR INTAKE HANDOFF RECORD
=========================================
PATIENT IDENTIFIER: {session_id}
INTAKE SOURCE:      {s.get('source', 'patient')} ({s.get('channel', 'kiosk')})
LANGUAGE:           {s.get('language', 'en').upper()}
PROVISIONAL TIER:   {tier} (Score: {score})

[S - Situation]
Chief Complaint:    {e.get('chief_complaint', 'Unspecified chief complaint')}
Current Severity:   {e.get('severity', 'Not reported')}
Age:                {e.get('age', 'Unknown')}
Onset / Duration:   {e.get('onset_text', 'Not specified')}

[B - Background]
Reported Symptoms:  {', '.join(e.get('symptoms', [])) or 'None'}
Progression:        {e.get('progression', 'Not specified')}
Red Flags Noted:    {'; '.join(s.get('red_flags', [])) or 'None'}

[A - Assessment]
AI Triage Tier:     {tier}
Confidence Score:   {conf}
Clinical Reasoning: {reasoning}

[R - Recommendation]
Required Action:    Bedside nursing triage evaluation and vital signs verification.
Assigned Priority:  {tier}

AUDIT TRAIL:
{audit_lines}

DISCLAIMER: Clinical intake aid only. Never diagnoses or prescribes. Final decision made by attending nursing staff.
========================================="""
    return {"session_id": session_id, "sbar": sbar_text, "session": public(session_id, s)}


@app.post("/api/sessions/{session_id}/language")
async def update_session_language(session_id: str, req: UpdateLanguageRequest):
    """Dynamically updates the active patient session language and refreshes
    all questionnaire questions and assistant follow-ups into the selected regional tongue.
    """
    s = get_session_or_404(session_id)
    new_lang = req.language.split("-")[0].lower() if req.language else "en"
    s["language"] = new_lang

    # 1. Synchronize questionnaire native texts
    if s.get("questionnaire"):
        cat = s.get("entities", {}).get("chief_complaint") or "general"
        fresh_questions = engine.generate_symptom_questionnaire(
            chief_complaint=cat,
            entities=s.get("entities", {}),
            language=new_lang,
        )
        existing_answers = s.get("patient_answers") or {}
        eval_res = engine.evaluate_questionnaire_answers(fresh_questions, existing_answers)
        s["questionnaire"] = eval_res["questions"]

    # 2. Re-translate next follow-up question and readback if pending
    if s.get("next_question"):
        s["next_question_native"] = await translate_from_english(s["next_question"], new_lang)
    if s.get("readback_en"):
        s["readback_native"] = await translate_from_english(s["readback_en"], new_lang)

    now_iso = datetime.now(timezone.utc).isoformat()
    s["last_activity_at"] = now_iso
    s["updated_at"] = now_iso

    persist_session(session_id, s)
    persist_audit_log(session_id, "patient", "language_change", s.get("final_tier") or "N/A", s.get("final_tier") or "N/A", f"Changed language to {new_lang}")
    await push(session_id)

    return {
        "status": "success",
        "language": new_lang,
        "questionnaire": s.get("questionnaire", []),
        "next_question_native": s.get("next_question_native"),
        "readback_native": s.get("readback_native"),
        "session": public(session_id, s),
    }


def classify_case(s: dict) -> dict[str, bool]:
    """Determines case lifecycle and workflow category membership.
    Case lifecycle and clinical severity are maintained as separate concepts:
    - Lifecycle: is_active vs is_archived
    - Severity: critical, urgent, concerning, stable (calculated for active cases only)
    """
    lifecycle = (s.get("lifecycle_status") or "").lower()
    status = (s.get("status") or "pending_review").lower()

    # Archived condition: explicitly marked archived or status is verified/completed
    is_archived = (lifecycle == "archived") or (status in ("verified", "completed", "admitted", "discharged"))
    is_active = not is_archived

    risk = s.get("risk") or {}
    tier = (risk.get("tier") or s.get("final_tier") or "").lower()
    is_emergency = bool(risk.get("is_emergency")) or s.get("escalation_status") == "escalated"

    # Active clinical severity categories: strictly excluded if archived!
    is_critical = is_active and (tier == "critical" or is_emergency)
    is_urgent = is_active and (tier == "urgent" and not is_emergency)
    is_concerning = is_active and (tier == "concerning" and not is_emergency)
    is_stable = is_active and (tier == "stable" and not is_emergency)

    # Active workflow statuses
    is_pending = is_active
    q_list = s.get("questionnaire") or []
    has_unanswered = any(not q.get("is_answered") for q in q_list) if q_list else False
    has_flags_or_gaps = bool(s.get("gaps")) or bool(s.get("contradictions"))
    is_review_required = is_active and (is_pending or has_unanswered or has_flags_or_gaps or not s.get("reviewed_at"))

    return {
        "all": is_active,              # Default active queue contains only active cases
        "active": is_active,           # Explicit active
        "pending": is_pending,
        "critical": is_critical,
        "urgent": is_urgent,
        "concerning": is_concerning,
        "stable": is_stable,
        "review_required": is_review_required,
        "completed": is_archived,      # Archived cases in History
        "archived": is_archived,
        "history": is_archived,
        "is_active": is_active,
        "is_archived": is_archived,
    }


@app.get("/api/queue")
def get_queue(
    filter: str | None = Query(None, description="Filter by: 'all', 'active', 'pending', 'critical', 'urgent', 'concerning', 'stable', 'review_required', 'completed', 'history', 'archived'"),
    sort_by: str = Query("newest", description="Sort by: 'newest', 'oldest', 'severity'"),
    status: str | None = Query(None, description="Legacy status compatibility"),
):
    """Returns triage cases filtered by category and ordered by encounter or verification timestamp."""
    if status and not filter:
        if status in ("verified", "completed", "archived"):
            active_filter = "history"
        elif status == "pending_review":
            active_filter = "pending"
        else:
            active_filter = "active"
    elif filter:
        active_filter = filter.lower().strip()
    else:
        active_filter = "active"

    tier_order = {"critical": 0, "urgent": 1, "concerning": 2, "stable": 3}
    rows = []

    for sid, s in SESS.items():
        if not s.get("risk") and not s.get("transcripts") and not s.get("messages"):
            continue

        membership = classify_case(s)
        if active_filter in ("history", "archived", "completed"):
            if membership.get("is_archived"):
                rows.append(public(sid, s))
        elif active_filter in ("all", "active"):
            if membership.get("is_active"):
                rows.append(public(sid, s))
        else:
            if membership.get(active_filter, False):
                rows.append(public(sid, s))

    if sort_by == "severity":
        return sorted(
            rows,
            key=lambda r: (
                tier_order.get((r.get("risk") or {}).get("tier", "stable").lower(), 99),
                -(r.get("risk") or {}).get("score", 0),
                r.get("created_at") or r.get("started_at") or "",
            ),
        )
    elif sort_by == "oldest":
        return sorted(
            rows,
            key=lambda r: (
                r.get("submitted_at") or r.get("confirmed_at") or r.get("started_at") or r.get("created_at") or "",
                r.get("id", ""),
            ),
        )
    else:
        # Default: newest cases first
        if active_filter in ("history", "archived", "completed"):
            return sorted(
                rows,
                key=lambda r: (
                    r.get("verified_at") or r.get("archived_at") or r.get("reviewed_at") or r.get("submitted_at") or r.get("created_at") or "",
                    r.get("id", ""),
                ),
                reverse=True,
            )
        return sorted(
            rows,
            key=lambda r: (
                r.get("submitted_at") or r.get("confirmed_at") or r.get("started_at") or r.get("created_at") or "",
                r.get("id", ""),
            ),
            reverse=True,
        )


@app.get("/api/queue/counts")
def get_queue_counts():
    """Returns dynamic counts for active dashboard and history views derived strictly from active cases."""
    counts = {
        "all": 0,
        "active": 0,
        "pending": 0,
        "critical": 0,
        "urgent": 0,
        "concerning": 0,
        "stable": 0,
        "review_required": 0,
        "completed": 0,
        "archived": 0,
        "history": 0,
    }
    for sid, s in SESS.items():
        if not s.get("risk") and not s.get("transcripts") and not s.get("messages"):
            continue
        c = classify_case(s)
        if c.get("is_active"):
            counts["all"] += 1
            counts["active"] += 1
            if c.get("critical"):
                counts["critical"] += 1
            if c.get("urgent"):
                counts["urgent"] += 1
            if c.get("concerning"):
                counts["concerning"] += 1
            if c.get("stable"):
                counts["stable"] += 1
            if c.get("pending"):
                counts["pending"] += 1
            if c.get("review_required"):
                counts["review_required"] += 1
        elif c.get("is_archived"):
            counts["completed"] += 1
            counts["archived"] += 1
            counts["history"] += 1
    return counts


@app.post("/api/sessions/{session_id}/review")
async def review_session(session_id: str, b: Override):
    s = get_session_or_404(session_id)
    old_tier = s.get("risk", {}).get("tier", "unknown") if s.get("risk") else "unknown"

    # Idempotency / Duplicate request handling (Requirement 6 & Test F):
    if s.get("lifecycle_status") == "archived" and s.get("status") == "verified":
        return public(session_id, s)

    # Save snapshot before modifying in case persistence fails
    snapshot_lifecycle = s.get("lifecycle_status", "active")
    snapshot_status = s.get("status", "pending_review")
    snapshot_tier = s.get("final_tier")

    try:
        engine.apply_override(
            sess=s,
            nurse_id=b.nurse_id,
            action=b.action,
            new_tier=b.new_tier,
            reason=b.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Safe persistence handling (Requirement 6 & Test G)
    try:
        persist_audit_log(session_id, b.nurse_id, b.action, old_tier, s.get("final_tier", ""), b.reason)
        persist_session(session_id, s)
    except Exception as db_err:
        # Revert in-memory modification on persistence failure so case remains active and safe
        s["lifecycle_status"] = snapshot_lifecycle
        s["status"] = snapshot_status
        s["final_tier"] = snapshot_tier
        if s.get("audit") and s["audit"][-1].get("nurse_id") == b.nurse_id:
            s["audit"].pop()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to persist clinical verification to database: {str(db_err)}. Patient case remains in active workflow.",
        )

    await push(session_id)
    await push_reload()
    return public(session_id, s)


@app.get("/api/analytics")
def get_analytics():
    """Returns clinical triage operations metrics: average seconds to tier, nurse override rates, tier distributions, and ASR provider metrics."""
    return get_analytics_summary()


@app.websocket("/ws/nurse")
async def nurse_websocket(ws: WebSocket):
    await ws.accept()
    NURSES.add(ws)
    try:
        while True:
            # Keepalive / ping reception
            await ws.receive_text()
    except WebSocketDisconnect:
        NURSES.discard(ws)


@app.post("/api/dev/seed")
async def seed_cases():
    """Seeds the 4 multilingual clinical cases (Telugu, Tamil, Hindi, Kannada) into live memory."""
    seeded_count = 0
    for name, s in sd.run():
        new_id = str(uuid.uuid4())
        SESS[new_id] = s
        seeded_count += 1
    await push_reload()
    return {"seeded": seeded_count, "total_active": len(SESS)}


@app.post("/api/dev/reset")
async def reset_sessions():
    """Resets all in-memory sessions for clean testing."""
    SESS.clear()
    await push_reload()
    return {"message": "All sessions reset."}


@app.post("/api/dev/seed-cohort")
async def seed_cohort(count: int = 62):
    """Deterministically populates a full cohort of active cases (default 62 cases)
    across severity tiers (12 critical, 20 urgent, 15 concerning, 15 stable) for
    acceptance testing and audit verification.
    """
    tiers_dist = ["critical"] * 12 + ["urgent"] * 20 + ["concerning"] * 15 + ["stable"] * 15
    if count != 62:
        tiers_dist = (["critical"] * (count // 4) +
                      ["urgent"] * (count // 4) +
                      ["concerning"] * (count // 4) +
                      ["stable"] * (count - 3 * (count // 4)))
    
    session_ids = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for i, tier in enumerate(tiers_dist):
        sid = f"cohort_case_{i+1:03d}_{uuid.uuid4().hex[:6]}"
        session_ids.append(sid)
        score = 80 if tier == "critical" else (60 if tier == "urgent" else (35 if tier == "concerning" else 15))
        s = engine.new_session(source="patient", language="en")
        s["id"] = sid
        s["patient_name"] = f"Cohort Patient #{i+1:02d}"
        s["entities"] = {
            "chief_complaint": f"Clinical cohort evaluation #{i+1}",
            "severity": 8 if tier == "critical" else (6 if tier == "urgent" else 3),
            "age": 30 + (i % 45),
            "symptoms": ["chest discomfort", "shortness of breath"] if tier == "critical" else ["abdominal cramps"],
        }
        s["risk"] = {
            "tier": tier,
            "score": score,
            "is_emergency": (tier == "critical"),
            "confidence": 0.94,
            "reasoning": f"Cohort initial triage criteria satisfied for tier: {tier.upper()}",
            "disclaimer": "Triage aid only.",
        }
        s["final_tier"] = tier
        s["status"] = "pending_review"
        s["lifecycle_status"] = "active"
        s["submitted_at"] = now_iso
        s["transcripts"] = [{
            "native": f"Patient presenting with complaint #{i+1} tier {tier}",
            "english": f"Patient presenting with complaint #{i+1} tier {tier}",
            "asr_confidence": 0.95,
            "timestamp": now_iso,
        }]
        s["summary"] = engine.generate_clinical_summary(s)
        SESS[sid] = s
        persist_session(sid, s)

    await push_reload()
    return {"seeded": len(session_ids), "session_ids": session_ids, "active": len(SESS)}


# Mount Frontend Static Files cleanly
frontend_path = settings.frontend_dir
if frontend_path.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
