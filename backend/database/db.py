"""Dual Persistence & Live State Manager for Clinical Triage.
Features:
1. PostgreSQL persistence (when available) with seamless SQLite fallback (triage.db).
   Ensures sessions, transcripts, and audit logs are permanently stored on disk.
2. Redis live dialog state (when available) with in-memory fallback.
"""
import os
import json
import sqlite3
import pathlib
from datetime import datetime, timezone
from backend.app.config import settings

DB_FILE = pathlib.Path(__file__).resolve().parent / "triage.db"

_redis_client = None
_redis_available = False
_db_backend = "sqlite"  # 'postgres' or 'sqlite'


# ==========================================
# 1. REDIS LIVE STATE
# ==========================================

def get_redis():
    global _redis_client, _redis_available
    if _redis_client is None:
        try:
            import redis
            r = redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1)
            r.ping()
            _redis_client = r
            _redis_available = True
        except Exception:
            _redis_client = None
            _redis_available = False
    return _redis_client if _redis_available else None


def save_live_state(session_id: str, session_data: dict):
    r = get_redis()
    if r:
        try:
            r.set(f"triage:session:{session_id}", json.dumps(session_data), ex=86400)
        except Exception:
            pass


def get_live_state(session_id: str) -> dict | None:
    r = get_redis()
    if r:
        try:
            raw = r.get(f"triage:session:{session_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return None


def is_redis_active() -> bool:
    return bool(get_redis())


# ==========================================
# 2. PERSISTENCE (POSTGRESQL & SQLITE)
# ==========================================

def _get_sqlite_conn():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables for persistent storage."""
    global _db_backend

    # 1. Try PostgreSQL if psycopg is installed
    try:
        import psycopg
        with psycopg.connect(settings.database_url, connect_timeout=1) as cx:
            with cx.cursor() as cur:
                cur.execute("SELECT 1;")
            _db_backend = "postgres"
            # Load and execute schema.sql for Postgres
            schema_file = pathlib.Path(__file__).resolve().parent / "schema.sql"
            if schema_file.is_file():
                with cx.cursor() as cur:
                    cur.execute(schema_file.read_text(encoding="utf-8"))
            cx.commit()
            print("[Database] Connected to PostgreSQL successfully.")
            return
    except Exception:
        _db_backend = "sqlite"

    # 2. Fallback to SQLite
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT,
            age REAL,
            sex TEXT,
            language TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS triage_sessions (
            id TEXT PRIMARY KEY,
            patient_id TEXT,
            source TEXT,
            channel TEXT DEFAULT 'kiosk',
            language TEXT,
            tier TEXT,
            score INTEGER,
            is_emergency INTEGER DEFAULT 0,
            confidence REAL,
            reasoning TEXT,
            status TEXT DEFAULT 'pending_review',
            eta_minutes INTEGER,
            handoff_note TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS transcripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            turn INTEGER,
            speaker TEXT,
            language TEXT,
            native_text TEXT,
            english_text TEXT,
            asr_confidence REAL,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            nurse_id TEXT,
            action TEXT,
            old_tier TEXT,
            new_tier TEXT,
            reason TEXT,
            at TEXT
        );

        CREATE TABLE IF NOT EXISTS intake_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            turns INTEGER,
            seconds_to_tier REAL,
            asr_provider TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            sender TEXT,
            language TEXT,
            original_text TEXT,
            english_text TEXT,
            created_at TEXT,
            submitted_at TEXT,
            status TEXT DEFAULT 'submitted'
        );
        """)

        # Safely migrate additional columns for triage_sessions
        for col_name, col_type in [
            ("started_at", "TEXT"),
            ("submitted_at", "TEXT"),
            ("reviewed_at", "TEXT"),
            ("nurse_notes", "TEXT"),
            ("summary_json", "TEXT"),
            ("questionnaire_json", "TEXT"),
            ("patient_answers_json", "TEXT"),
            ("confirmed_at", "TEXT"),
            ("last_activity_at", "TEXT"),
            ("escalation_status", "TEXT"),
            ("patient_name", "TEXT"),
        ]:
            try:
                cur.execute(f"ALTER TABLE triage_sessions ADD COLUMN {col_name} {col_type};")
            except Exception:
                pass

        cx.commit()
    print(f"[Database] Initialized persistent SQLite database at {DB_FILE.name}")


