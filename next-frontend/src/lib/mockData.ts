/**
 * SYNA — Multilingual Clinical Voice Triage & Nurse Handoff Platform
 * Realistic Synthetic Clinical Cases for UI Demonstration
 * 
 * DISCLAIMER:
 * Synthetic demonstration data — not real patient data.
 * SYNA provides assistive intake and structured handoff support.
 * It does not replace professional medical judgment.
 */

import { LanguageOption, SynaPatientCase, ClarifyingQuestion, RegionalLanguage } from "@/types/syna";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", flag: "🇮🇳" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", flag: "🇮🇳" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "en", label: "English", nativeLabel: "English", flag: "🌐" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", flag: "🇮🇳" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", flag: "🇮🇳" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳" },
];

export const MOCK_CLINICAL_CASES: SynaPatientCase[] = [
  {
    id: "case-syna-101",
    patientId: "PAT-TE-8402",
    patientName: "K. Venkatesh (Demonstration)",
    age: 58,
    gender: "M",
    preferredLanguage: "te",
    source: "patient",
    channel: "kiosk",
    createdAt: "2026-10-10T00:15:00.000Z",
    updatedAt: "2026-10-10T00:22:00.000Z",
    submittedAt: "2026-10-10T00:22:00.000Z",

    chiefComplaint: {
      value: "Severe crushing retrosternal chest pain with left arm radiation",
      source: "patient_confirmed",
      confidence: 0.94,
      confidenceLevel: "high",
      originalText: "నాకు ఛాతీ మధ్యలో బండరాయి పెట్టినట్లు తీవ్రమైన నొప్పి ఉంది. ఎడమ చేతికి పాకుతోంది.",
      translatedText: "I have severe crushing pain in the center of my chest like a heavy stone. It is radiating to my left arm.",
    },
    severity: {
      value: 9,
      source: "patient_confirmed",
      confidence: 0.96,
      confidenceLevel: "high",
      originalText: "నొప్పి 10 కి 9 తీవ్రతతో ఉంది, చల్లని చెమటలు పడుతున్నాయి.",
      translatedText: "Pain is 9 out of 10, cold sweats are profuse.",
    },
    onsetText: {
      value: "Sudden onset ~45 minutes ago during light walking",
      source: "ai_extracted",
      confidence: 0.88,
      confidenceLevel: "high",
      originalText: "దాదాపు 45 నిమిషాల క్రితం అకస్మాత్తుగా మొదలైంది.",
      translatedText: "Started suddenly approximately 45 minutes ago.",
    },
    location: {
      value: "Retrosternal / Precordial radiating to left arm and jaw",
      source: "ai_extracted",
      confidence: 0.92,
      confidenceLevel: "high",
    },
    associatedSymptoms: {
      value: ["Profuse diaphoresis (cold sweat)", "Shortness of breath", "Dizziness", "Nausea"],
      source: "patient_confirmed",
      confidence: 0.91,
      confidenceLevel: "high",
    },
    relevantHistory: {
      value: "Known Hypertension (5 years on Amlodipine), Type 2 Diabetes Mellitus",
      source: "patient_reported",
      confidence: 0.85,
      confidenceLevel: "high",
    },

    ruleFlags: [
      {
        id: "rf-101-1",
        category: "cardiovascular",
        title: "Suspected Acute Coronary Syndrome (ACS)",
        description: "Crushing chest pain radiating to left arm accompanied by diaphoresis and dyspnea in a 58yo diabetic male.",
        protocolWarning: "STAT 12-lead ECG within 10 minutes. Continuous telemetry and Bedside Cardiac Troponin protocol mandatory.",
        severity: "critical",
        timestamp: "2026-10-10T00:16:30.000Z",
        isHardSafetyNet: true,
      },
    ],
    contradictions: [],
    missingFields: ["Recent aspirin intake status", "Exact prior cardiac history documentation"],
    evidenceSnippets: [
      {
        id: "ev-101-1",
        turnIndex: 1,
        durationSeconds: 12,
        nativeText: "నాకు ఛాతీ మధ్యలో బండరాయి పెట్టినట్లు తీవ్రమైన నొప్పి ఉంది. ఎడమ చేతికి పాకుతోంది.",
        englishText: "I have severe crushing pain in the center of my chest like a heavy stone. It is radiating to my left arm.",
        language: "te",
        asrConfidence: 0.94,
        timestamp: "2026-10-10T00:15:30.000Z",
      },
      {
        id: "ev-101-2",
        turnIndex: 2,
        durationSeconds: 8,
        nativeText: "చల్లని చెమటలు పడుతున్నాయి, ఆయాసం వస్తోంది.",
        englishText: "Cold sweating profusely, feeling breathless.",
        language: "te",
        asrConfidence: 0.92,
        timestamp: "2026-10-10T00:17:15.000Z",
      },
    ],
    timeline: [
      { id: "tl-1", timeframe: "00:00 (45m prior)", event: "Sudden onset substernal tightness", severityAtTime: 6 },
      { id: "tl-2", timeframe: "+20 mins", event: "Pain intensified to 9/10, radiating to left arm with diaphoresis", severityAtTime: 9 },
      { id: "tl-3", timeframe: "+45 mins", event: "Arrived at triage kiosk accompanied by family", severityAtTime: 9 },
    ],

    provisionalPriority: "critical",
    aiTriageScore: 88,
    aiConfidence: 0.93,
    aiReasoning: "High-risk cardiac presentation meeting universal criteria for immediate ACS evaluation.",

    reviewStatus: "awaiting_review",
    nurseNotes: "",
    lifecycleStatus: "active",

    auditTrail: [
      {
        id: "aud-101-1",
        caseId: "case-syna-101",
        timestamp: "2026-10-10T00:15:30.000Z",
        actor: "patient",
        eventType: "audio_captured",
        details: "Voice statement captured in Telugu (12s, 16kHz audio)",
      },
      {
        id: "aud-101-2",
        caseId: "case-syna-101",
        timestamp: "2026-10-10T00:15:32.000Z",
        actor: "sarvam_ai",
        eventType: "transcription_generated",
        details: "Sarvam Speech-to-Text transcribed native Telugu with 94% confidence.",
      },
      {
        id: "aud-101-3",
        caseId: "case-syna-101",
        timestamp: "2026-10-10T00:15:35.000Z",
        actor: "sarvam_ai",
        eventType: "entity_extracted",
        details: "Extracted: retrosternal chest pain (9/10), left arm radiation, diaphoresis.",
      },
      {
        id: "aud-101-4",
        caseId: "case-syna-101",
        timestamp: "2026-10-10T00:16:30.000Z",
        actor: "rule_engine",
        eventType: "rule_flag_triggered",
        details: "Rule Safety Net triggered: Suspected Acute Coronary Syndrome (ACS). Provisional Priority elevated to CRITICAL.",
      },
    ],
  },

  {
    id: "case-syna-102",
    patientId: "PAT-TA-5129",
    patientName: "Master Kavin (Demonstration)",
    age: 4,
    gender: "M",
    preferredLanguage: "ta",
    source: "caregiver",
    channel: "mobile",
    createdAt: "2026-10-10T00:25:00.000Z",
    updatedAt: "2026-10-10T00:31:00.000Z",
    submittedAt: "2026-10-10T00:31:00.000Z",

    chiefComplaint: {
      value: "High-grade fever (103°F) for 3 days with reduced oral intake and lethargy",
      source: "patient_confirmed",
      confidence: 0.91,
      confidenceLevel: "high",
      originalText: "குழந்தைக்கு 3 நாளாக அதிக காய்ச்சல் இருக்கு. சாப்பிட மறுக்கிறான், தூங்கிக்கொண்டே இருக்கிறான்.",
      translatedText: "Child has high fever for 3 days. Refusing feeds, very drowsy and sleeping constantly.",
    },
    severity: {
      value: 7,
      source: "patient_confirmed",
      confidence: 0.88,
      confidenceLevel: "high",
    },
    onsetText: {
      value: "3 days duration, worsening lethargy today morning",
      source: "ai_extracted",
      confidence: 0.86,
      confidenceLevel: "high",
    },
    location: {
      value: "Systemic fever; no localized rash reported",
      source: "ai_extracted",
      confidence: 0.82,
      confidenceLevel: "medium",
    },
    associatedSymptoms: {
      value: ["Vomiting twice today", "Decreased urine output (<3 wet diapers in 24h)", "Dry lips"],
      source: "patient_confirmed",
      confidence: 0.89,
      confidenceLevel: "high",
    },
    relevantHistory: {
      value: "Up to date with national immunization schedule; no previous febrile seizures",
      source: "patient_reported",
      confidence: 0.92,
      confidenceLevel: "high",
    },

    ruleFlags: [
      {
        id: "rf-102-1",
        category: "pediatric",
        title: "Pediatric Moderate Dehydration & Lethargy Warning",
        description: "4-year-old with persistent high fever, oliguria, and altered activity level.",
        protocolWarning: "Assess hydration status immediately, check capillary refill time and fontanelle/mucosa. Pediatrician review required.",
        severity: "urgent",
        timestamp: "2026-10-10T00:26:15.000Z",
        isHardSafetyNet: true,
      },
    ],
    contradictions: [],
    missingFields: ["Temperature measurement at home (exact method)", "Presence of stiff neck or photophobia"],
    evidenceSnippets: [
      {
        id: "ev-102-1",
        turnIndex: 1,
        durationSeconds: 15,
        nativeText: "குழந்தைக்கு 3 நாளாக அதிக காய்ச்சல் இருக்கு. சாப்பிட மறுக்கிறான், தூங்கிக்கொண்டே இருக்கிறான்.",
        englishText: "Child has high fever for 3 days. Refusing feeds, very drowsy and sleeping constantly.",
        language: "ta",
        asrConfidence: 0.91,
        timestamp: "2026-10-10T00:25:40.000Z",
      },
    ],
    timeline: [
      { id: "tl-201", timeframe: "Day 1", event: "Mild fever (100°F), normal activity", severityAtTime: 3 },
      { id: "tl-202", timeframe: "Day 2", event: "Fever spiked to 102.5°F, mild cough", severityAtTime: 5 },
      { id: "tl-203", timeframe: "Day 3 (Today)", event: "Fever 103°F, lethargic, 2 episodes of vomiting, minimal urine", severityAtTime: 7 },
    ],

    provisionalPriority: "urgent",
    aiTriageScore: 68,
    aiConfidence: 0.89,
    aiReasoning: "Pediatric systemic febrile illness with markers of moderate dehydration and decreased responsiveness.",

    reviewStatus: "awaiting_review",
    nurseNotes: "",
    lifecycleStatus: "active",

    auditTrail: [
      {
        id: "aud-102-1",
        caseId: "case-syna-102",
        timestamp: "2026-10-10T00:25:40.000Z",
        actor: "patient",
        eventType: "audio_captured",
        details: "Mother provided voice statement in Tamil via mobile intake.",
      },
      {
        id: "aud-102-2",
        caseId: "case-syna-102",
        timestamp: "2026-10-10T00:25:43.000Z",
        actor: "sarvam_ai",
        eventType: "transcription_generated",
        details: "Sarvam Speech recognition translated Tamil colloquial idioms to clinical English.",
      },
    ],
  },

  {
    id: "case-syna-103",
    patientId: "PAT-HI-9241",
    patientName: "Rahul Sharma (Demonstration)",
    age: 26,
    gender: "M",
    preferredLanguage: "hi",
    source: "paramedic",
    channel: "ambulance",
    createdAt: "2026-10-10T00:35:00.000Z",
    updatedAt: "2026-10-10T00:39:00.000Z",
    submittedAt: "2026-10-10T00:39:00.000Z",

    chiefComplaint: {
      value: "Road traffic accident (two-wheeler skid) with scalp laceration, brief LOC, and severe right ankle deformity",
      source: "patient_reported",
      confidence: 0.95,
      confidenceLevel: "high",
      originalText: "बाइक फिसल गई थी, सिर में 4 सेमी का घाव है, कुछ सेकंड के लिए बेहोश हुआ था, पैर मुड़ गया है।",
      translatedText: "Bike skidded, 4cm scalp laceration, loss of consciousness for a few seconds, severe right ankle deformity.",
    },
    severity: {
      value: 8,
      source: "patient_confirmed",
      confidence: 0.94,
      confidenceLevel: "high",
    },
    onsetText: {
      value: "Trauma occurred 25 minutes prior on National Highway",
      source: "ai_extracted",
      confidence: 0.92,
      confidenceLevel: "high",
    },
    location: {
      value: "Occipital scalp, right lower extremity (ankle/distal fibula)",
      source: "ai_extracted",
      confidence: 0.95,
      confidenceLevel: "high",
    },
    associatedSymptoms: {
      value: ["Nausea", "Dizziness", "Right leg inability to bear weight", "Mild neck soreness"],
      source: "patient_confirmed",
      confidence: 0.9,
      confidenceLevel: "high",
    },
    relevantHistory: {
      value: "No past chronic medical illnesses. Wearing helmet at time of impact.",
      source: "patient_reported",
      confidence: 0.93,
      confidenceLevel: "high",
    },

    ruleFlags: [
      {
        id: "rf-103-1",
        category: "trauma",
        title: "Head Trauma with Documented Loss of Consciousness",
        description: "Post-traumatic brief loss of consciousness, persistent nausea, and scalp laceration.",
        protocolWarning: "C-Spine immobilization maintained. GCS monitoring every 15 mins. Non-contrast Brain CT protocol standby.",
        severity: "urgent",
        timestamp: "2026-10-10T00:36:10.000Z",
        isHardSafetyNet: true,
      },
    ],
    contradictions: [],
    missingFields: ["Tetanus toxoid vaccination within 5 years", "Blood alcohol screening status"],
    evidenceSnippets: [
      {
        id: "ev-103-1",
        turnIndex: 1,
        durationSeconds: 14,
        nativeText: "बाइक फिसल गई थी, सिर में 4 सेमी का घाव है, कुछ सेकंड के लिए बेहोश हुआ था, पैर मुड़ गया है।",
        englishText: "Bike skidded, 4cm scalp laceration, loss of consciousness for a few seconds, right leg injured.",
        language: "hi",
        asrConfidence: 0.95,
        timestamp: "2026-10-10T00:35:45.000Z",
      },
    ],
    timeline: [
      { id: "tl-301", timeframe: "00:00 (25m ago)", event: "Two-wheeler collision with helmet impact; brief LOC ~30s", severityAtTime: 8 },
      { id: "tl-302", timeframe: "+10 mins", event: "Paramedic unit EMS-04 on scene: pressure bandage to scalp, right leg splinted", severityAtTime: 7 },
      { id: "tl-303", timeframe: "+25 mins", event: "En route in ambulance; pre-arrival alert transmitted to hospital", severityAtTime: 7 },
    ],
    paramedicTelemetry: {
      unitId: "EMS-04 (Apex Trauma Unit)",
      etaMinutes: 7,
      fastCode: "CODE YELLOW",
      vitals: {
        spo2: 98,
        hr: 104,
        bp: "132/84",
        respiratoryRate: 18,
        gcs: 14,
      },
      interventionsGiven: ["Cervical collar applied", "Sterile scalp pressure dressing", "Right ankle vacuum splint", "IV access 18G left forearm (Normal Saline 100ml/hr)"],
      paramedicNotes: "Pupils equal and reactive (3mm). GCS 14 (E4 V4 M6 due to mild disorientation to time).",
      transmittedAt: "2026-10-10T00:37:00.000Z",
    },

    provisionalPriority: "urgent",
    aiTriageScore: 72,
    aiConfidence: 0.94,
    aiReasoning: "Acute poly-trauma with documented head impact / LOC and closed musculoskeletal extremity deformity.",

    reviewStatus: "awaiting_review",
    nurseNotes: "",
    lifecycleStatus: "active",

    auditTrail: [
      {
        id: "aud-103-1",
        caseId: "case-syna-103",
        timestamp: "2026-10-10T00:37:00.000Z",
        actor: "paramedic",
        actorId: "EMS-04",
        eventType: "audio_captured",
        details: "Paramedic voice dictation captured in Hindi en route to emergency department.",
      },
      {
        id: "aud-103-2",
        caseId: "case-syna-103",
        timestamp: "2026-10-10T00:37:10.000Z",
        actor: "rule_engine",
        eventType: "rule_flag_triggered",
        details: "C-Spine and Head Trauma clinical protocol alert activated.",
      },
    ],
  },

  {
    id: "case-syna-104",
    patientId: "PAT-KN-6782",
    patientName: "Ananya Gowda (Demonstration)",
    age: 46,
    gender: "F",
    preferredLanguage: "kn",
    source: "patient",
    channel: "kiosk",
    createdAt: "2026-10-10T00:40:00.000Z",
    updatedAt: "2026-10-10T00:45:00.000Z",
    submittedAt: "2026-10-10T00:45:00.000Z",

    chiefComplaint: {
      value: "Acute exacerbation of asthma with severe wheezing, breathlessness at rest, and inability to speak full sentences",
      source: "patient_confirmed",
      confidence: 0.92,
      confidenceLevel: "high",
      originalText: "ಉಸಿರಾಡಲು ತುಂಬಾ ಕಷ್ಟವಾಗುತ್ತಿದೆ... ಸೀಟಿ ಹೊಡೆದ ಹಾಗೆ ಶಬ್ದ ಬರುತ್ತಿದೆ... ಮಾತಾಡಲು ಆಗುತ್ತಿಲ್ಲ.",
      translatedText: "Very difficult to breathe... wheezing sound like a whistle... cannot speak full sentences.",
    },
    severity: {
      value: 8,
      source: "patient_confirmed",
      confidence: 0.95,
      confidenceLevel: "high",
    },
    onsetText: {
      value: "Began 2 hours ago, escalated after dust exposure",
      source: "ai_extracted",
      confidence: 0.89,
      confidenceLevel: "high",
    },
    location: {
      value: "Bilateral chest tightness / diffuse wheeze",
      source: "ai_extracted",
      confidence: 0.91,
      confidenceLevel: "high",
    },
    associatedSymptoms: {
      value: ["Audible wheezing", "Accessory muscle use (intercostal retractions)", "Dry irritating cough"],
      source: "patient_confirmed",
      confidence: 0.9,
      confidenceLevel: "high",
    },
    relevantHistory: {
      value: "Chronic bronchial asthma since age 12; Salbutamol MDI inhaler finished yesterday",
      source: "patient_reported",
      confidence: 0.94,
      confidenceLevel: "high",
    },

    ruleFlags: [
      {
        id: "rf-104-1",
        category: "respiratory",
        title: "Severe Respiratory Distress / Acute Asthma Exacerbation",
        description: "Patient speaking in broken words with audible wheezing and accessory muscle retractions.",
        protocolWarning: "STAT SpO2 pulse oximetry, immediate Salbutamol + Ipratropium nebulization protocol and physician notification.",
        severity: "critical",
        timestamp: "2026-10-10T00:41:20.000Z",
        isHardSafetyNet: true,
      },
    ],
    contradictions: [],
    missingFields: ["Peak expiratory flow rate baseline", "Current steroid prescription status"],
    evidenceSnippets: [
      {
        id: "ev-104-1",
        turnIndex: 1,
        durationSeconds: 10,
        nativeText: "ಉಸಿರಾಡಲು ತುಂಬಾ ಕಷ್ಟವಾಗುತ್ತಿದೆ... ಸೀಟಿ ಹೊಡೆದ ಹಾಗೆ ಶಬ್ದ ಬರುತ್ತಿದೆ... ಮಾತಾಡಲು ಆಗುತ್ತಿಲ್ಲ.",
        englishText: "Very difficult to breathe... whistling sound... unable to speak.",
        language: "kn",
        asrConfidence: 0.92,
        timestamp: "2026-10-10T00:40:40.000Z",
      },
    ],
    timeline: [
      { id: "tl-401", timeframe: "2 hours ago", event: "Dust exposure during house cleaning, onset of dry cough", severityAtTime: 4 },
      { id: "tl-402", timeframe: "1 hour ago", event: "Shortness of breath developed; unable to locate inhaler", severityAtTime: 6 },
      { id: "tl-403", timeframe: "Now", event: "Triage kiosk intake: speaking in 2-word phrases with loud expiratory wheeze", severityAtTime: 8 },
    ],

    provisionalPriority: "critical",
    aiTriageScore: 84,
    aiConfidence: 0.92,
    aiReasoning: "Imminent risk of respiratory exhaustion in asthmatic unable to complete full sentences.",

    reviewStatus: "awaiting_review",
    nurseNotes: "",
    lifecycleStatus: "active",

    auditTrail: [
      {
        id: "aud-104-1",
        caseId: "case-syna-104",
        timestamp: "2026-10-10T00:40:40.000Z",
        actor: "patient",
        eventType: "audio_captured",
        details: "Voice sample captured in Kannada at triage kiosk.",
      },
      {
        id: "aud-104-2",
        caseId: "case-syna-104",
        timestamp: "2026-10-10T00:41:20.000Z",
        actor: "rule_engine",
        eventType: "rule_flag_triggered",
        details: "Respiratory emergency protocol activated.",
      },
    ],
  },
];

