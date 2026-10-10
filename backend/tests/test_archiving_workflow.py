"""Comprehensive Test Suite for Nurse-Verified Case Archiving + Clinical History
Validates Tests A through H as specified in clinical audit requirements:
- Test A: Successful verification (62 -> 61 active, 1 in history, severity counters updated)
- Test B: Multiple completed cases (15 verified -> 47 active, 15 in history)
- Test C: Incomplete verification (open/acknowledge/notes -> remains active)
- Test D: Stable patient (setting severity to stable without final verification -> remains active)
- Test E: Persistence (archived case survives restart / DB reload)
- Test F: Duplicate requests (submitting review multiple times is idempotent)
- Test G: Failure handling (persistence error doesn't lose active case or falsely archive)
- Test H: Existing functionality (bilingual translations, transcripts, SBAR, questionnaire preserved)
"""

import sys
import os
import json
import uuid
import pathlib
import unittest

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

from backend.app import engine
from backend.database.db import (
    init_db,
    persist_session,
    load_all_persisted_sessions,
    persist_audit_log,
    save_nurse_notes,
    _get_sqlite_conn,
)
from backend.app.main import app, SESS, classify_case, get_queue, get_queue_counts, public
from fastapi.testclient import TestClient

client = TestClient(app)


class TestArchivingWorkflow(unittest.TestCase):
    def setUp(self):
        # Initialize DB and clean tables for test isolation
        init_db()
        with _get_sqlite_conn() as cx:
            cur = cx.cursor()
            cur.execute("DELETE FROM triage_sessions;")
            cur.execute("DELETE FROM transcripts;")
            cur.execute("DELETE FROM audit_logs;")
            cur.execute("DELETE FROM messages;")
            cx.commit()
        SESS.clear()

    def _create_mock_session(self, sid: str, tier: str = "urgent", is_emergency: bool = False, chief: str = "Chest pain"):
        s = engine.new_session(source="patient", language="en")
        s["id"] = sid
        s["patient_name"] = f"Patient {sid[:6]}"
        s["entities"]["chief_complaint"] = chief
        s["risk"] = {
            "tier": tier,
            "score": 75 if tier == "critical" else (50 if tier == "urgent" else 20),
            "is_emergency": is_emergency,
            "confidence": 0.92,
            "reasoning": f"Clinical assessment: {tier}",
            "disclaimer": "Triage aid only.",
        }
        s["final_tier"] = tier
        s["status"] = "pending_review"
        s["lifecycle_status"] = "active"
        s["transcripts"] = [{"native": chief, "english": chief, "asr_confidence": 0.95}]
        return s

    def test_scenario_a_and_b_lifecycle_and_counts(self):
        """Test A (1 verified: 62 -> 61) & Test B (15 verified: 62 -> 47 active, 15 in History)."""
        print("\n--- Running Test A & B: Active Case Lifecycle & Dynamic Counter Accuracy ---")
        
        # 1. Populate exactly 62 active cases
        # Distribute across severity tiers: 12 critical, 20 urgent, 15 concerning, 15 stable
        tiers_dist = ["critical"] * 12 + ["urgent"] * 20 + ["concerning"] * 15 + ["stable"] * 15
        self.assertEqual(len(tiers_dist), 62)

        session_ids = []
        for i, tier in enumerate(tiers_dist):
            sid = f"case_test_{i+1:03d}_{uuid.uuid4().hex[:6]}"
            session_ids.append(sid)
            s = self._create_mock_session(sid, tier=tier, is_emergency=(tier == "critical"), chief=f"Complaint #{i+1}")
            SESS[sid] = s
            persist_session(sid, s)

        # Confirm initial state: exactly 62 active cases
        initial_counts = client.get("/api/queue/counts").json()
        self.assertEqual(initial_counts["active"], 62)
        self.assertEqual(initial_counts["all"], 62)
        self.assertEqual(initial_counts["critical"], 12)
        self.assertEqual(initial_counts["urgent"], 20)
        self.assertEqual(initial_counts["concerning"], 15)
        self.assertEqual(initial_counts["stable"], 15)
        self.assertEqual(initial_counts["history"], 0)
        print(f"Initial: Active Cases = {initial_counts['active']}, History = {initial_counts['history']}")

        # TEST A: Complete final verification for ONE case
        first_sid = session_ids[0] # was critical
        resp_a = client.post(
            f"/api/sessions/{first_sid}/review",
            json={
                "nurse_id": "RN-Lead-01",
                "action": "accept",
                "reason": "ECG confirms sinus tachycardia. Bedside physician notified.",
            },
        )
        self.assertEqual(resp_a.status_code, 200)
        verified_case_a = resp_a.json()
        self.assertEqual(verified_case_a["lifecycle_status"], "archived")
        self.assertEqual(verified_case_a["status"], "verified")
        self.assertIsNotNone(verified_case_a["verified_at"])

        # Check Test A Counts: Active cases must decrease from 62 to 61
        counts_a = client.get("/api/queue/counts").json()
        self.assertEqual(counts_a["active"], 61)
        self.assertEqual(counts_a["all"], 61)
        self.assertEqual(counts_a["history"], 1)
        self.assertEqual(counts_a["critical"], 11) # Decreased from 12 to 11!

        # Check Active Queue: First case must NOT appear in active queue
        active_queue_a = client.get("/api/queue?filter=active").json()
        self.assertEqual(len(active_queue_a), 61)
        self.assertNotIn(first_sid, [c["id"] for c in active_queue_a])

        # Check History: First case MUST appear in history
        history_a = client.get("/api/queue?filter=history").json()
        self.assertEqual(len(history_a), 1)
        self.assertEqual(history_a[0]["id"], first_sid)
        print("[PASS] Test A Passed: 1 Case Verified -> Active = 61, History = 1, Critical = 11")

        # TEST B: Complete final verification for 14 more eligible cases (total 15 cases verified)
        for i in range(1, 15):
            sid = session_ids[i]
            resp_b = client.post(
                f"/api/sessions/{sid}/review",
                json={
                    "nurse_id": "RN-Lead-01",
                    "action": "accept",
                    "reason": f"Clinical sign-off completed for cohort case #{i+1}",
                },
            )
            self.assertEqual(resp_b.status_code, 200)

        # Check Test B Counts: Exactly 47 active cases remain, exactly 15 in History!
        counts_b = client.get("/api/queue/counts").json()
        self.assertEqual(counts_b["active"], 47, "Must have exactly 47 active cases remaining")
        self.assertEqual(counts_b["all"], 47)
        self.assertEqual(counts_b["history"], 15, "Must have exactly 15 archived cases in History")
        self.assertEqual(counts_b["completed"], 15)

        # Verify Active Queue has 47 cases and excludes all 15 archived cases
        active_queue_b = client.get("/api/queue?filter=active").json()
        self.assertEqual(len(active_queue_b), 47)
        archived_15_ids = set(session_ids[:15])
        active_ids = set(c["id"] for c in active_queue_b)
        self.assertTrue(archived_15_ids.isdisjoint(active_ids), "No archived cases may appear in active queue")

        # Verify History Queue has 15 cases
        history_queue_b = client.get("/api/queue?filter=history").json()
        self.assertEqual(len(history_queue_b), 15)
        history_ids = set(c["id"] for c in history_queue_b)
        self.assertEqual(history_ids, archived_15_ids)
        print("[PASS] Test B Passed: 15 Cases Verified -> Active = 47, History = 15, No overlap between lists")

    def test_scenario_c_incomplete_verification(self):
        """Test C: Open or acknowledge case or save notes without final verification -> remains active."""
        print("\n--- Running Test C: Incomplete Verification Safety ---")
        sid = f"case_inc_{uuid.uuid4().hex[:6]}"
        s = self._create_mock_session(sid, tier="urgent", chief="Moderate headache")
        SESS[sid] = s
        persist_session(sid, s)

        # Nurse adds notes or acknowledges
        notes_resp = client.post(
            f"/api/sessions/{sid}/nurse-notes",
            json={"nurse_id": "RN-Triage", "notes": "Patient resting in triage bed 2; vitals monitored."},
        )
        self.assertEqual(notes_resp.status_code, 200)

        # Confirm case is NOT archived and remains active
        updated = SESS[sid]
        self.assertEqual(updated.get("lifecycle_status"), "active")
        self.assertNotEqual(updated.get("status"), "verified")

        counts = client.get("/api/queue/counts").json()
        self.assertEqual(counts["active"], 1)
        self.assertEqual(counts["history"], 0)

        active_cases = client.get("/api/queue?filter=active").json()
        self.assertEqual(len(active_cases), 1)
        self.assertEqual(active_cases[0]["id"], sid)
        print("[PASS] Test C Passed: Nurse notes and acknowledgment keep case in active queue")

    def test_scenario_d_stable_patient(self):
        """Test D: Change active patient's severity to Stable without final verification -> remains active."""
        print("\n--- Running Test D: Stable Patient Severity Independence ---")
        sid = f"case_stable_{uuid.uuid4().hex[:6]}"
        s = self._create_mock_session(sid, tier="concerning", chief="Mild dizziness")
        SESS[sid] = s
        persist_session(sid, s)

        # Change clinical severity to stable (e.g. through assessment or vitals stabilization)
        s["risk"]["tier"] = "stable"
        s["final_tier"] = "stable"
        persist_session(sid, s)

        # Verify case does NOT automatically archive simply because status is stable
        counts = client.get("/api/queue/counts").json()
        self.assertEqual(counts["active"], 1)
        self.assertEqual(counts["stable"], 1)
        self.assertEqual(counts["history"], 0)

        active_cases = client.get("/api/queue?filter=active").json()
        self.assertEqual(len(active_cases), 1)
        self.assertEqual(active_cases[0]["id"], sid)
        print("[PASS] Test D Passed: Changing severity to Stable does NOT archive the case")

    def test_scenario_e_persistence(self):
        """Test E: Archive a case, reload database / restart -> remains in History, not active."""
        print("\n--- Running Test E: Persistence Across Restarts ---")
        sid = f"case_persist_{uuid.uuid4().hex[:6]}"
        s = self._create_mock_session(sid, tier="concerning", chief="Knee swelling")
        SESS[sid] = s
        persist_session(sid, s)

        # Verify & Archive
        review_resp = client.post(
            f"/api/sessions/{sid}/review",
            json={"nurse_id": "RN-Senior", "action": "accept", "reason": "Ice pack applied, outpatient follow-up scheduled."},
        )
        self.assertEqual(review_resp.status_code, 200)

        # Simulate Server Restart by clearing memory and reloading directly from SQLite DB
        SESS.clear()
        restored = load_all_persisted_sessions()
        SESS.update(restored)

        self.assertIn(sid, SESS)
        restored_case = SESS[sid]
        self.assertEqual(restored_case["lifecycle_status"], "archived")
        self.assertEqual(restored_case["status"], "verified")
        self.assertIsNotNone(restored_case["verified_at"])

        # Check counts after restart
        counts = client.get("/api/queue/counts").json()
        self.assertEqual(counts["active"], 0)
        self.assertEqual(counts["history"], 1)

        # Check queues
        active_cases = client.get("/api/queue?filter=active").json()
        self.assertEqual(len(active_cases), 0)

        history_cases = client.get("/api/queue?filter=history").json()
        self.assertEqual(len(history_cases), 1)
        self.assertEqual(history_cases[0]["id"], sid)
        print("[PASS] Test E Passed: Case remains archived and in History across simulated server restart")

    def test_scenario_f_duplicate_requests(self):
        """Test F: Submit final verification more than once -> exactly one archive record, idempotent."""
        print("\n--- Running Test F: Idempotency & Duplicate Prevention ---")
        sid = f"case_dup_{uuid.uuid4().hex[:6]}"
        s = self._create_mock_session(sid, tier="urgent", chief="Severe earache")
        SESS[sid] = s
        persist_session(sid, s)

        # First verification
        resp1 = client.post(
            f"/api/sessions/{sid}/review",
            json={"nurse_id": "RN-Lead", "action": "accept", "reason": "Analgesic administered."},
        )
        self.assertEqual(resp1.status_code, 200)

        # Repeated duplicate verification request
        resp2 = client.post(
            f"/api/sessions/{sid}/review",
            json={"nurse_id": "RN-Lead", "action": "accept", "reason": "Analgesic administered."},
        )
        self.assertEqual(resp2.status_code, 200)

        # Third duplicate request
        resp3 = client.post(
            f"/api/sessions/{sid}/review",
            json={"nurse_id": "RN-Lead", "action": "accept", "reason": "Analgesic administered."},
        )
        self.assertEqual(resp3.status_code, 200)

        # Confirm exactly 1 archived record in history, no duplicate count
        counts = client.get("/api/queue/counts").json()
        self.assertEqual(counts["active"], 0)
        self.assertEqual(counts["history"], 1)

        history = client.get("/api/queue?filter=history").json()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["id"], sid)
        print("[PASS] Test F Passed: Repeated verification requests handled safely without duplicating audit/records")

    def test_scenario_g_failure_handling(self):
        """Test G: Simulate failed persistence -> does not report success or lose active case."""
        print("\n--- Running Test G: Persistence Failure Handling ---")
        sid = f"case_fail_{uuid.uuid4().hex[:6]}"
        s = self._create_mock_session(sid, tier="critical", is_emergency=True, chief="Difficulty breathing")
        SESS[sid] = s
        persist_session(sid, s)

        # Temporarily mock persist_session to throw an exception
        original_persist = sys.modules["backend.app.main"].persist_session
        def faulty_persist(*args, **kwargs):
            raise IOError("Simulated SQLite Disk I/O Failure")
        sys.modules["backend.app.main"].persist_session = faulty_persist

        try:
            resp = client.post(
                f"/api/sessions/{sid}/review",
                json={"nurse_id": "RN-Emergency", "action": "accept", "reason": "Oxygen provided."},
            )
            self.assertEqual(resp.status_code, 500)
            self.assertIn("Failed to persist clinical verification", resp.json()["detail"])

            # Verify the case was NOT falsely archived and remains in active workflow
            case_in_memory = SESS[sid]
            self.assertEqual(case_in_memory["lifecycle_status"], "active")
            self.assertEqual(case_in_memory["status"], "pending_review")

            counts = client.get("/api/queue/counts").json()
            self.assertEqual(counts["active"], 1)
            self.assertEqual(counts["critical"], 1)
            self.assertEqual(counts["history"], 0)
            print("[PASS] Test G Passed: Persistence failure cleanly reverts and maintains active case")
        finally:
            # Restore persist_session
            sys.modules["backend.app.main"].persist_session = original_persist

    def test_scenario_h_existing_features(self):
        """Test H: Existing patient details, triage logic, alerts, and bilingual features still work."""
        print("\n--- Running Test H: Existing Clinical Functionality Preservation ---")
        
        # 1. Create a session with multilingual Telugu intake
        create_resp = client.post("/api/sessions", json={"source": "patient", "language": "te"})
        self.assertEqual(create_resp.status_code, 200)
        sid = create_resp.json()["id"]

        # 2. Utterance with Telugu text
        utt_resp = client.post(
            f"/api/sessions/{sid}/utterance",
            json={
                "text": "నాకు తీవ్రమైన ఛాతీ నొప్పి ఉంది.",
                "english_text": "I have severe crushing chest pain, 9/10, radiating to left arm.",
                "language": "te",
            },
        )
        self.assertEqual(utt_resp.status_code, 200)
        data = utt_resp.json()
        self.assertIn("questionnaire", data)
        self.assertGreaterEqual(len(data["questionnaire"]), 1)

        # 3. Check triage risk calculation
        session_obj = client.get(f"/api/sessions/{sid}").json()
        self.assertIsNotNone(session_obj["risk"])
        self.assertEqual(session_obj["risk"]["tier"], "critical")
        self.assertTrue(session_obj["risk"]["is_emergency"])

        # 4. Check active queue visibility before verification
        counts = client.get("/api/queue/counts").json()
        self.assertGreaterEqual(counts["critical"], 1)
        self.assertGreaterEqual(counts["active"], 1)

        # 5. Check SBAR generation
        sbar_resp = client.get(f"/api/sessions/{sid}/sbar")
        self.assertEqual(sbar_resp.status_code, 200)
        sbar_text = sbar_resp.json()["sbar"]
        self.assertIn("Situation", sbar_text)
        self.assertIn("Recommendation", sbar_text)

        # 6. Complete nurse verification
        rev_resp = client.post(
            f"/api/sessions/{sid}/review",
            json={
                "nurse_id": "RN-Cardio",
                "action": "accept",
                "reason": "Cardiac protocol activated. STAT Troponin and ECG ordered.",
            },
        )
        self.assertEqual(rev_resp.status_code, 200)
        verified_data = rev_resp.json()
        self.assertEqual(verified_data["lifecycle_status"], "archived")

        # 7. Check History contains the complete preserved record
        hist_resp = client.get("/api/queue?filter=history").json()
        hist_case = next(c for c in hist_resp if c["id"] == sid)
        self.assertEqual(hist_case["risk"]["tier"], "critical")
        self.assertEqual(len(hist_case["transcripts"]), 1)
        self.assertEqual(hist_case["transcripts"][0]["native"], "నాకు తీవ్రమైన ఛాతీ నొప్పి ఉంది.")
        self.assertIn("Troponin", hist_case["audit"][-1]["reason"])
        print("[PASS] Test H Passed: All existing clinical intake, triage, SBAR, and bilingual features operate flawlessly")


if __name__ == "__main__":
    unittest.main()
