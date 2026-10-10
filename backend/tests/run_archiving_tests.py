"""SYNA Comprehensive Acceptance Test Suite:
Nurse-Verified Case Archiving + Clinical History Management (Tests A - H)
"""

import urllib.request
import urllib.error
import json
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {"detail": str(e)}
        return e.code, body

def post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {"detail": str(e)}
        return e.code, body

def run():
    print("=" * 75)
    print("CLINICAL TRIAGE: VERIFIED CASE ARCHIVING & HISTORY ACCEPTANCE SUITE")
    print("=" * 75)

    # Reset environment cleanly
    post("/api/dev/reset", {})

    # =========================================================================
    # TEST A & TEST B: Setup 62 active cases
    # =========================================================================
    print("\n[PHASE 1] Initializing 62 Active Patient Cases...")
    st_seed, seed_resp = post("/api/dev/seed-cohort?count=62", {})
    assert st_seed == 200, f"Failed seeding cohort: {seed_resp}"
    session_ids = seed_resp["session_ids"]
    assert len(session_ids) == 62, f"Expected 62 cases, got {len(session_ids)}"

    # Validate Initial Counts
    st, counts_init = get("/api/queue/counts")
    assert st == 200
    print(f"  Live Initial Counts: Active={counts_init['active']}, Critical={counts_init['critical']}, Urgent={counts_init['urgent']}, History={counts_init['history']}")
    assert counts_init["active"] >= 62, f"Expected at least 62 active cases, got {counts_init['active']}"
    assert counts_init["history"] == 0, f"Expected 0 history cases initially, got {counts_init['history']}"
    initial_active_total = counts_init["active"]
    initial_critical = counts_init["critical"]

    # =========================================================================
    # TEST A: Successful Single Verification (Active decreases by 1, History increases by 1)
    # =========================================================================
    print("\n[TEST A] Executing Final Verification for 1 Eligible Case...")
    first_sid = session_ids[0]
    st, rev_a = post(f"/api/sessions/{first_sid}/review", {
        "nurse_id": "RN-Lead-Sarah",
        "action": "accept",
        "reason": "Bedside ECG confirmed. Transferred to Cardiac Telemetry Care.",
    })
    assert st == 200, f"Review failed: {rev_a}"
    assert rev_a["lifecycle_status"] == "archived", "Lifecycle status must be 'archived'"
    assert rev_a["status"] == "verified", "Session status must be 'verified'"
    assert rev_a["verified_by"] == "RN-Lead-Sarah", "Verifying nurse must be recorded"
    assert rev_a["verified_at"] is not None, "Verification timestamp must be recorded"

    # Verify counts after Test A
    st, counts_a = get("/api/queue/counts")
    assert counts_a["active"] == initial_active_total - 1, f"Expected {initial_active_total - 1} active cases, got {counts_a['active']}"
    assert counts_a["history"] == 1, f"Expected exactly 1 History case, got {counts_a['history']}"
    assert counts_a["critical"] == initial_critical - 1, "Active critical counter must exclude archived case"

    # Confirm case is NOT in active queue
    st, active_queue_a = get("/api/queue?filter=active")
    active_ids_a = [c["id"] for c in active_queue_a]
    assert first_sid not in active_ids_a, "Verified case must be immediately removed from active queue"

    # Confirm case IS in History
    st, history_queue_a = get("/api/queue?filter=history")
    history_ids_a = [c["id"] for c in history_queue_a]
    assert first_sid in history_ids_a, "Verified case must be immediately visible in History"
    print("  [PASS] Test A Passed: Active cases decreased by 1, case removed from active lists and added to History.")

    # =========================================================================
    # TEST B: Multiple Completed Cases (Verify 14 more -> exactly 15 in History)
    # =========================================================================
    print("\n[TEST B] Completing Final Verification for 14 Additional Cases (Total 15)...")
    for i in range(1, 15):
        sid = session_ids[i]
        st, rev_b = post(f"/api/sessions/{sid}/review", {
            "nurse_id": "RN-Lead-Sarah",
            "action": "accept",
            "reason": f"Clinical handoff verified and documented for patient case #{i+1}.",
        })
        assert st == 200, f"Review failed for {sid}: {rev_b}"

    # Verify counts after Test B
    st, counts_b = get("/api/queue/counts")
    assert counts_b["active"] == initial_active_total - 15, f"Expected {initial_active_total - 15} active cases, got {counts_b['active']}"
    assert counts_b["history"] == 15, f"Expected exactly 15 History cases, got {counts_b['history']}"

    # Ensure no overlap between Active and History lists
    st, active_queue_b = get("/api/queue?filter=active")
    st, history_queue_b = get("/api/queue?filter=history")
    active_set = set(c["id"] for c in active_queue_b)
    history_set = set(c["id"] for c in history_queue_b)
    assert active_set.isdisjoint(history_set), "CRITICAL: The same case must not appear in both active and archived lists"
    assert len(history_set) == 15, f"Expected 15 unique archived cases, got {len(history_set)}"
    print(f"  [PASS] Test B Passed: Active={counts_b['active']}, History={counts_b['history']}. Active and History lists strictly mutually exclusive.")

    # =========================================================================
    # TEST C: Incomplete Verification
    # =========================================================================
    print("\n[TEST C] Testing Incomplete Verification & Bedside Notes Safety...")
    test_c_sid = session_ids[16] # 17th case, currently active
    st, notes_resp = post(f"/api/sessions/{test_c_sid}/nurse-notes", {
        "nurse_id": "RN-Bedside",
        "notes": "Patient resting in triage cubicle 4; vitals stable, awaiting lab results.",
        "mark_reviewed": True,
    })
    assert st == 200

    # Verify case remains in active workflow
    st, counts_c = get("/api/queue/counts")
    assert counts_c["history"] == 15, "Incomplete verification must NOT increase History count"
    assert counts_c["active"] == counts_b["active"], "Active cases must NOT decrease from adding notes"
    st, active_queue_c = get("/api/queue?filter=active")
    assert test_c_sid in [c["id"] for c in active_queue_c], "Case with notes must remain in active queue"
    print("  [PASS] Test C Passed: Adding nurse notes/acknowledgment does NOT archive case; case remains active.")

    # =========================================================================
    # TEST D: Stable Patient Severity Independence
    # =========================================================================
    print("\n[TEST D] Testing Stable Patient Severity Independence...")
    test_d_sid = session_ids[17] # active case
    # Utterance updating symptoms to stable
    st, _ = post(f"/api/sessions/{test_d_sid}/utterance", {
        "text": "My symptoms have completely resolved. No pain, vitals normal.",
        "english_text": "My symptoms have completely resolved. No pain, vitals normal.",
        "language": "en",
    })
    st, sess_d = get(f"/api/sessions/{test_d_sid}")
    # Verify case does NOT automatically archive simply because status is stable
    st, counts_d = get("/api/queue/counts")
    assert counts_d["history"] == 15, "Treating patient as Stable must NOT auto-archive case"
    st, active_queue_d = get("/api/queue?filter=active")
    assert test_d_sid in [c["id"] for c in active_queue_d], "Stable patient without final nurse verification must remain active"
    print("  [PASS] Test D Passed: Stable status alone does NOT archive the case; final verification is mandatory.")

    # =========================================================================
    # TEST E: Persistence Across Page Refreshes and Queries
    # =========================================================================
    print("\n[TEST E] Testing Persistence of Verification & History...")
    # Verify the first archived case
    st, archived_session = get(f"/api/sessions/{first_sid}")
    assert st == 200
    assert archived_session["lifecycle_status"] == "archived"
    assert archived_session["verified_by"] == "RN-Lead-Sarah"

    # Re-query queue and counts multiple times
    st, counts_e1 = get("/api/queue/counts")
    st, counts_e2 = get("/api/queue/counts")
    assert counts_e1["history"] == 15 and counts_e2["history"] == 15
    print("  [PASS] Test E Passed: Archived status permanently persisted; survived repeated queries.")

    # =========================================================================
    # TEST F: Idempotency & Duplicate Request Prevention
    # =========================================================================
    print("\n[TEST F] Testing Idempotency & Duplicate Request Safety...")
    # Resubmit verification on already verified first case
    st1, dup_resp1 = post(f"/api/sessions/{first_sid}/review", {
        "nurse_id": "RN-Lead-Sarah",
        "action": "accept",
        "reason": "Duplicate click attempt",
    })
    st2, dup_resp2 = post(f"/api/sessions/{first_sid}/review", {
        "nurse_id": "RN-Lead-Sarah",
        "action": "accept",
        "reason": "Repeated network submission",
    })
    assert st1 == 200 and st2 == 200
    st, counts_f = get("/api/queue/counts")
    assert counts_f["history"] == 15, "Repeated verification must NOT duplicate historical case counts"
    st, hist_list_f = get("/api/queue?filter=history")
    first_sid_matches = [c for c in hist_list_f if c["id"] == first_sid]
    assert len(first_sid_matches) == 1, "Only exactly one record of the archived case must exist"
    print("  [PASS] Test F Passed: Duplicate submissions handled safely; no duplicate history records created.")

    # =========================================================================
    # TEST G: Failure Handling
    # =========================================================================
    print("\n[TEST G] Testing Failure Handling & Safety Reversions...")
    test_g_sid = session_ids[18]
    # Attempt verification with missing mandatory reason
    st_err, err_resp = post(f"/api/sessions/{test_g_sid}/review", {
        "nurse_id": "RN-Test",
        "action": "accept",
        "reason": "   ",  # Invalid empty reason
    })
    assert st_err == 422, f"Expected validation error 422, got {st_err}"
    # Verify case was NOT archived and remains active
    st, case_g = get(f"/api/sessions/{test_g_sid}")
    assert case_g["lifecycle_status"] == "active", "Case must remain active on failed validation"
    assert case_g["status"] != "verified"
    print("  [PASS] Test G Passed: Incomplete review rejected safely; active case remains in queue.")

    # =========================================================================
    # TEST H: Existing Clinical Functionality Preservation
    # =========================================================================
    print("\n[TEST H] Testing Existing Clinical Functionality & SBAR...")
    st_h, new_sess = post("/api/sessions", {"source": "patient", "language": "te"})
    assert st_h == 200
    h_sid = new_sess["id"]

    # Post Telugu utterance
    st_u, utt_h = post(f"/api/sessions/{h_sid}/utterance", {
        "text": "నాకు తీవ్రమైన ఛాతీ నొప్పి ఉంది.",
        "english_text": "I have severe chest pain and breathlessness.",
        "language": "te",
    })
    assert st_u == 200
    assert "questionnaire" in utt_h

    # Check SBAR generation
    st_sbar, sbar_h = get(f"/api/sessions/{h_sid}/sbar")
    assert st_sbar == 200
    assert "Situation" in sbar_h["sbar"] or "SITUATION" in sbar_h["sbar"]
    assert "Recommendation" in sbar_h["sbar"] or "RECOMMENDATION" in sbar_h["sbar"]

    # Verify and archive
    st_rev_h, _ = post(f"/api/sessions/{h_sid}/review", {
        "nurse_id": "RN-Lead-Sarah",
        "action": "accept",
        "reason": "Cardiac pathway activated.",
    })
    assert st_rev_h == 200

    # Ensure archived case preserves complete bilingual transcripts & SBAR
    st, hist_h = get("/api/queue?filter=history")
    case_in_hist = next(c for c in hist_h if c["id"] == h_sid)
    assert case_in_hist["language"] == "te"
    assert len(case_in_hist["transcripts"]) >= 1
    assert case_in_hist["transcripts"][0]["native"] == "నాకు తీవ్రమైన ఛాతీ నొప్పి ఉంది."
    print("  [PASS] Test H Passed: Bilingual intake, symptom questionnaire, SBAR, and clinical audits preserved.")

    print("\n" + "=" * 75)
    print("ALL TESTS (A, B, C, D, E, F, G, H) PASSED SUCCESSFULLY!")
    print("=" * 75)
    return True

if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)
