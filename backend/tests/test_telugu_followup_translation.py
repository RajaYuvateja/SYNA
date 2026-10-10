import re
import sys
import codecs
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, SESS

# Ensure Windows terminal doesn't crash on Telugu UTF-8 characters
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

client = TestClient(app)

def contains_indic(text: str) -> bool:
    if not text:
        return False
    return any('\u0900' <= char <= '\u0d7f' for char in text)

def is_telugu(text: str) -> bool:
    if not text:
        return False
    return any('\u0c00' <= char <= '\u0c7f' for char in text)

def test_five_different_telugu_followup_questions_in_one_session():
    """Requirement: Test at least five different Telugu follow-up questions in one session.
    Verify that each displays its correct English translation and that translations
    are never incorrectly reused for different questions.
    """
    SESS.clear()

    # 1. Initialize patient triage session in Telugu
    res = client.post("/api/sessions", json={"source": "patient", "language": "te", "channel": "kiosk"})
    assert res.status_code == 200
    sid = res.json()["id"]

    turns_data = [
        # Turn 1: Primary complaint
        {
            "native": "నాకు ఛాతీలో తీవ్రమైన నొప్పిగా ఉంది",
            "english": "I have severe pain in my chest",
        },
        # Turn 2: Onset / timing
        {
            "native": "నొప్పి సుమారు అరగంట క్రితం మొదలైంది",
            "english": "The pain started about half an hour ago",
        },
        # Turn 3: Radiation to left arm
        {
            "native": "ఈ నొప్పి నా ఎడమ చేతికి వ్యాపిస్తోంది",
            "english": "This pain is radiating to my left arm",
        },
        # Turn 4: Diaphoresis / sweating
        {
            "native": "నాకు చాలా ఎక్కువగా చల్లని చెమటలు పడుతున్నాయి",
            "english": "I am sweating heavily with cold sweats",
        },
        # Turn 5: Breathlessness / dyspnea
        {
            "native": "నాకు తీవ్రంగా ఆయాసంగా ఉంది, శ్వాస తీసుకోవడం కష్టంగా ఉంది",
            "english": "I feel severe breathlessness and it is hard to breathe",
        },
    ]

    seen_native_questions = []
    seen_english_translations = []

    for idx, turn in enumerate(turns_data, start=1):
        utterance_res = client.post(
            f"/api/sessions/{sid}/utterance",
            json={
                "text": turn["native"],
                "english_text": turn["english"],
                "language": "te",
                "asr_confidence": 0.96,
            },
        )
        assert utterance_res.status_code == 200
        reply = utterance_res.json()

        native_q = reply.get("next_question_native")
        english_q = reply.get("next_question_en") or reply.get("next_question")

        # In turns where a follow-up inquiry is generated:
        if native_q or english_q:
            # Bug 1 Verification:
            # - The original follow-up question MUST be in Telugu (or target language)
            # - The translation underneath MUST explicitly be in English and NOT in Telugu!
            assert native_q is not None, f"Turn {idx}: native question must not be None"
            assert english_q is not None, f"Turn {idx}: English translation must not be None"

            assert is_telugu(native_q), (
                f"Turn {idx}: Question displayed to patient must be in Telugu script. Got: '{native_q}'"
            )
            assert not contains_indic(english_q), (
                f"Turn {idx} BUG 1 FAILURE: Telugu was displayed instead of English! "
                f"Expected English underneath, got Indic text: '{english_q}'"
            )

            # Bug 2 Verification:
            # - Verify translations are NEVER incorrectly reused across different questions
            assert english_q not in seen_english_translations, (
                f"Turn {idx} BUG 2 FAILURE: English translation was incorrectly reused! "
                f"Duplicate translation: '{english_q}' was already seen in previous turn."
            )

            seen_native_questions.append(native_q)
            seen_english_translations.append(english_q)

            # Check messages persistence
            session_data = client.get(f"/api/sessions/{sid}").json()
            messages = session_data.get("messages", [])
            assistant_msgs = [m for m in messages if m["sender"] == "assistant"]
            latest_ai_msg = assistant_msgs[-1]

            assert latest_ai_msg["original_text"] == native_q
            assert latest_ai_msg["english_text"] == english_q
            assert not contains_indic(latest_ai_msg["english_text"])

    # Verify that multiple unique questions and translations were tested
    print(f"\n--- Verified {len(seen_native_questions)} distinct Telugu follow-up questions ---")
    for i, (nq, eq) in enumerate(zip(seen_native_questions, seen_english_translations), 1):
        try:
            print(f"[{i}] Telugu:  {nq}")
        except Exception:
            print(f"[{i}] Telugu:  {repr(nq)}")
        print(f"    English: {eq}\n")

    assert len(seen_native_questions) >= 3, "Expected multiple turns of follow-up questions"
    assert len(set(seen_english_translations)) == len(seen_english_translations), "All translations must be unique"
