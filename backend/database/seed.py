"""Clinical Triage Database & Engine Seed Script.
Usage:
    python backend/database/seed.py       -> runs 4 multilingual seed cases through the engine and prints results
    python backend/database/seed.py --db  -> runs cases and inserts them into PostgreSQL (requires DATABASE_URL)
"""
import os
import sys
import json
import pathlib

# Ensure backend root is on sys.path regardless of how seed.py is invoked
CURRENT_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

for p in (str(PROJECT_ROOT), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.app import engine
except ImportError:
    from app import engine

CASES_FILE = CURRENT_DIR / "seed_cases.json"
cases = json.loads(CASES_FILE.read_text(encoding="utf-8"))


def run():
    out = []
    for c in cases:
        s = engine.new_session(source=c["source"], language=c["language"])
        for t in c["turns"]:
            engine.process_turn(s, native=t["native"], english=t["english"], asr_conf=t.get("asr", 0.9))
        out.append((c["name"], s))
    return out


if __name__ == "__main__":
    res = run()
    print("=" * 80)
    print("CLINICAL TRIAGE ENGINE SEED RUN")
    print("=" * 80)
    for n, s in res:
        r = s["risk"]
        tier = r["tier"].upper()
        conf = r["confidence"]
        reasoning = r["reasoning"][:90]
        flags = ", ".join(s.get("red_flags", [])) or "None"
        print(f"[{tier:9s}] {n:32s} (conf: {conf:.2f}) | Flags: {flags}")
        print(f"           Reasoning: {reasoning}...")
    print("=" * 80)

    if "--db" in sys.argv:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            print("ERROR: DATABASE_URL environment variable is required for --db.")
            sys.exit(1)
        import psycopg
        from psycopg.types.json import Jsonb

        with psycopg.connect(db_url) as cx:
            for n, s in res:
                r = s["risk"]
                entities = s.get("entities") or {}
                age_val = entities.get("age")
                with cx.cursor() as cur:
                    cur.execute(
                        "INSERT INTO patients(age, language) VALUES (%s, %s) RETURNING id",
                        (age_val, s["language"]),
                    )
                    pid = cur.fetchone()[0]

                    cur.execute(
                        """INSERT INTO triage_sessions
                           (patient_id, source, language, tier, score, is_emergency, confidence, reasoning, handoff_note)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                        (
                            pid,
                            s["source"],
                            s["language"],
                            r["tier"],
                            r["score"],
                            r["is_emergency"],
                            r["confidence"],
                            r["reasoning"],
                            Jsonb(s["handoff"]),
                        ),
                    )
                    sid = cur.fetchone()[0]

                    for i, t in enumerate(s.get("transcripts", [])):
                        cur.execute(
                            """INSERT INTO transcripts
                               (session_id, turn, speaker, language, native_text, english_text, asr_confidence)
                               VALUES (%s, %s, 'patient', %s, %s, %s, %s)""",
                            (sid, i, s["language"], t["native"], t["english"], t.get("asr_confidence", 0.9)),
                        )

                    for sym in entities.get("symptoms", []):
                        cur.execute(
                            "INSERT INTO symptoms(session_id, name, severity) VALUES (%s, %s, %s)",
                            (sid, sym, entities.get("severity")),
                        )
            cx.commit()
        print("Successfully seeded PostgreSQL database.")
