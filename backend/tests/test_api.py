import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, SESS

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_sessions():
    SESS.clear()
    yield
    SESS.clear()


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"


def test_session_lifecycle():
    # 1. Create session
    res = client.post("/api/sessions", json={"source": "patient", "language": "en", "channel": "kiosk"})
    assert res.status_code == 200
    sid = res.json()["id"]

    # 2. Get session
    res = client.get(f"/api/sessions/{sid}")
    assert res.status_code == 200
    assert res.json()["id"] == sid
    assert res.json()["status"] == "pending_review"

    # 3. Post utterance
    res = client.post(
        f"/api/sessions/{sid}/utterance",
        json={"text": "I have severe chest pain 9/10 with sweating since 30 mins ago", "asr_confidence": 0.95},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["risk"]["tier"] == "critical"
    assert data["emergency"] is True

    # 4. Check queue
    res = client.get("/api/queue")
    assert res.status_code == 200
    q = res.json()
    assert len(q) == 1
    assert q[0]["id"] == sid
    assert q[0]["risk"]["tier"] == "critical"

    # 5. Review / Override by nurse
    res = client.post(
        f"/api/sessions/{sid}/review",
        json={"nurse_id": "RN-442", "action": "accept", "reason": "Confirmed acute coronary syndrome flags"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "verified"
    assert res.json()["final_tier"] == "critical"

    # 6. Check queue filters: pending_review should now be 0, verified should be 1
    res_pending = client.get("/api/queue?status=pending_review")
    assert len(res_pending.json()) == 0

    res_verified = client.get("/api/queue?status=verified")
    assert len(res_verified.json()) == 1


def test_404_error_handling():
    res = client.get("/api/sessions/non-existent-id")
    assert res.status_code == 404

    res = client.post("/api/sessions/non-existent-id/utterance", json={"text": "Hello"})
    assert res.status_code == 404

    res = client.post("/api/sessions/non-existent-id/review", json={"nurse_id": "RN-1", "action": "accept", "reason": "ok"})
    assert res.status_code == 404


def test_seed_cases_endpoint():
    res = client.post("/api/dev/seed")
    assert res.status_code == 200
    assert res.json()["seeded"] == 4

    res_queue = client.get("/api/queue")
    assert len(res_queue.json()) == 4


def test_multilingual_confirmations():
    # Test Telugu, Tamil, Hindi, Kannada, Malayalam, Bengali affirmations
    indic_words = ["avunu", "అవును", "aama", "ஆமா", "haan", "हाँ", "houdu", "ಹೌದು", "athe", "hyan", "ho", "yes"]
    for word in indic_words:
        # Create session
        c_res = client.post("/api/sessions", json={"source": "patient", "language": "te"})
        sid = c_res.json()["id"]

        # Confirm with Indic affirmation
        conf_res = client.post(f"/api/sessions/{sid}/confirm", json={"text": word})
        assert conf_res.status_code == 200
        assert conf_res.json()["confirmed"] is True
        assert conf_res.json()["status"] == "intake_complete"

