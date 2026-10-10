/**
 * Patient & Paramedic Multilingual Voice Intake Controller
 * Features:
 * - Real-time Voice Recording with Preview Transcription & Translation before Submit
 * - Web Speech API Progressive Interim Results
 * - Persistent Active Patient Session
 * - "New Patient" Modal Control
 * - Emergency Warning Banner (Call 112)
 * - Timestamps on all messages
 */

const API_BASE = "";
let currentSessionId = localStorage.getItem("active_triage_session_id") || null;
let mediaRecorder = null;
let audioContext = null;
let audioChunks = [];
let isRecording = false;
let speechRecognition = null;

const $ = (id) => document.getElementById(id);

// Safe Base64 helper
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(",")[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// API Caller
async function postApi(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Server error");
  }
  return res.json();
}

async function getApi(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

// Session Creation / Retrieval
async function getOrCreateSession() {
  if (currentSessionId) return currentSessionId;

  const lang = $("lang-select")?.value || "te";
  const source = $("source-select")?.value || "patient";
  const etaMinutes =
    source === "paramedic" && $("eta-input")?.value ? parseInt($("eta-input").value) : null;
  const telemetry =
    source === "paramedic"
      ? {
          spo2: $("spo2-input")?.value || null,
          hr: $("hr-input")?.value || null,
          bp: $("bp-input")?.value || null,
        }
      : null;

  const data = await postApi("/api/sessions", {
    language: lang,
    source: source,
    channel: "kiosk",
    eta_minutes: etaMinutes,
    telemetry: telemetry,
  });

  currentSessionId = data.id;
  localStorage.setItem("active_triage_session_id", currentSessionId);
  return currentSessionId;
}

// Restore session on page load
async function restoreSession() {
  if (!currentSessionId) return;
  try {
    const s = await getApi(`/api/sessions/${currentSessionId}`);
    if (s.language && $("lang-select")) $("lang-select").value = s.language;
    if (s.source && $("source-select")) $("source-select").value = s.source;

    // Load messages
    const msgsRes = await getApi(`/api/sessions/${currentSessionId}/messages`).catch(() => null);
    if (msgsRes && msgsRes.messages) {
      $("dialogue-thread").innerHTML = "";
      msgsRes.messages.forEach((m) => {
        appendMessage(m.sender === "patient" ? "user" : "assistant", m.original_text, m.english_text, m.submitted_at || m.created_at);
      });
    }

    if (s.emergency_guidance) showEmergencyBanner(s.emergency_guidance);
    if (s.summary) renderSummaryCard(s.summary);
    const qNative = s.next_question_native || (s.language === "en" ? s.next_question : "");
    const qEn = s.next_question_en || s.next_question || "";
    if (qNative) {
      $("question-native").textContent = qNative;
      $("question-en").textContent = qEn;
      $("question-banner").classList.add("visible");
    } else {
      $("question-banner").classList.remove("visible");
      $("question-native").textContent = "";
      $("question-en").textContent = "";
    }
  } catch (e) {
    console.warn("Could not restore session:", e);
  }
}

// Emergency Banner Trigger
function showEmergencyBanner(guidance) {
  const b = $("emergency-banner");
  if (!b || !guidance) return;
  $("emergency-title").textContent = guidance.alert || "ACUTE CLINICAL EMERGENCY";
  $("emergency-desc").textContent = guidance.action || "Please call 112 immediately.";
  b.style.display = "block";
}

// Render Clinical Summary Card
function renderSummaryCard(summary) {
  const card = $("clinical-summary-card");
  if (!card || !summary) return;
  $("summary-tier-badge").textContent = summary.triage_priority || "PRIORITY";
  $("summary-content").innerHTML = `
    <div><b>Chief Complaint:</b> ${summary.chief_complaint}</div>
    <div><b>Onset:</b> ${summary.symptom_onset} | <b>Severity:</b> ${summary.severity}</div>
    <div><b>Location:</b> ${summary.pain_location} (${summary.frequency})</div>
    <div><b>Original Statement:</b> <i>“${summary.original_patient_statement}”</i></div>
    <div><b>English Translation:</b> <i>“${summary.english_translation}”</i></div>
    ${summary.missing_information && summary.missing_information.length ? `<div style="margin-top:6px;color:#fca5a5"><b>Missing Info:</b> ${summary.missing_information.join(", ")}</div>` : ""}
  `;
  card.style.display = "block";
}

// Format local timestamp
function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// Append bubble to dialogue thread
function appendMessage(sender, text, subtext = null, timeIso = null) {
  const thread = $("dialogue-thread");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${sender}`;
  const tStr = formatTime(timeIso || new Date().toISOString());
  bubble.innerHTML = `
    <div class="bubble-label" style="display:flex;justify-content:space-between">
      <span>${sender === "user" ? "👤 Patient" : "🤖 Clinical Assistant"}</span>
      <span style="font-size:10px;font-weight:400;opacity:0.7">🕒 ${tStr}</span>
    </div>
    <div style="font-weight:600;margin-top:2px">${text}</div>
    ${subtext && subtext !== text ? `<div style="font-size:12px;opacity:0.85;margin-top:4px;font-style:italic">EN: ${subtext}</div>` : ""}
  `;
  thread.appendChild(bubble);
  bubble.scrollIntoView({ behavior: "smooth" });
}

// Set recording status badge
function setRecordingStatus(status, label) {
  const badge = $("recording-badge");
  if (!badge) return;
  const styles = {
    idle: { bg: "rgba(255,255,255,0.08)", color: "#94a3b8", text: "Ready" },
    listening: { bg: "rgba(239,68,68,0.25)", color: "#f87171", text: "🔴 Listening..." },
    processing: { bg: "rgba(6,182,212,0.25)", color: "#22d3ee", text: "⏳ Processing Speech..." },
    ready: { bg: "rgba(16,185,129,0.25)", color: "#34d399", text: "✓ Transcription Ready" },
    error: { bg: "rgba(244,63,94,0.25)", color: "#fda4af", text: "Recording Error" },
  };
  const s = styles[status] || styles.idle;
  badge.style.background = s.bg;
  badge.style.color = s.color;
  badge.textContent = label || s.text;
}

// Initialize Voice Recording with Preview
async function toggleVoiceRecording() {
  const btn = $("btn-mic");
  const micLabel = $("mic-label");

  if (isRecording) {
    // Stop recording
    isRecording = false;
    btn.classList.remove("recording");
    micLabel.textContent = "Processing speech transcription & translation...";
    setRecordingStatus("processing");

    if (speechRecognition) {
      try { speechRecognition.stop(); } catch {}
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    return;
  }

  // Start recording
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    // Client-side Web Speech API for progressive interim text
    const lang = $("lang-select")?.value || "te";
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = true;
        const langMap = { te: "te-IN", ta: "ta-IN", hi: "hi-IN", kn: "kn-IN", ml: "ml-IN", bn: "bn-IN", mr: "mr-IN", en: "en-US" };
        speechRecognition.lang = langMap[lang] || "en-US";
        speechRecognition.onresult = (e) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            text += e.results[i][0].transcript;
          }
          if (text.trim()) $("transcript-preview").value = text.trim();
        };
        speechRecognition.start();
      } catch (recErr) {
        console.warn("WebSpeech progressive error:", recErr);
      }
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      audioChunks = [];
      const b64 = await blobToBase64(blob);

      try {
        const preview = await postApi("/api/speech/transcribe-translate", {
          audio_b64: b64,
          text: $("transcript-preview").value.trim() || undefined,
          language: lang,
          codemixed: true,
        });

        if (preview.original_text) $("transcript-preview").value = preview.original_text;
        if (preview.english_text) $("translation-preview").value = preview.english_text;
        setRecordingStatus("ready", "✓ Transcription Ready");
        micLabel.textContent = "Transcription ready! Review and edit before clicking Submit.";
      } catch (err) {
        console.error("Transcription preview error:", err);
        setRecordingStatus("ready", "Transcription Ready");
        micLabel.textContent = "Speech captured. Review text and press Submit.";
      }
    };

    mediaRecorder.start();
    isRecording = true;
    btn.classList.add("recording");
    micLabel.textContent = "Listening... Speak your symptoms now";
    setRecordingStatus("listening");
  } catch (err) {
    console.error("Mic error:", err);
    setRecordingStatus("error", "Microphone Permission Denied");
    micLabel.textContent = "Microphone unavailable. Please type your symptoms below.";
    alert("Microphone permission denied or unsupported. Please use manual text entry.");
  }
}

// Translate draft in preview
async function retranslateDraft() {
  const orig = $("transcript-preview")?.value.trim();
  if (!orig) return;
  const btn = $("btn-retranslate");
  const origText = btn.textContent;
  btn.textContent = "⏳ Translating...";
  btn.disabled = true;

  try {
    const lang = $("lang-select")?.value || "te";
    const res = await postApi("/api/speech/transcribe-translate", {
      text: orig,
      language: lang,
    });
    if (res.english_text) $("translation-preview").value = res.english_text;
  } catch (e) {
    console.warn("Translation failed:", e);
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

// Clear previews
function clearPreviews() {
  $("transcript-preview").value = "";
  $("translation-preview").value = "";
  setRecordingStatus("idle");
  $("mic-label").textContent = "Tap microphone to speak symptoms";
}

// Submit Symptoms (Feature 1, 2, 3, 4, 11)
async function submitSymptoms() {
  const orig = $("transcript-preview")?.value.trim();
  const eng = $("translation-preview")?.value.trim() || orig;
  if (!orig && !eng) {
    alert("Please speak or enter symptoms before submitting.");
    return;
  }

  const submitBtn = $("submit-symptoms-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ Submitting & Analyzing...";

  try {
    const sid = await getOrCreateSession();
    appendMessage("user", orig, eng);
    clearPreviews();

    const reply = await postApi(`/api/sessions/${sid}/utterance`, {
      text: orig,
      english_text: eng,
      language: $("lang-select")?.value || "te",
      asr_confidence: 0.98,
    });

    handleTurnResponse(reply);
  } catch (err) {
    console.error("Submission error:", err);
    alert("Failed to submit message: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "➤ Submit Symptoms to Nurse Queue";
  }
}

// Process Utterance Response from API
function handleTurnResponse(reply) {
  const lang = $("lang-select")?.value || "te";
  const questionNative = reply.next_question_native || (lang === "en" ? reply.next_question : "");
  const questionEn = reply.next_question_en || reply.next_question || "";
  const readbackNative = reply.readback_native || reply.readback_en;

  if (reply.emergency_guidance) showEmergencyBanner(reply.emergency_guidance);
  if (reply.summary) renderSummaryCard(reply.summary);

  // Show follow up question if available
  if (questionNative) {
    $("question-native").textContent = questionNative;
    $("question-en").textContent = questionEn;
    $("question-banner").classList.add("visible");
    appendMessage("assistant", questionNative, questionEn);
  } else {
    $("question-banner").classList.remove("visible");
    $("question-native").textContent = "";
    $("question-en").textContent = "";
  }

  // Show readback confirmation card
  if (readbackNative) {
    $("confirm-native").textContent = readbackNative;
    $("confirm-card").classList.add("visible");
  }
}

// Insert Sample Utterance
function insertSample(orig, eng, lang) {
  if ($("lang-select")) $("lang-select").value = lang;
  $("transcript-preview").value = orig;
  $("translation-preview").value = eng;
  setRecordingStatus("ready", "Demo Utterance Ready");
  $("mic-label").textContent = "Sample loaded. Review and click Submit.";
}

// Confirm Intake ("Yes, that's correct")
async function confirmIntakeAction() {
  try {
    const sid = await getOrCreateSession();
    await postApi(`/api/sessions/${sid}/confirm`, { text: "yes" });
    $("confirm-card").classList.remove("visible");
    $("complete-banner").classList.add("visible");
  } catch (err) {
    alert("Confirmation failed: " + err.message);
  }
}

// New Patient Modal Controls (Feature 11)
function setupNewPatientHandlers() {
  const btnNew = $("btn-new-patient");
  const modal = $("new-patient-modal");
  const btnCancel = $("btn-cancel-new-patient");
  const btnConfirm = $("btn-confirm-new-patient");

  if (btnNew) btnNew.onclick = () => (modal.style.display = "flex");
  if (btnCancel) btnCancel.onclick = () => (modal.style.display = "none");
  if (btnConfirm) {
    btnConfirm.onclick = async () => {
      modal.style.display = "none";
      localStorage.removeItem("active_triage_session_id");
      currentSessionId = null;
      $("dialogue-thread").innerHTML = "";
      clearPreviews();
      $("question-banner").classList.remove("visible");
      $("question-native").textContent = "";
      $("question-en").textContent = "";
      $("confirm-card").classList.remove("visible");
      $("complete-banner").classList.remove("visible");
      $("emergency-banner").style.display = "none";
      $("clinical-summary-card").style.display = "none";
      await getOrCreateSession();
      alert("New patient intake session started.");
    };
  }
}

// Setup Event Listeners
window.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  setupNewPatientHandlers();

  $("btn-mic")?.addEventListener("click", toggleVoiceRecording);
  $("submit-symptoms-btn")?.addEventListener("click", submitSymptoms);
  $("btn-clear-preview")?.addEventListener("click", clearPreviews);
  $("btn-retranslate")?.addEventListener("click", retranslateDraft);
  $("btn-confirm-yes")?.addEventListener("click", confirmIntakeAction);
  $("source-select")?.addEventListener("change", () => {
    const isParamedic = $("source-select").value === "paramedic";
    const bar = $("telemetry-bar");
    if (bar) bar.classList.toggle("visible", isParamedic);
  });
});
