import json
from fastapi.testclient import TestClient
from backend.app.main import app, SESS

client = TestClient(app)
SESS.clear()

res = client.post("/api/sessions", json={"source": "patient", "language": "te", "channel": "kiosk"})
sid = res.json()["id"]

turns = [
    ("నాకు ఛాతీలో తీవ్రమైన నొప్పిగా ఉంది", "I have severe pain in my chest"),
    ("నొప్పి సుమారు అరగంట క్రితం మొదలైంది", "The pain started about half an hour ago"),
    ("ఈ నొప్పి నా ఎడమ చేతికి వ్యాపిస్తోంది", "This pain is radiating to my left arm"),
    ("నాకు చాలా ఎక్కువగా చల్లని చెమటలు పడుతున్నాయి", "I am sweating heavily with cold sweats"),
    ("నాకు తీవ్రంగా ఆయాసంగా ఉంది, శ్వాస తీసుకోవడం కష్టంగా ఉంది", "I feel severe breathlessness and it is hard to breathe"),
]

results = []
for i, (orig, eng) in enumerate(turns, 1):
    r = client.post(
        f"/api/sessions/{sid}/utterance",
        json={"text": orig, "english_text": eng, "language": "te", "asr_confidence": 0.96},
    ).json()
    q_native = r.get("next_question_native")
    q_en = r.get("next_question_en") or r.get("next_question")
    results.append({
        "turn": i,
        "patient_telugu": orig,
        "patient_english": eng,
        "followup_telugu": q_native,
        "followup_english": q_en,
    })

with open("telugu_test_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("SUCCESS: 5-turn session completed and saved to telugu_test_results.json")
