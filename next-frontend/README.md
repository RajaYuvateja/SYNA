# SYNA — End-to-End Multilingual Clinical Voice Triage & Nurse Handoff Platform

> **"Every Voice, Understood in Time."**

An accessible, voice-first clinical intake and nurse handoff platform specifically tailored for Indian emergency and outpatient healthcare environments.

---

## ⚠️ Important Safety Notice & Clinical Governance

**SYNA is an assistive intake and structured handoff aid. It is NOT an autonomous diagnostic system.**
- It **does not diagnose diseases**, **prescribe medicines**, **recommend medical treatments**, or **make final triage determinations**.
- It assists with multilingual information capture, translation, extraction, and organization.
- **A qualified nurse or clinician must review, correct, accept, or override every critical field.**
- Synthetic demonstration data is used for interface exploration; not real patient identifiable data.

---

## 🎨 Soft Neumorphic Design System

Designed for emergency and outpatient clinical environments to foster a calm, trustworthy, safe, and focused atmosphere without gaming, sci-fi, or high-contrast neon aesthetics:

- **Background & Primary Surfaces:** `#E8EDF2` (Soft off-white / light cool gray)
- **Primary Action Blue:** `#2563EB`
- **Deep Clinical Blue:** `#1E40AF`
- **Primary Text:** `#172033` (High WCAG AA contrast)
- **Secondary Text:** `#5B6575`
- **Clinical Success:** `#16805B`
- **Clinical Warning / Caution:** `#B7791F`
- **Clinical Emergency / Code Red:** `#C24141`
- **Neumorphic Raised Shadows:** `10px 10px 20px rgba(163, 177, 198, 0.45), -10px -10px 20px rgba(255, 255, 255, 0.9)`
- **Neumorphic Pressed / Inset:** `inset 6px 6px 12px rgba(163, 177, 198, 0.35), inset -6px -6px 12px rgba(255, 255, 255, 0.8)`
- **Border Radius:** 16px to 24px rounded corners (`rounded-2xl`, `rounded-3xl`)
- **Multi-modal Feedback:** Color is **never the sole indicator** of clinical severity. Always accompanied by bold text labels, explicit status badges, and accessible SVG icons.

---

## 🛠️ Technology Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** TypeScript 5 (Strict type contracts)
- **Styling:** Tailwind CSS with custom neumorphic box-shadow extensions
- **Icons:** [Lucide React](https://lucide.dev/)
- **Audio & Speech Capture:** Web Audio API (`AudioContext`, `AnalyserNode`) and `MediaRecorder`
- **Primary Speech-Language Provider:** **Sarvam AI** (`saaras:v1` ASR, `mayura:v1` translation, `bulbul:v1` TTS)
  - *Note:* Bhashini is strictly forbidden and not active.
- **Backend Integration Points:** FastAPI endpoints (`http://127.0.0.1:8000`), PostgreSQL & Redis placeholders
- **Offline Reliability:** Local storage and IndexedDB fallback manager (`offlineStorage.ts`)

---

## 📁 Required Application Routes

| Route | View | Description |
|---|---|---|
| `/` | **Landing Page** | Project mission, tagline, route launchers (Patient, Nurse, Paramedic, Audit), language coverage, and clinical safety statement. |
| `/patient` | **Voice Intake Screen** | Large record button, recording timer, Web Audio waveform, pause/resume/stop controls, short sentence guidance, low-confidence retry prompts, typed fallback, emergency nurse help. |
| `/patient/clarify` | **Adaptive Clarification** | One question at a time, large readable text in native language + English, voice answer button, Yes/No/Unsure options, nurse escalation, progress indicator. |
| `/patient/confirm` | **Read-Back Confirmation** | Structured symptom review, confidence labels, read aloud in native language, confirm/correct/repeat actions, queue transmission receipt. |
| `/paramedic` | **Paramedic Fast Intake** | In-transit telemetry: patient demographics, Fast-Code buttons (CODE RED / YELLOW / GREEN), vitals placeholders (SpO2, HR, BP, RR, GCS, BGL), voice dictation, ETA countdown. |
| `/nurse` | **Nurse Command Center** | Priority-filtered case queue (All, Critical, Urgent, Awaiting, Completed), search by name/ID/symptoms, stat metrics, real-time sync indicators. |
| `/nurse/case/[id]` | **Full Structured Handoff** | Patient complaint, symptom timeline, location, severity, history, missing fields, contradiction warnings, rule flags, verbatim audio replay, confidence scores, and clinician verification controls. |
| `/audit` | **Clinical Audit Trail** | Transparent chronological log distinguishing AI drafts, patient confirmations, safety rule evaluations, and nurse overrides with CSV export. |

---

## 🔐 Architecture & Key Security Safeguards

1. **`SarvamClient` Abstraction (`src/lib/sarvam.ts`):**
   - The `SARVAM_API_KEY` is **never exposed** in client-side bundles.
   - Client calls route through `/api/sarvam/*` server-side endpoints or realistic offline mock fallbacks.
2. **Offline Resilience:**
   - Detects `navigator.onLine` state changes.
   - Automatically stores drafts in local IndexedDB/localStorage when network is interrupted.
   - If language services are down, shows: *"Language service unavailable. Continue with manual entry or request staff assistance."*
3. **Low-Confidence Safeguards:**
   - Responses below confidence thresholds trigger explicit guidance: *"Your response was not clear. Please repeat slowly."*
   - Offers repeat, type an answer, ask a caregiver, or talk to a nurse.
   - **Never silently assumes or converts unclear answers to "No".**
4. **Source Attribution:**
   - Every clinical field is tagged with its provenance:
     - `patient_reported`
     - `ai_extracted`
     - `patient_confirmed`
     - `nurse_corrected`
     - `nurse_confirmed`

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18.17+ or v20+)
- npm or pnpm

### 2. Environment Configuration
Create a `.env.local` file in `next-frontend/` (or copy from `.env.example` in root):
```bash
# Sarvam AI API Gateway (Kept server-side only)
SARVAM_API_KEY=your_sarvam_api_key_here
```
*(If no key is configured, SYNA gracefully operates in high-fidelity demonstration mock mode with regional Indic cases).*

### 3. Installation & Local Development
```bash
# Navigate to the frontend directory
cd next-frontend

# Install dependencies
npm install

# Run the Next.js development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your web browser.

### 4. Production Build Validation
```bash
npm run build
npm run start
```