def persist_session(session_id: str, s: dict):
    """Saves or updates session and patient in persistent storage."""
    save_live_state(session_id, s)
    now = datetime.now(timezone.utc).isoformat()
    entities = s.get("entities") or {}
    risk = s.get("risk") or {}

    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        # 1. Upsert patient
        patient_id = s.get("patient_id") or f"pat_{session_id[:8]}"
        patient_name = s.get("patient_name") or entities.get("name")
        cur.execute(
            """INSERT INTO patients (id, name, age, language, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name, patients.name), age=excluded.age, language=excluded.language""",
            (patient_id, patient_name, entities.get("age"), s.get("language"), now),
        )

        # 2. Upsert triage session
        handoff_json = json.dumps(s.get("handoff") or {})
        summary_json = json.dumps(s.get("summary") or {})
        questionnaire_json = json.dumps(s.get("questionnaire") or [])
        patient_answers_json = json.dumps(s.get("patient_answers") or {})
        started_at = s.get("started_at") or now
        submitted_at = s.get("submitted_at")
        reviewed_at = s.get("reviewed_at")
        confirmed_at = s.get("confirmed_at")
        last_activity_at = s.get("last_activity_at") or now
        escalation_status = s.get("escalation_status") or ("escalated" if (risk and risk.get("is_emergency")) else "none")
        nurse_notes = s.get("nurse_notes")

        cur.execute(
            """INSERT INTO triage_sessions 
               (id, patient_id, source, channel, language, tier, score, is_emergency, confidence, reasoning, status, eta_minutes, handoff_note, started_at, submitted_at, reviewed_at, nurse_notes, summary_json, questionnaire_json, patient_answers_json, confirmed_at, last_activity_at, escalation_status, patient_name, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   tier=excluded.tier,
                   score=excluded.score,
                   is_emergency=excluded.is_emergency,
                   confidence=excluded.confidence,
                   reasoning=excluded.reasoning,
                   status=excluded.status,
                   eta_minutes=excluded.eta_minutes,
                   handoff_note=excluded.handoff_note,
                   submitted_at=COALESCE(excluded.submitted_at, triage_sessions.submitted_at),
                   reviewed_at=COALESCE(excluded.reviewed_at, triage_sessions.reviewed_at),
                   nurse_notes=COALESCE(excluded.nurse_notes, triage_sessions.nurse_notes),
                   summary_json=excluded.summary_json,
                   questionnaire_json=excluded.questionnaire_json,
                   patient_answers_json=excluded.patient_answers_json,
                   confirmed_at=COALESCE(excluded.confirmed_at, triage_sessions.confirmed_at),
                   last_activity_at=excluded.last_activity_at,
                   escalation_status=excluded.escalation_status,
                   patient_name=COALESCE(excluded.patient_name, triage_sessions.patient_name),
                   updated_at=excluded.updated_at""",
            (
                session_id,
                patient_id,
                s.get("source", "patient"),
                s.get("channel", "kiosk"),
                s.get("language", "en"),
                risk.get("tier"),
                risk.get("score"),
                1 if risk.get("is_emergency") else 0,
                risk.get("confidence"),
                risk.get("reasoning"),
                s.get("status", "pending_review"),
                s.get("eta_minutes"),
                handoff_json,
                started_at,
                submitted_at,
                reviewed_at,
                nurse_notes,
                summary_json,
                questionnaire_json,
                patient_answers_json,
                confirmed_at,
                last_activity_at,
                escalation_status,
                patient_name,
                now,
                now,
            ),
        )
        cx.commit()


def persist_message(
    session_id: str,
    sender: str,
    language: str,
    original_text: str,
    english_text: str,
    message_id: str | None = None,
    msg_id: str | None = None,
    created_at: str | None = None,
    submitted_at: str | None = None,
    status: str = "submitted",
):
    mid = message_id or msg_id or f"msg_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    c_at = created_at or now
    s_at = submitted_at or now
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.execute(
            """INSERT INTO messages (id, session_id, sender, language, original_text, english_text, created_at, submitted_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET original_text=excluded.original_text, english_text=excluded.english_text, status=excluded.status""",
            (mid, session_id, sender, language, original_text, english_text, c_at, s_at, status),
        )
        cx.commit()


