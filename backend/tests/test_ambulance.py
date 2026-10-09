import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, SESS

client = TestClient(app)

def test_ambulance_telemetry_flow():
    payload = {
        "chief_complaint": "Acute severe crushing chest pain, diaphoresis, radiating to left arm",
        "eta_minutes": 8,
        "telemetry": {
            "spo2": 88,
            "hr": 125,
            "bp": "150/95"
        },
        "paramedic_unit": "EMS-Unit-108",
        "fast_code": "STEMI"
    }
    response = client.post("/api/ambulance/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "transmitted"
    sid = data["session_id"]
    sess = data["session"]

    assert sess["source"] == "paramedic"
    assert sess["channel"] == "ambulance"
    assert sess["eta_minutes"] == 8
    assert sess["telemetry"]["spo2"] == 88
    assert sess["fast_code"] == "STEMI"
    assert sess["paramedic_unit"] == "EMS-Unit-108"
    assert sess["risk"]["tier"] == "critical"
    assert len(sess["red_flags"]) > 0

    # Test retrieval via GET /api/sessions/{sid}
    get_res = client.get(f"/api/sessions/{sid}")
    assert get_res.status_code == 200
    assert get_res.json()["fast_code"] == "STEMI"

    # Test presence in queue
    q_res = client.get("/api/queue?status=all")
    assert q_res.status_code == 200
    queue_items = q_res.json()
    matching = [x for x in queue_items if x["id"] == sid]
    assert len(matching) == 1
    assert matching[0]["risk"]["tier"] == "critical"