export interface SymptomQuestionTemplate {
  id: string;
  category: string;
  textEn: string;
  translations: Record<string, string>;
  options?: string[];
  redFlagIfYes?: boolean;
}

export const CLINICAL_QUESTION_TEMPLATES: Record<string, SymptomQuestionTemplate[]> = {
  headache: [
    {
      id: "q-headache-thunderclap",
      category: "neurological",
      textEn: "Did your headache begin suddenly and become extremely severe within seconds (like a thunderclap)?",
      translations: {
        hi: "क्या आपका सिरदर्द अचानक शुरू हुआ और कुछ ही सेकंड में बहुत गंभीर हो गया?",
        te: "మీ తలనొప్పి అకస్మాత్తుగా ప్రారంభమై కొద్ది సెకన్లలోనే విపరీతంగా తీవ్రమైందా?",
        ta: "உங்கள் தலைவலி திடீரென்று தொடங்கி சில வினாடிகளில் மிகவும் கடுமையானதா?",
        kn: "ನಿಮ್ಮ ತಲೆನೋವು ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಪ್ರಾರಂಭವಾಗಿ ಕೆಲವೇ ಸೆಕೆಂಡುಗಳಲ್ಲಿ ತೀವ್ರವಾಯಿತೇ?",
        en: "Did your headache begin suddenly and become extremely severe within seconds (like a thunderclap)?",
      },
      options: ["Yes, sudden severe onset", "No, built up gradually", "Not sure"],
      redFlagIfYes: true,
    },
    {
      id: "q-headache-fever-neck",
      category: "infection",
      textEn: "Do you have a high fever or stiff neck along with the headache?",
      translations: {
        hi: "क्या सिरदर्द के साथ तेज बुखार या गर्दन में अकड़न है?",
        te: "తలనొప్పితో పాటు తీవ్ర జ్వరం లేదా మెడ పట్టేయడం (స్టిఫ్ నెక్) ఉందా?",
        ta: "தலைவலியுடன் அதிக காய்ச்சல் அல்லது கழுத்து விறைப்பு உள்ளதா?",
        kn: "ತಲೆನೋವಿನೊಂದಿಗೆ ತೀವ್ರ ಜ್ವರ ಅಥವಾ ಕುತ್ತಿಗೆ ಬಿಗಿತವಿದೆಯೇ?",
        en: "Do you have a high fever or stiff neck along with the headache?",
      },
      options: ["Yes, fever with neck stiffness", "Fever only", "No fever or stiffness"],
      redFlagIfYes: true,
    },
    {
      id: "q-headache-vision",
      category: "visual",
      textEn: "Are you experiencing new vision problems, blurring, or light sensitivity?",
      translations: {
        hi: "क्या आपको दृष्टि धुंधली होना या रोशनी से परेशानी महसूस हो रही है?",
        te: "మీకు కొత్తగా కంటి చూపు మసకబారడం, చూపు తగ్గడం లేదా వెలుతురు చూడలేకపోవడం ఉందా?",
        ta: "புதிய பார்வை மங்கலாகுதல் அல்லது வெளிச்சத்தைப் பார்க்க முடியாத நிலை உள்ளதா?",
        kn: "ಹೊಸದಾಗಿ ದೃಷ್ಟಿ ಮಸುಕಾಗುವುದು ಅಥವಾ ಬೆಳಕಿನ ಸೂಕ್ಷ್ಮತೆ ಇದೆಯೇ?",
        en: "Are you experiencing new vision problems, blurring, or light sensitivity?",
      },
      options: ["Yes, blurred vision", "Sensitivity to light", "No vision issues"],
    },
    {
      id: "q-headache-neuro",
      category: "neurological",
      textEn: "Do you have new weakness, numbness, difficulty speaking, or confusion?",
      translations: {
        hi: "क्या एक तरफ कमजोरी, सुन्नता, बोलने में कठिनाई या भ्रम महसूस हो रहा है?",
        te: "ఒకవైపు శరీరంలో బలహీనత, తిమ్మిరి, మాట్లాడటంలో ఇబ్బంది లేదా అయోమయం ఉందా?",
        ta: "புதிய பலவீனம், மரத்துப்போதல், பேசுவதில் சிரமம் அல்லது குழப்பம் உள்ளதா?",
        kn: "ದೇಹದ ಒಂದು ಬದಿಯಲ್ಲಿ ದೌರ್ಬಲ್ಯ, ಮರಗಟ್ಟುವಿಕೆ ಅಥವಾ ಮಾತನಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?",
        en: "Do you have new weakness, numbness, difficulty speaking, or confusion?",
      },
      options: ["Yes, weakness or slurred speech", "Mild numbness only", "No weakness"],
      redFlagIfYes: true,
    },
    {
      id: "q-headache-vomit",
      category: "neurological",
      textEn: "Have you experienced repeated vomiting since the headache started?",
      translations: {
        hi: "क्या सिरदर्द शुरू होने के बाद से बार-बार उल्टी हो रही है?",
        te: "తలనొప్పి మొదలైనప్పటి నుండి పదే పదే వాంతులు అవుతున్నాయా?",
        ta: "தலைவலி தொடங்கியதிலிருந்து தொடர்ந்து வாந்தி எடுக்கிறீர்களா?",
        kn: "ತಲೆನೋವು ಪ್ರಾರಂಭವಾದಾಗಿನಿಂದ ಪುನರಾವರ್ತಿತ ವಾಂತಿ ಆಗುತ್ತಿದೆಯೇ?",
        en: "Have you experienced repeated vomiting since the headache started?",
      },
      options: ["Yes, vomiting repeatedly", "Nausea only", "No nausea or vomiting"],
      redFlagIfYes: true,
    },
  ],
  chest_pain: [
    {
      id: "q-chest-radiation",
      category: "cardiovascular",
      textEn: "Does the pain radiate or spread anywhere, such as your left arm, jaw, neck, or back?",
      translations: {
        hi: "क्या सीने का दर्द बाएं हाथ, जबड़े, गर्दन या पीठ में फैल रहा है?",
        te: "ఛాతీ నొప్పి ఎడమ చేతికి, దవడకు, మెడకు లేదా వెనుక వీపుకు వ్యాపిస్తోందా?",
        ta: "நெஞ்சு வலி இடது கை, தாடை, கழுத்து அல்லது முதுகுக்கு பரவுகிறதா?",
        kn: "ಎದೆ ನೋವು ಎಡ ಭುಜ, ದವಡೆ, ಕುತ್ತಿಗೆ ಅಥವಾ ಬೆನ್ನಿಗೆ ಹರಡುತ್ತಿದೆಯೇ?",
        en: "Does the pain radiate or spread anywhere, such as your left arm, jaw, neck, or back?",
      },
      options: ["Yes, radiating to left arm/jaw", "No, localized to chest", "Not sure"],
      redFlagIfYes: true,
    },
    {
      id: "q-chest-sweating",
      category: "cardiovascular",
      textEn: "Are you experiencing profuse cold sweating, clamminess, or dizziness?",
      translations: {
        hi: "क्या आपको अत्यधिक ठंडा पसीना या चक्कर आ रहे हैं?",
        te: "మీకు చల్లని చెమటలు ఎక్కువగా పట్టడం లేదా కళ్లు తిరగడం జరుగుతోందా?",
        ta: "அதிகப்படியான குளிர்ந்த வியர்வை அல்லது தலைசுற்றல் உள்ளதா?",
        kn: "ಅತಿಯಾಗಿ ತಣ್ಣನೆಯ ಬೆವರು ಬರುತ್ತಿದೆಯೇ ಅಥವಾ ತಲೆತಿರುಗುವಿಕೆ ಇದೆಯೇ?",
        en: "Are you experiencing profuse cold sweating, clamminess, or dizziness?",
      },
      options: ["Yes, profuse cold sweats", "Dizziness only", "No cold sweats"],
      redFlagIfYes: true,
    },
    {
      id: "q-chest-dyspnea",
      category: "respiratory",
      textEn: "Are you having difficulty breathing or shortness of breath?",
      translations: {
        hi: "क्या आपको सांस लेने में तकलीफ या दम घुटने जैसा महसूस हो रहा है?",
        te: "శ్వాస తీసుకోవడంలో తీవ్రమైన కష్టం లేదా ఊపిరాడకపోవడం ఉందా?",
        ta: "மூச்சு விடுவதில் கடுமையான சிரமம் அல்லது மூச்சுத்திணறல் உள்ளதா?",
        kn: "ಉಸಿರಾಟದಲ್ಲಿ ತೊಂದರೆ ಅಥವಾ ಉಸಿರು ಕಟ್ಟುವ ಅನುಭವವಾಗುತ್ತಿದೆಯೇ?",
        en: "Are you having difficulty breathing or shortness of breath?",
      },
      options: ["Yes, severe shortness of breath", "Mild discomfort", "Breathing normal"],
      redFlagIfYes: true,
    },
    {
      id: "q-chest-onset",
      category: "timeline",
      textEn: "Did this chest pain start suddenly within the last 60 minutes?",
      translations: {
        hi: "क्या यह दर्द पिछले 60 मिनट में अचानक शुरू हुआ?",
        te: "ఈ నొప్పి గత ఒక గంటలోపే అకస్మాత్తుగా మొదలైందా?",
        ta: "இந்த வலி கடந்த ஒரு மணி நேரத்திற்குள் திடீரென தொடங்கியதா?",
        kn: "ಈ ನೋವು ಕಳೆದ 60 ನಿಮಿಷಗಳಲ್ಲಿ ಹಠಾತ್ತಾಗಿ ಪ್ರಾರಂಭವಾಯಿತೇ?",
        en: "Did this chest pain start suddenly within the last 60 minutes?",
      },
      options: ["Within last 60 minutes", "A few hours ago", "Several days"],
      redFlagIfYes: true,
    },
  ],
  general: [
    {
      id: "q-onset",
      category: "timeline",
      textEn: "Did these symptoms begin suddenly within the last few hours, or gradually over several days?",
      translations: {
        hi: "क्या ये लक्षण कुछ ही घंटों में अचानक शुरू हुए, या कई दिनों में धीरे-धीरे बढ़े?",
        te: "ఈ లక్షణాలు కొన్ని గంటల్లో అకస్మాత్తుగా మొదలయ్యాయా, లేక కొన్ని రోజులుగా నెమ్మదిగా వస్తున్నాయా?",
        ta: "இந்த அறிகுறிகள் சில மணிநேரங்களில் திடீரெனத் தொடங்கினவா, அல்லது பல நாட்களாகப் படிப்படியாக வந்தனவா?",
        kn: "ಈ ರೋಗಲಕ್ಷಣಗಳು ಕೆಲವು ಗಂಟೆಗಳಲ್ಲಿ ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಪ್ರಾರಂಭವಾದವೇ, ಅಥವಾ ಕೆಲವು ದಿನಗಳಿಂದ ಕ್ರಮೇಣ ಹೆಚ್ಚಾದವೇ?",
        en: "Did these symptoms begin suddenly within the last few hours, or gradually over several days?",
      },
      options: ["Suddenly (Today)", "Gradually (Few days)", "I do not remember"],
    },
    {
      id: "q-breathing",
      category: "respiratory",
      textEn: "Are you feeling severe shortness of breath or struggling to speak in full sentences?",
      translations: {
        hi: "क्या आपको सांस लेने में बहुत ज्यादा तकलीफ हो रही है या बोलने में परेशानी है?",
        te: "మీకు శ్వాస తీసుకోవడం చాలా కష్టంగా ఉందా లేదా మాట్లాడలేకపోతున్నారా?",
        ta: "மூச்சு விடுவதில் கடுமையான சிரமம் உள்ளதா அல்லது பேச முடியவில்லையா?",
        kn: "ಉಸಿರಾಡಲು ತುಂಬಾ ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ ಅಥವಾ ಮಾತನಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲವೇ?",
        en: "Are you feeling severe shortness of breath or struggling to speak in full sentences?",
      },
      options: ["Yes, struggling to breathe", "No, breathing is okay", "Mild discomfort only"],
      redFlagIfYes: true,
    },
    {
      id: "q-fainting",
      category: "neurological",
      textEn: "Have you experienced any fainting, dizziness, or loss of consciousness?",
      translations: {
        hi: "क्या आपको चक्कर आना, बेहोशी या आंखों के आगे अंधेरा छाना महसूस हुआ?",
        te: "మీకు కళ్లు తిరగడం, మూర్ఛపోవడం లేదా స్పృహ తప్పడం జరిగిందా?",
        ta: "மயக்கம், தலைசுற்றல் அல்லது நினைவிழந்த நிலை ஏற்பட்டதா?",
        kn: "ತಲೆತಿರುಗುವಿಕೆ, ಮೂರ್ಛೆ ಅಥವಾ ಪ್ರಜ್ಞೆ ತಪ್ಪಿದ ಅನುಭವವಾಗಿದೆಯೇ?",
        en: "Have you experienced any fainting, dizziness, or loss of consciousness?",
      },
      options: ["Yes, felt like passing out", "No fainting", "Only mild lightheadedness"],
      redFlagIfYes: true,
    },
  ],
};

