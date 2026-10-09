/**
 * Client-Side Deterministic Clinical Triage Engine (Offline & Rural Mode)
 * Ported from engine.py for on-device zero-latency execution.
 * Safety Principle: NEVER diagnoses or recommends treatment.
 */

const OFFLINE_LEXICON = {
  "chest pain": ["chest pain", "chest tightness", "pressure in chest", "pain in my chest", "chest discomfort", "గుండె నొప్పి", "ఛాతీ నొప్పి", "நெஞ்சு வலி", "सीने में दर्द"],
  "shortness of breath": ["short of breath", "breathless", "difficulty breathing", "can't breathe", "cannot breathe", "dyspnea", "gasping", "ఉబ్బసం", "மூச்சுத்திணறல்", "सांस फूलना"],
  "fever": ["fever", "feverish", "high temperature", "జ్వరం", "காய்ச்சல்", "बुखार"],
  "vomiting": ["vomit", "vomiting", "throwing up", "వాంతులు", "வாந்தி", "उल्टी"],
  "dizziness": ["dizzy", "dizziness", "lightheaded", "తలతిరగడం", "மயக்கம்", "चक्कर"],
  "sweating": ["sweating", "sweat", "diaphoresis", "cold sweats", "చెమటలు", "வியர்வை", "पसीना"],
  "headache": ["headache", "head pain", "తలనొప్పి", "தலைவலி", "सिरदर्द"],
  "bleeding": ["bleeding", "blood loss", "bleed", "రక్తస్రావం", "ரத்தப்போக்கு", "खून बहना"],
  "abdominal pain": ["stomach pain", "abdominal pain", "belly pain", "కడుపు నొప్పి", "வயிற்று வலி", "पेट दर्द"],
  "weakness": ["weakness", "weak on", "numb", "నీరసం", "பலவீனம்", "कमजोरी"],
  "facial droop": ["face droop", "drooping", "face is crooked", "ముఖం వంకర", "முகம் கோணல்", "मुंह टेढ़ा"],
  "slurred speech": ["slurred", "can't speak properly", "మాట తడబడటం", "குளறிய பேச்சு", "लड़खड़ाती आवाज"],
  "seizure": ["seizure", "convulsion", "fits", "ఫిట్స్", "வலிப்பு", "दौरा"],
  "unconscious": ["unconscious", "unresponsive", "fainted", "passed out", "స్పృహ తప్పడం", "மயக்கம்", "बेहोश"],
  "injury": ["fell", "accident", "fracture", "crash", "hit by", "injury", "గాయం", "விபத்து", "चोट", "दुर्घटना"],
  "jaw pain": ["jaw", "jaw pain", "దవడ నొప్పి", "தாடை வலி", "जबड़े में दर्द"],
  "arm pain": ["left arm", "arm pain", "ఎడమ చేయి నొప్పి", "இடது கை வலி", "बाएं हाथ में दर्द"]
};

function offlineExtract(text, prior = null) {
  const t = text.toLowerCase();
  const e = prior || {
    symptoms: [],
    severity: null,
    age: null,
    progression: null,
    onset_text: null,
    chief_complaint: null,
    aggravating: []
  };

  for (const [sym, keywords] of Object.entries(OFFLINE_LEXICON)) {
    if (keywords.some(k => t.includes(k.toLowerCase()))) {
      if (!e.symptoms.includes(sym)) e.symptoms.push(sym);
    }
  }

  if (!e.chief_complaint && e.symptoms.length > 0) {
    e.chief_complaint = e.symptoms[0];
  }

  // Severity 1-10
  const mSev = t.match(/(\d+)\s*(?:\/|out of)\s*10/);
  if (mSev) e.severity = Math.min(10, Math.max(1, parseInt(mSev[1])));
  else if (t.includes("severe") || t.includes("unbearable") || t.includes("తీవ్రమైన") || t.includes("கடுமையான") || t.includes("गंभीर")) {
    e.severity = Math.max(e.severity || 0, 8);
  } else if (t.includes("mild") || t.includes("కొద్దిగా") || t.includes("லேசான") || t.includes("हल्का")) {
    e.severity = e.severity || 3;
  }

  // Age in years
  const mAge = t.match(/(\d+)[- ]?(year|month)s?[- ]?old/);
  if (mAge) {
    e.age = mAge[2] === "month" ? parseInt(mAge[1]) / 12.0 : parseFloat(mAge[1]);
  }

  // Progression
  if (t.includes("getting worse") || t.includes("worsening") || t.includes("rapidly") || t.includes("suddenly")) {
    e.progression = "getting worse";
  }

  return e;
}

function offlineRedFlags(e, fullText) {
  const t = fullText.toLowerCase();
  const s = new Set(e.symptoms || []);
  const sev = e.severity || 0;
  const flags = [];

  // Cardiac red flags
  if (s.has("chest pain") && (s.has("sweating") || s.has("jaw pain") || s.has("arm pain") || s.has("shortness of breath") || s.has("dizziness"))) {
    flags.push("Acute chest pain with associated cardiac-type symptoms");
  }

  // Stroke signs
  if (s.has("facial droop") || s.has("slurred speech") || (s.has("weakness") && (t.includes("one side") || t.includes("left side") || t.includes("right side")))) {
    flags.push("Possible stroke signs (face/speech/one-sided weakness)");
  }

  // Severe respiratory distress
  if (s.has("shortness of breath") && (t.includes("cannot speak") || t.includes("can't speak") || t.includes("gasping") || sev >= 8)) {
    flags.push("Severe respiratory distress");
  }

  // Heavy bleeding
  if (s.has("bleeding") && (t.includes("heavy") || t.includes("a lot") || t.includes("won't stop") || sev >= 8)) {
    flags.push("Uncontrolled haemorrhage");
  }

  // Unconscious or seizure
  if (s.has("unconscious") || s.has("seizure")) {
    flags.push("Altered mental state / seizure");
  }

  // Severe trauma
  if (s.has("injury") && (s.has("bleeding") || s.has("unconscious") || sev >= 8)) {
    flags.push("Severe trauma");
  }

  return flags;
}

function offlineScore(e, flags, source = "patient") {
  let score = 0;
  const why = [];

  if (flags.length > 0) {
    score += 100;
    why.push(...flags.map(f => `Red flag: ${f}`));
  }

  const sev = e.severity || 0;
  if (sev >= 8) {
    score += 35;
    why.push(`Severity reported ${sev}/10`);
  } else if (sev >= 5) {
    score += 20;
    why.push(`Moderate severity (${sev}/10)`);
  }

  if (e.progression === "getting worse") {
    score += 20;
    why.push("Progression: getting worse");
  }

  const tier = score >= 100 ? "critical" : (score >= 50 ? "urgent" : (score >= 25 ? "concerning" : "stable"));
  
  return {
    tier: tier,
    score: Math.min(score, 200),
    is_emergency: flags.length > 0,
    confidence: 0.85,
    reasoning: `On-Device Offline Triage [${tier.toUpperCase()}]: ` + (why.join("; ") || "Provisional intake; Nurse review required on sync.")
  };
}

// Export for browser
if (typeof window !== "undefined") {
  window.OfflineTriage = {
    extract: offlineExtract,
    redFlags: offlineRedFlags,
    score: offlineScore
  };
}