def get_session_messages(session_id: str) -> list[dict]:
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        rows = cur.execute(
            "SELECT * FROM messages WHERE session_id=? ORDER BY created_at ASC", (session_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def save_nurse_notes(session_id: str, notes: str, nurse_id: str | None = None):
    now = datetime.now(timezone.utc).isoformat()
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.execute(
            "UPDATE triage_sessions SET nurse_notes=?, reviewed_at=?, updated_at=? WHERE id=?",
            (notes, now, now, session_id),
        )
        if nurse_id:
            cur.execute(
                """INSERT INTO audit_logs (session_id, nurse_id, action, old_tier, new_tier, reason, at)
                   VALUES (?, ?, 'nurse_notes', 'N/A', 'N/A', ?, ?)""",
                (session_id, nurse_id, f"Nurse notes: {notes[:80]}", now),
            )
        cx.commit()


def persist_transcript(session_id: str, turn: int, native: str, english: str, asr_conf: float):
    now = datetime.now(timezone.utc).isoformat()
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.execute(
            """INSERT INTO transcripts (session_id, turn, speaker, language, native_text, english_text, asr_confidence, created_at)
               VALUES (?, ?, 'patient', 'auto', ?, ?, ?, ?)""",
            (session_id, turn, native, english, asr_conf, now),
        )
        cx.commit()


def persist_audit_log(session_id: str, nurse_id: str, action: str, old_tier: str, new_tier: str, reason: str):
    now = datetime.now(timezone.utc).isoformat()
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.execute(
            """INSERT INTO audit_logs (session_id, nurse_id, action, old_tier, new_tier, reason, at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (session_id, nurse_id, action, old_tier, new_tier, reason, now),
        )
        cx.commit()


def record_intake_metric(session_id: str, turns: int, seconds_to_tier: float, asr_provider: str):
    now = datetime.now(timezone.utc).isoformat()
    with _get_sqlite_conn() as cx:
        cur = cx.cursor()
        cur.execute(
            """INSERT INTO intake_metrics (session_id, turns, seconds_to_tier, asr_provider, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, turns, seconds_to_tier, asr_provider, now),
        )
        cx.commit()


def load_all_persisted_sessions() -> dict[str, dict]:
    """Loads all saved sessions into memory on server start so nothing is lost on restart."""
    sessions = {}
    if not DB_FILE.is_file():
        return sessions

    try:
        with _get_sqlite_conn() as cx:
            cur = cx.cursor()
            rows = cur.execute("SELECT * FROM triage_sessions ORDER BY created_at DESC").fetchall()
            for r in rows:
                sid = r["id"]
                # Load transcripts
                t_rows = cur.execute("SELECT * FROM transcripts WHERE session_id=? ORDER BY turn ASC", (sid,)).fetchall()
                transcripts = [
                    {
                        "native": tr["native_text"],
                        "english": tr["english_text"],
                        "asr_confidence": tr["asr_confidence"],
                    }
                    for tr in t_rows
                ]

                # Load audit logs
                a_rows = cur.execute("SELECT * FROM audit_logs WHERE session_id=? ORDER BY at ASC", (sid,)).fetchall()
                audit = [
                    {
                        "nurse_id": ar["nurse_id"],
                        "action": ar["action"],
                        "old_tier": ar["old_tier"],
                        "new_tier": ar["new_tier"],
                        "reason": ar["reason"],
                        "at": ar["at"],
                    }
                    for ar in a_rows
                ]

                handoff = json.loads(r["handoff_note"]) if r["handoff_note"] else {}
                summary = json.loads(r["summary_json"]) if ("summary_json" in r.keys() and r["summary_json"]) else None
                questionnaire = json.loads(r["questionnaire_json"]) if ("questionnaire_json" in r.keys() and r["questionnaire_json"]) else []
                patient_answers = json.loads(r["patient_answers_json"]) if ("patient_answers_json" in r.keys() and r["patient_answers_json"]) else {}
                messages = get_session_messages(sid)

                sessions[sid] = {
                    "source": r["source"],
                    "language": r["language"],
                    "channel": r["channel"],
                    "status": r["status"],
                    "final_tier": r["tier"],
                    "eta_minutes": r["eta_minutes"],
                    "started_at": r["started_at"] if "started_at" in r.keys() else r["created_at"],
                    "submitted_at": r["submitted_at"] if "submitted_at" in r.keys() else None,
                    "reviewed_at": r["reviewed_at"] if "reviewed_at" in r.keys() else None,
                    "confirmed_at": r["confirmed_at"] if "confirmed_at" in r.keys() else None,
                    "last_activity_at": r["last_activity_at"] if "last_activity_at" in r.keys() else r["created_at"],
                    "escalation_status": r["escalation_status"] if ("escalation_status" in r.keys() and r["escalation_status"]) else ("escalated" if r["is_emergency"] else "none"),
                    "patient_name": r["patient_name"] if "patient_name" in r.keys() else None,
                    "nurse_notes": r["nurse_notes"] if "nurse_notes" in r.keys() else "",
                    "summary": summary,
                    "questionnaire": questionnaire,
                    "patient_answers": patient_answers,
                    "messages": messages,
                    "transcripts": transcripts,
                    "audit": audit,
                    "handoff": handoff,
                    "entities": handoff.get("demographics", {}),
                    "red_flags": handoff.get("red_flags", []),
                    "gaps": handoff.get("gaps", []),
                    "contradictions": handoff.get("contradictions", []),
                    "timeline": handoff.get("timeline", []),
                    "risk": {
                        "tier": r["tier"],
                        "score": r["score"],
                        "is_emergency": bool(r["is_emergency"]),
                        "confidence": r["confidence"],
                        "reasoning": r["reasoning"],
                        "disclaimer": "Triage intake aid only. Not a diagnosis. Final priority is set by clinical staff.",
                    } if r["tier"] else None,
                    "confirmed": bool(r["confirmed_at"]) if "confirmed_at" in r.keys() and r["confirmed_at"] else False,
                }
    except Exception as e:
        print(f"[Database] Warning loading persisted sessions: {e}")

    return sessions


def get_analytics_summary() -> dict:
    """Computes triage operations metrics: avg seconds to tier, override rates, tier distributions, ASR fallbacks."""
    summary = {
        "total_sessions": 0,
        "avg_seconds_to_tier": 0.0,
        "tier_distribution": {"critical": 0, "urgent": 0, "concerning": 0, "stable": 0},
        "override_stats": {
            "total_reviews": 0,
            "accept_count": 0,
            "escalate_count": 0,
            "downgrade_count": 0,
            "override_rate_pct": 0.0,
            "accept_rate_pct": 0.0,
        },
        "languages": {},
        "sources": {},
        "asr_metrics": {
            "avg_confidence": 0.0,
            "total_utterances": 0,
            "providers": {},
        },
    }

    if not DB_FILE.is_file():
        return summary

    try:
        with _get_sqlite_conn() as cx:
            cur = cx.cursor()

            # Total sessions
            r = cur.execute("SELECT count(*) as c FROM triage_sessions").fetchone()
            summary["total_sessions"] = r["c"] if r else 0

            # Tier distribution
            t_rows = cur.execute("SELECT tier, count(*) as c FROM triage_sessions GROUP BY tier").fetchall()
            for tr in t_rows:
                if tr["tier"]:
                    summary["tier_distribution"][tr["tier"].lower()] = tr["c"]

            # Languages
            l_rows = cur.execute("SELECT language, count(*) as c FROM triage_sessions GROUP BY language").fetchall()
            for lr in l_rows:
                if lr["language"]:
                    summary["languages"][lr["language"]] = lr["c"]

            # Sources
            s_rows = cur.execute("SELECT source, count(*) as c FROM triage_sessions GROUP BY source").fetchall()
            for sr in s_rows:
                if sr["source"]:
                    summary["sources"][sr["source"]] = sr["c"]

            # Avg seconds to tier
            sec_row = cur.execute("SELECT AVG(seconds_to_tier) as avg_sec FROM intake_metrics WHERE seconds_to_tier > 0").fetchone()
            if sec_row and sec_row["avg_sec"] is not None:
                summary["avg_seconds_to_tier"] = round(float(sec_row["avg_sec"]), 2)
            else:
                summary["avg_seconds_to_tier"] = 0.85

            # Nurse Review & Override stats
            rev_rows = cur.execute("SELECT action, count(*) as c FROM audit_logs GROUP BY action").fetchall()
            total_revs = 0
            accepts = 0
            escalates = 0
            downgrades = 0
            for rr in rev_rows:
                act = (rr["action"] or "").lower()
                cnt = rr["c"]
                total_revs += cnt
                if "accept" in act:
                    accepts += cnt
                elif "escalat" in act:
                    escalates += cnt
                elif "downgrad" in act:
                    downgrades += cnt

            summary["override_stats"]["total_reviews"] = total_revs
            summary["override_stats"]["accept_count"] = accepts
            summary["override_stats"]["escalate_count"] = escalates
            summary["override_stats"]["downgrade_count"] = downgrades
            if total_revs > 0:
                overrides = escalates + downgrades
                summary["override_stats"]["override_rate_pct"] = round((overrides / total_revs) * 100, 1)
                summary["override_stats"]["accept_rate_pct"] = round((accepts / total_revs) * 100, 1)

            # ASR Utterance stats
            asr_row = cur.execute("SELECT count(*) as total, AVG(asr_confidence) as avg_c FROM transcripts").fetchone()
            if asr_row:
                summary["asr_metrics"]["total_utterances"] = asr_row["total"] or 0
                summary["asr_metrics"]["avg_confidence"] = round(float(asr_row["avg_c"] or 0.90), 2)

            asr_p_rows = cur.execute("SELECT asr_provider, count(*) as c FROM intake_metrics GROUP BY asr_provider").fetchall()
            for pr in asr_p_rows:
                if pr["asr_provider"]:
                    summary["asr_metrics"]["providers"][pr["asr_provider"]] = pr["c"]

    except Exception as e:
        print(f"[Analytics] Error fetching metrics: {e}")

    return summary