export function getClarifyingQuestions(category: string, lang: RegionalLanguage): ClarifyingQuestion[] {
  const normCategory = category.toLowerCase().replace(/[\s_-]+/g, "_");
  let catKey = "general";
  if (normCategory.includes("headache") || normCategory.includes("head") || normCategory.includes("सिरदर्द") || normCategory.includes("तలనొప్పి")) {
    catKey = "headache";
  } else if (normCategory.includes("chest") || normCategory.includes("cardiac") || normCategory.includes("heart") || normCategory.includes("छाती") || normCategory.includes("ఛాతీ")) {
    catKey = "chest_pain";
  }

  const templates = CLINICAL_QUESTION_TEMPLATES[catKey] || CLINICAL_QUESTION_TEMPLATES.general;
  return templates.map((t) => ({
    id: t.id,
    textEn: t.textEn,
    textNative: t.translations[lang] || t.translations.te || t.textEn,
    language: lang,
    category: t.category,
    options: t.options || ["Yes", "No", "Not sure"],
    redFlagIfYes: t.redFlagIfYes,
  }));
}

export const MOCK_CLARIFYING_QUESTIONS: Record<string, ClarifyingQuestion[]> = {
  general: getClarifyingQuestions("general", "te"),
  headache: getClarifyingQuestions("headache", "te"),
  chest_pain: getClarifyingQuestions("chest_pain", "te"),
};

