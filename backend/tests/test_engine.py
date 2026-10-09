import pytest
from backend.app import engine


def test_new_session_defaults():
    s = engine.new_session(source="patient", language="en")
    assert s["source"] == "patient"
    assert s["language"] == "en"
    assert s["status"] == "pending_review"
    assert s["transcripts"] == []
    assert isinstance(s["entities"], dict)
    assert s["entities"]["symptoms"] == []
    assert s["gaps"] == []
    assert s["contradictions"] == []
    assert s["red_flags"] == []


def test_extract_symptoms_and_severity():
    text = "My husband has severe chest pain, 9/10, radiating to jaw and sweating"
    e = engine.extract(text)
    assert "chest pain" in e["symptoms"]
    assert "sweating" in e["symptoms"]
    assert "jaw pain" in e["symptoms"]
    assert e["severity"] == 9
    assert e["chief_complaint"] == "chest pain"


def test_extract_aggravating_no_duplicates():
    text1 = "It is worse when on walking"
    e = engine.extract(text1)
    assert e["aggravating"] == ["exertion"]
    text2 = "Also worse when on exertion"
    e2 = engine.extract(text2, prior=e)
    # Check that duplicates are prevented
    assert e2["aggravating"].count("exertion") == 1


def test_contradictions_detection():
    turns = [
        "I have difficulty breathing, it started yesterday, 6/10",
        "I am gasping and cannot speak a full sentence, it started 2 hours ago",
    ]
    contras = engine.contradictions(turns)
    assert len(contras) == 1
    assert contras[0]["field"] == "onset"
    assert "clarification" in contras[0]


def test_red_flags():
    # Cardiac red flag
    e1 = engine.extract("Chest pain with severe sweating and left arm pain")
    flags1 = engine.red_flags(e1, "Chest pain with severe sweating and left arm pain")
    assert any("cardiac-type" in f for f in flags1)

    # Trauma red flag
    e2 = engine.extract("Road accident crash, patient is unconscious and heavy bleeding")
    flags2 = engine.red_flags(e2, "Road accident crash, patient is unconscious and heavy bleeding")
    assert any("Uncontrolled haemorrhage" in f or "trauma" in f for f in flags2)


def test_risk_scoring():
    e = {"symptoms": ["chest pain", "sweating"], "severity": 9, "age": 55, "progression": "worsening", "onset_text": "30 mins ago"}
    flags = ["Acute chest pain with associated cardiac-type symptoms"]
    r = engine.risk(e, flags, source="patient", asr_conf=0.9)
    assert r["tier"] == "critical"
    assert r["is_emergency"] is True
    assert r["score"] >= 100
    assert "CRITICAL" in r["reasoning"]


def test_apply_override_validation():
    s = engine.new_session()
    # Should fail if session has no risk assessment
    with pytest.raises(ValueError, match="no risk assessment"):
        engine.apply_override(s, nurse_id="RN-101", action="accept", new_tier=None, reason="Confirmed")

    # Now add risk
    s["risk"] = {"tier": "urgent", "score": 60, "confidence": 0.85, "reasoning": "Urgent"}
    # Should fail if nurse_id is missing
    with pytest.raises(ValueError, match="nurse_id is required"):
        engine.apply_override(s, nurse_id="", action="accept", new_tier=None, reason="Confirmed")

    # Should fail if reason is missing
    with pytest.raises(ValueError, match="reason is required"):
        engine.apply_override(s, nurse_id="RN-101", action="accept", new_tier=None, reason="")

    # Should fail if override has invalid tier
    with pytest.raises(ValueError, match="new_tier must be one of"):
        engine.apply_override(s, nurse_id="RN-101", action="override", new_tier="bogus", reason="Doctor decision")

    # Successful escalation
    res = engine.apply_override(s, nurse_id="RN-101", action="escalate", new_tier=None, reason="Patient vitals dropping")
    assert res["status"] == "verified"
    assert res["final_tier"] == "critical"
    assert len(res["audit"]) == 1
    assert res["audit"][0]["nurse_id"] == "RN-101"
