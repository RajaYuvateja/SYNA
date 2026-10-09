# Multilingual Clinical Voice Triage & Nurse Handoff

**Safety principle:** The system never diagnoses, prescribes, or recommends treatment. It collects symptoms, detects protocol gaps and contradictions, calculates triage priority tiers with clinical reasoning explanations, and hands off to nurses, who make every final decision. All clinical overrides require Nurse ID + reason and are permanently audit-logged.

---

## 📁 Clean Architecture

The codebase is organized into **Frontend** and **Backend** directories:

```text
clinical-triage/
├── frontend/                     # Modern Web UI & Intake Portal
│   ├── index.html                # Nurse Triage Command Dashboard
│   ├── patient.html              # Multilingual Patient / Paramedic Intake Portal
│   ├── css/
│   │   ├── dashboard.css         # Glassmorphism medical UI design system
│   │   └── patient.css           # Calming, accessible intake styling
│   └── js/
│       ├── dashboard.js          # Live WebSocket queue sync, SBAR handoff, review modal
│       └── patient.js            # Audio waveform visualizer, client VAD, bilingual dialogue
│
├── backend/                      # Python FastAPI Triage Service
│   ├── app/
│   │   ├── main.py               # FastAPI server, REST & WebSocket orchestration
│   │   ├── engine.py             # Deterministic clinical triage engine (Stages 2-9, 11, 12)
│   │   ├── groq_client.py        # GroqCloud LLM entity extraction & Whisper speech
│   │   └── config.py             # App environment configuration & settings
│   ├── speech_gateway/
│   │   └── clients.py            # Sarvam AI, Google Translate, Groq Whisper ASR router & dev fallbacks
│   ├── database/
│   │   ├── schema.sql            # PostgreSQL schema with audit logs and metrics
│   │   ├── seed.py               # Multi-turn multilingual verification script
│   │   └── seed_cases.json       # 4 clinical seed cases (Telugu, Tamil, Hindi, Kannada)
│   ├── tests/
│   │   ├── test_engine.py        # Unit tests for scoring, red flags, contradictions
│   │   └── test_api.py           # Integration tests for FastAPI endpoints & queue filters
│   └── requirements.txt          # Python dependencies
│
├── start_server.py               # Single-command launcher
├── .env.example                  # Environment template
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Verify Clinical Logic & Seed Cases
Run the 4 multilingual clinical test cases (Telugu cardiac, Tamil pediatric fever, Hindi trauma, Kannada respiratory):
```bash
python backend/database/seed.py
```

### 3. Run Test Suite
```bash
python -m pytest backend/tests/
```

### 4. Start the Application
Run the launcher:
```bash
python start_server.py
```
Or with uvicorn:
```bash
uvicorn backend.app.main:app --reload
```

- **Nurse Command Dashboard:** [http://localhost:8000/](http://localhost:8000/)
- **Patient Intake Portal:** [http://localhost:8000/patient.html](http://localhost:8000/patient.html)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ⚡ GroqCloud Integration (LLM & Whisper)

GroqCloud provides ultra-low latency inference for clinical entity extraction and multilingual speech transcription:
- **LLM Clinical Parser:** `llama-3.3-70b-versatile` (or `llama-3.1-8b-instant`) extracts symptoms, severity, and onset in JSON format.
- **Whisper Speech-to-Text:** `whisper-large-v3` transcribes audio streams with sub-second response times.

To enable GroqCloud, set your API key in `.env`:
```bash
GROQ_API_KEY="gsk_your_groq_api_key_here"
GROQ_MODEL="llama-3.3-70b-versatile"
```
When `GROQ_API_KEY` is provided, the triage engine automatically switches to Groq LLM parsing and Whisper ASR. If the key is unset, the engine runs in 100% deterministic heuristic mode with dev fallbacks.

---

## 🩺 Pipeline Overview

1. **ASR (Speech-to-Text)**: Audio route $\rightarrow$ Sarvam AI (native Indic & code-mixed) / Groq Whisper (dev fallback available).
2. **Entity Extraction**: Heuristic extraction of symptoms, age, severity (1-10), progression, and onset.
3. **Protocol Gap Analysis**: Detects unasked clinical questions (e.g. pain radiation, sweating, dyspnea).
4. **Clarification Question**: Generates single prioritized follow-up question in native language.
5. **Timeline Reconstruction**: Normalizes time expressions into chronological events.
6. **Contradiction Detection**: Detects onset and severity discrepancies between turns.
7. **Red Flag Detection**: Identifies critical conditions (e.g. cardiac symptoms with radiation, trauma, respiratory distress).
8. **Priority Tier Assignment**: Scores risk and computes tier (`critical`, `urgent`, `concerning`, `stable`).
9. **Reasoning & Confidence**: Generates explainable rationale scaled by ASR confidence and reporter source.
10. **Bilingual Readback & Confirmation**: Translates summary into patient language and prompts confirmation.
11. **SBAR Clinical Handoff Note**: Structured summary prepared for bedside medical staff.
12. **Nurse Review & Override**: Nurse verifies or overrides priority (mandatory Nurse ID + reason audit log).
13. **Real-time Live Sync**: Pushes verified status to nurse dashboard via WebSocket.

---

## 💻 Modern Next.js 14 Frontend Port

A complete Next.js 14 TypeScript & Tailwind CSS port is available in `next-frontend/`:

```bash
cd next-frontend
npm install
npm run dev
```

The Next.js 14 application runs on [http://localhost:3000](http://localhost:3000):
- **Command Center Dashboard:** [http://localhost:3000/](http://localhost:3000/)
- **Patient & Paramedic Intake Portal:** [http://localhost:3000/patient](http://localhost:3000/patient)

Features:
- Live WebSocket queue streaming
- High-visibility In-Transit Ambulance Alert Banner (SpO2, HR, BP, ETA)
- Interactive Nurse Review Modal with mandatory audit justifications
- SBAR Handoff note with 1-click clipboard copy
- Analytics & Operations Modal (`GET /api/analytics`)
- Voice recording interface with HTML5 Audio waveform visualizer

---

## 🧪 Comprehensive Automated Test Suite

Run the full suite of 25 unit and integration tests:
```bash
python -m pytest backend/tests/
```
All 25 tests pass (100% success rate):
- `test_ambulance.py`: Paramedic fast-intake, telemetry streaming, pre-arrival hospital alerts
- `test_analytics.py`: Operations metrics (avg seconds to tier, override rate, ASR confidence)
- `test_api.py`: FastAPI endpoints, session lifecycle, queue filters, multilingual Indic confirmations
- `test_engine.py`: Deterministic scoring, red flags, contradictions, timeline
- `test_groq.py`: GroqCloud LLM parsing, semantic contradictions, follow-up questions
- `test_persistence.py`: Dual persistence (PostgreSQL / SQLite + Redis)
- `test_sarvam.py`: Sarvam AI speech models (`saaras:v3`, `saarika:v2.5`, `bulbul:v3`)

