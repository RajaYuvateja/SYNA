import pytest
import uuid
from backend.database import db
from backend.app import engine


def test_db_initialization():
    db.init_db()
    assert db.DB_FILE.is_file()


def test_session_persistence_and_restoration():
    db.init_db()
    sid = str(uuid.uuid4())
    s = engine.new_session(source="relative", language="te")
    engine.process_turn(s, native="తీవ్రమైన ఛాతీ నొప్పి", english="severe chest pain 9/10 with sweating", asr_conf=0.92)

    # 1. Persist session & transcript
    db.persist_session(sid, s)
    db.persist_transcript(sid, 0, "తీవ్రమైన ఛాతీ నొప్పి", "severe chest pain 9/10 with sweating", 0.92)

    # 2. Add audit log
    db.persist_audit_log(sid, "RN-Lead", "accept", "critical", "critical", "Bedside review confirmed cardiac signs")

    # 3. Simulate server restart: load all sessions from database
    restored = db.load_all_persisted_sessions()
    assert sid in restored
    assert restored[sid]["language"] == "te"
    assert restored[sid]["source"] == "relative"
    assert len(restored[sid]["transcripts"]) >= 1
    assert restored[sid]["transcripts"][0]["native"] == "తీవ్రమైన ఛాతీ నొప్పి"
    assert len(restored[sid]["audit"]) >= 1
    assert restored[sid]["audit"][0]["nurse_id"] == "RN-Lead"


def test_intake_metrics_recording():
    sid = str(uuid.uuid4())
    db.record_intake_metric(sid, turns=2, seconds_to_tier=1.2, asr_provider="sarvam")
    with db._get_sqlite_conn() as cx:
        cur = cx.cursor()
        row = cur.execute("SELECT * FROM intake_metrics WHERE session_id=?", (sid,)).fetchone()
        assert row is not None
        assert row["turns"] == 2
        assert row["asr_provider"] == "sarvam"
