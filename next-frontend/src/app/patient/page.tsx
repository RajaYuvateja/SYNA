"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Send,
  Siren,
  CheckCircle,
  HelpCircle,
  Activity,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  UserPlus,
  Clock,
  Languages,
  X,
  FileText,
  Sparkles,
  Edit3,
} from "lucide-react";
import {
  createSession,
  fetchSession,
  sendUtterance,
  confirmIntake,
  transcribeAndTranslate,
  streamAmbulanceTelemetry,
  submitQuestionnaireAnswer,
  confirmReport,
  correctStatement,
  updateSessionLanguage,
} from "@/lib/api";
import { Message, EmergencyGuidance, ClinicalSummary, SymptomQuestion } from "@/types/triage";

const SUPPORTED_LANGUAGES = [
  { code: "te", label: "తెలుగు (Telugu)", name: "Telugu" },
  { code: "ta", label: "தமிழ் (Tamil)", name: "Tamil" },
  { code: "hi", label: "हिन्दी (Hindi)", name: "Hindi" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)", name: "Kannada" },
  { code: "ml", label: "മലയാളം (Malayalam)", name: "Malayalam" },
  { code: "bn", label: "বাংলা (Bengali)", name: "Bengali" },
  { code: "mr", label: "मराठी (Marathi)", name: "Marathi" },
  { code: "en", label: "English", name: "English" },
];

function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function PatientIntakePage() {
  const [lang, setLang] = useState("te");
  const [source, setSource] = useState("patient");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Paramedic state
  const [eta, setEta] = useState(10);
  const [spo2, setSpo2] = useState("91");
  const [hr, setHr] = useState("115");
  const [bp, setBp] = useState("140/90");
  const [activeFastCode, setActiveFastCode] = useState<string | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "listening" | "processing" | "ready" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transcription & Translation Preview state (Features 1 & 2)
  const [originalDraft, setOriginalDraft] = useState("");
  const [englishDraft, setEnglishDraft] = useState("");
  const [interimSpeech, setInterimSpeech] = useState("");
  const [translatingDraft, setTranslatingDraft] = useState(false);

  // Chat message history (Feature 3 & 4 & 11)
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Emergency Safety Guidance & Clinical Summary (Feature 5 & 6)
  const [emergencyGuidance, setEmergencyGuidance] = useState<EmergencyGuidance | null>(null);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummary | null>(null);
  const [nextQuestion, setNextQuestion] = useState<{ native?: string; en?: string } | null>(null);
  const [readback, setReadback] = useState<{ native?: string; en?: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Batch questionnaire state (Requirement 2 & 3 & 4)
  const [questionnaire, setQuestionnaire] = useState<SymptomQuestion[]>([]);
  const [patientAnswers, setPatientAnswers] = useState<Record<string, string>>({});
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);

  // Regional language verification state (Requirement 6)
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correctingStatement, setCorrectingStatement] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [reportConfirmedAt, setReportConfirmedAt] = useState<string | null>(null);

  const questionnaireRef = useRef<HTMLDivElement | null>(null);

  // "New Patient" confirmation modal (Feature 11)
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  // Refs for audio capture & Web Speech API
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, nextQuestion, readback]);

  // Restore persistent active session from localStorage or URL on load (Feature 11)
  useEffect(() => {
    const initSession = async () => {
      let savedSid: string | null = null;
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        savedSid = urlParams.get("session_id") || localStorage.getItem("active_triage_session_id");
      }

      if (savedSid) {
        try {
          const s = await fetchSession(savedSid);
          setSessionId(s.id);
          setLang(s.language || "te");
          setSource(s.source || "patient");
          if (s.messages && s.messages.length > 0) {
            setMessages(s.messages);
          }
          if (s.emergency_guidance) {
            setEmergencyGuidance(s.emergency_guidance);
          }
          if (s.summary) {
            setClinicalSummary(s.summary);
          }
          if (s.next_question) {
            setNextQuestion({ native: s.next_question, en: s.next_question });
          }
          if (s.questionnaire && s.questionnaire.length > 0) {
            setQuestionnaire(s.questionnaire);
          }
          if (s.patient_answers) {
            setPatientAnswers(s.patient_answers as Record<string, string>);
          }
          if (s.confirmed_at) {
            setReportConfirmedAt(s.confirmed_at);
          }
          if (s.patient_name) {
            setPatientName(s.patient_name);
          }
          if (s.confirmed) {
            setConfirmed(true);
          }
          return;
        } catch (e) {
          console.warn("Could not restore session, will initialize fresh:", e);
        }
      }
    };

    initSession();
  }, []);

  const handleLanguageChange = async (newLang: string) => {
    setLang(newLang);
    if (sessionId) {
      try {
        const res = await updateSessionLanguage(sessionId, newLang);
        if (res.questionnaire && res.questionnaire.length > 0) {
          setQuestionnaire(res.questionnaire);
        }
        if (res.next_question_native) {
          setNextQuestion((prev) => (prev ? { ...prev, native: res.next_question_native } : null));
        }
        if (res.readback_native) {
          setReadback((prev) => (prev ? { ...prev, native: res.readback_native } : null));
        }
      } catch (e) {
        console.warn("Language update failed:", e);
      }
    }
  };

  const getOrCreateSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const res = await createSession({
      language: lang,
      source: source,
      channel: "kiosk",
      eta_minutes: source === "paramedic" ? eta : null,
      telemetry: source === "paramedic" ? { spo2, hr, bp } : null,
    });
    setSessionId(res.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_triage_session_id", res.id);
      const url = new URL(window.location.href);
      url.searchParams.set("session_id", res.id);
      window.history.replaceState({}, "", url.toString());
    }
    return res.id;
  };

  // Start live recording with Web Speech progressive transcript + MediaRecorder
  const startRecording = async () => {
    setErrorMessage(null);
    setInterimSpeech("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // Progressive Live Speech Recognition via Web Speech API (where supported)
      if (typeof window !== "undefined") {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recog = new SpeechRecognition();
            recog.continuous = true;
            recog.interimResults = true;
            recog.lang =
              lang === "te"
                ? "te-IN"
                : lang === "ta"
                ? "ta-IN"
                : lang === "hi"
                ? "hi-IN"
                : lang === "kn"
                ? "kn-IN"
                : lang === "ml"
                ? "ml-IN"
                : lang === "bn"
                ? "bn-IN"
                : lang === "mr"
                ? "mr-IN"
                : "en-US";

            recog.onresult = (evt: any) => {
              let liveText = "";
              for (let i = evt.resultIndex; i < evt.results.length; ++i) {
                liveText += evt.results[i][0].transcript;
              }
              setInterimSpeech(liveText);
              setOriginalDraft((prev) => {
                const combined = liveText.trim();
                return combined || prev;
              });
            };

            recog.onerror = (e: any) => {
              console.warn("WebSpeech event:", e.error);
            };

            recog.start();
            recognitionRef.current = recog;
          } catch (recErr) {
            console.warn("WebSpeech recognition not active:", recErr);
          }
        }
      }

      recorder.onstop = async () => {
        // Stop browser WebSpeech
        try {
          recognitionRef.current?.stop();
        } catch {}

        if (audioChunksRef.current.length === 0) {
          setRecordingStatus("ready");
          return;
        }

        setRecordingStatus("processing");
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];

        // Convert audio to base64 and call preview transcribe-translate endpoint
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(",")[1];
          try {
            const previewResult = await transcribeAndTranslate({
              audio_b64: b64,
              text: originalDraft.trim() || undefined,
              language: lang,
              codemixed: true,
            });

            if (previewResult.original_text) {
              setOriginalDraft(previewResult.original_text);
            }
            if (previewResult.english_text) {
              setEnglishDraft(previewResult.english_text);
            }
            setRecordingStatus("ready");
          } catch (err: any) {
            console.error("Transcription preview error:", err);
            // Retain any interim text gathered from WebSpeech
            setRecordingStatus(originalDraft ? "ready" : "error");
            setErrorMessage(err.message || "Failed to process audio. You can type or edit manually.");
          }
        };
      };

      recorder.start();
      setIsRecording(true);
      setRecordingStatus("listening");
    } catch (err: any) {
      console.error("Mic access error:", err);
      setRecordingStatus("error");
      setErrorMessage("Microphone access denied or unsupported browser. Please check mic permissions.");
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingStatus("processing");
      mediaRecorderRef.current?.stop();
    }
  };

  // Re-translate current draft when user edits original text
  const handleUpdateTranslation = async () => {
    if (!originalDraft.trim()) return;
    setTranslatingDraft(true);
    try {
      const res = await transcribeAndTranslate({
        text: originalDraft.trim(),
        language: lang,
      });
      if (res.english_text) {
        setEnglishDraft(res.english_text);
      }
    } catch (e: any) {
      console.warn("Translation update error:", e);
    } finally {
      setTranslatingDraft(false);
    }
  };

  // Clear text composer
  const handleClear = () => {
    setOriginalDraft("");
    setEnglishDraft("");
    setInterimSpeech("");
    setRecordingStatus("idle");
    setErrorMessage(null);
  };

  // Submit Patient Message (Feature 1, 2, 3, 4, 11)
  const handleSubmitMessage = async () => {
    const orig = originalDraft.trim();
    if (!orig && !englishDraft.trim()) return;
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    const eng = englishDraft.trim() || orig;
    const nowIso = new Date().toISOString();

    // Optimistically prepare message
    const tempMsgId = `msg_temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempMsgId,
      session_id: sessionId || "pending",
      sender: "patient",
      language: lang,
      original_text: orig,
      english_text: eng,
      created_at: nowIso,
      submitted_at: nowIso,
      status: "submitted",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    handleClear();

    try {
      const sid = await getOrCreateSession();
      const reply = await sendUtterance(sid, {
        text: orig,
        english_text: eng,
        language: lang,
        asr_confidence: 0.98,
      });

      // Update messages from authoritative backend response
      if (reply.messages && reply.messages.length > 0) {
        setMessages(reply.messages);
      }

      // Handle Questionnaire Batch (Requirement 2 & 3)
      if (reply.questionnaire && reply.questionnaire.length > 0) {
        setQuestionnaire(reply.questionnaire);
      }
      if (reply.patient_answers) {
        setPatientAnswers(reply.patient_answers);
      }

      // Handle Emergency Guidance (Feature 5 & 11)
      if (reply.emergency_guidance) {
        setEmergencyGuidance(reply.emergency_guidance);
      }

      // Handle Clinical Summary (Feature 6 & 7)
      if (reply.summary) {
        setClinicalSummary(reply.summary);
      }

      // Update next question and readback
      if (reply.next_question_native || reply.next_question) {
        setNextQuestion({
          native: reply.next_question_native || reply.next_question,
          en: reply.next_question,
        });
      } else {
        setNextQuestion(null);
      }

      if (reply.readback_native || reply.readback_en) {
        setReadback({
          native: reply.readback_native || reply.readback_en,
          en: reply.readback_en,
        });
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMessage("Failed to save message. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Single-Tap Questionnaire Answer Handler (Requirement 3 & 4)
  const handleAnswerQuestion = async (
    questionId: string,
    answer: "yes" | "no" | "not_sure",
    clarification?: string
  ) => {
    if (!sessionId) return;
    setAnsweringQuestionId(questionId);

    // Optimistically update local state
    setPatientAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setQuestionnaire((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, answer, is_answered: true } : q
      )
    );

    try {
      const res = await submitQuestionnaireAnswer(sessionId, {
        question_id: questionId,
        answer: answer,
        clarification: clarification,
      });

      if (res.questionnaire) {
        setQuestionnaire(res.questionnaire);
      }
      if (res.patient_answers) {
        setPatientAnswers(res.patient_answers);
      }

      // CRITICAL RED FLAG HANDLING (Requirement 4): Immediate escalation without waiting
      if (res.is_emergency || res.escalation_status === "escalated") {
        if (res.session?.emergency_guidance) {
          setEmergencyGuidance(res.session.emergency_guidance);
        }
      }

      if (res.session?.summary) {
        setClinicalSummary(res.session.summary);
      }
    } catch (err: any) {
      console.error("Failed to submit question answer:", err);
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  // Report Confirmation Handler (Requirement 5 & 6)
  const handleConfirmReport = async () => {
    if (!sessionId) return;
    try {
      const res = await confirmReport(sessionId, {
        patient_name: patientName.trim() || undefined,
      });
      setConfirmed(true);
      setReportConfirmedAt(res.confirmed_at || new Date().toISOString());
      setShowVerificationModal(false);
      setReadback(null);
    } catch (e: any) {
      alert("Report confirmation failed: " + e.message);
    }
  };

  // Statement Correction Handlers (Requirement 6)
  const handleOpenCorrection = () => {
    const latestPatientMsg = [...messages].reverse().find((m) => m.sender === "patient");
    setCorrectionText(latestPatientMsg?.original_text || originalDraft || "");
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = async () => {
    if (!sessionId || !correctionText.trim()) return;
    setCorrectingStatement(true);
    try {
      const res = await correctStatement(sessionId, {
        corrected_text: correctionText.trim(),
        language: lang,
      });
      if (res.session?.messages) {
        setMessages(res.session.messages);
      }
      if (res.session?.questionnaire) {
        setQuestionnaire(res.session.questionnaire);
      }
      if (res.session?.summary) {
        setClinicalSummary(res.session.summary);
      }
      if (res.session?.emergency_guidance) {
        setEmergencyGuidance(res.session.emergency_guidance);
      }
      setShowCorrectionModal(false);
    } catch (err: any) {
      alert("Statement correction failed: " + err.message);
    } finally {
      setCorrectingStatement(false);
    }
  };

  // Confirm Intake
  const handleConfirmIntake = async () => {
    if (!sessionId) return;
    try {
      await confirmIntake(sessionId, "yes");
      setConfirmed(true);
      setReadback(null);
    } catch (e: any) {
      alert("Confirmation failed: " + e.message);
    }
  };

  // Explicit New Patient Reset Modal (Feature 11)
  const handleConfirmNewPatient = async () => {
    setShowNewPatientModal(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_triage_session_id");
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }

    setSessionId(null);
    setMessages([]);
    setQuestionnaire([]);
    setPatientAnswers({});
    setReportConfirmedAt(null);
    setPatientName("");
    setOriginalDraft("");
    setEnglishDraft("");
    setInterimSpeech("");
    setEmergencyGuidance(null);
    setClinicalSummary(null);
    setNextQuestion(null);
    setReadback(null);
    setConfirmed(false);
    setRecordingStatus("idle");

    // Immediately initialize a fresh session for the new patient
    const res = await createSession({
      language: lang,
      source: source,
      channel: "kiosk",
    });
    setSessionId(res.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_triage_session_id", res.id);
    }
  };

  // Paramedic fast code trigger
  const triggerFastCode = (code: string, desc: string) => {
    setActiveFastCode(code);
    setSource("paramedic");
    setOriginalDraft(desc);
    setEnglishDraft(desc);
    setRecordingStatus("ready");
  };

  // Transmit Ambulance Telemetry
  const transmitAmbulance = async () => {
    setSubmitting(true);
    try {
      const complaint =
        originalDraft.trim() ||
        (activeFastCode ? `Emergency Code ${activeFastCode}` : "Acute Paramedic Emergency");
      const res = await streamAmbulanceTelemetry({
        session_id: sessionId || undefined,
        chief_complaint: complaint,
        eta_minutes: eta,
        telemetry: { spo2: Number(spo2), hr: Number(hr), bp },
        paramedic_unit: "EMS-Unit-108",
        fast_code: activeFastCode || "CRITICAL",
      });
      setSessionId(res.session_id);
      const tier = res.session?.risk?.tier?.toUpperCase() || "CRITICAL";
      alert(`🚨 Pre-Arrival Alert broadcast to Hospital Emergency Desk!\nETA: ${eta} mins\nPriority: ${tier}`);
    } catch (e: any) {
      alert("Failed to transmit ambulance telemetry: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 sm:px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            title="Back to Nurse Station"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-teal-400 shadow-md">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Multilingual AI Clinical Intake
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                Live Active Session
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Voice-First Patient Intake Aid &amp; Nurse Handoff
              {sessionId && (
                <span className="ml-2 font-mono text-[10px] text-cyan-400/80">
                  ID: {sessionId.slice(0, 8)}...
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Explicit "New Patient" Button (Feature 11) */}
          <button
            onClick={() => setShowNewPatientModal(true)}
            id="new-patient-btn"
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition shadow-sm"
          >
            <UserPlus className="h-3.5 w-3.5 text-rose-400" />
            <span>New Patient</span>
          </button>

          <Link
            href="/"
            className="hidden sm:flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            <span>Nurse Command Center</span>
            <span className="text-cyan-400">&rarr;</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-3 sm:px-6 py-6 space-y-6">
        {/* CRITICAL EMERGENCY WARNING BANNER (Feature 5 & 11) */}
        {emergencyGuidance && (
          <div
            id="emergency-alert-banner"
            className="rounded-2xl border-2 border-red-500 bg-red-950/80 p-5 shadow-2xl shadow-red-950/60 animate-pulse space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg">
                <Siren className="h-6 w-6 animate-bounce" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-red-300">
                    {emergencyGuidance.level}
                  </span>
                  <span className="rounded-full bg-red-900/60 px-2.5 py-0.5 text-[11px] font-bold text-red-200 border border-red-700">
                    EMERGENCY CALL: 112
                  </span>
                </div>
                <h3 className="mt-1 text-base font-extrabold text-white">
                  {emergencyGuidance.alert}
                </h3>
                <p className="mt-1 text-sm font-medium text-red-100 leading-relaxed">
                  {emergencyGuidance.action}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-red-500 transition"
                  >
                    <Siren className="h-4 w-4" />
                    <span>Dial Emergency 112 Now</span>
                  </a>
                  <span className="text-[11px] text-red-300/80 italic">
                    {emergencyGuidance.disclaimer}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Bar: Language & Reporter */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <Languages className="h-4 w-4 text-cyan-400" />
                <span>Spoken Language / భాష / மொழி / भाषा:</span>
              </label>
              <select
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                id="language-selector"
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Intake Reporter:
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              >
                <option value="patient">Patient (Self-Report)</option>
                <option value="relative">Relative / Family Member</option>
                <option value="paramedic">Paramedic (Ambulance Unit)</option>
                <option value="community_health_worker">Community Health Worker (ASHA)</option>
              </select>
            </div>
          </div>

          {/* Paramedic Fast Intake Bar */}
          {source === "paramedic" && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-red-300 uppercase">
                  <Siren className="h-4 w-4 text-red-400" />
                  Paramedic Fast-Track Streaming
                </span>
                <span className="text-[11px] text-red-400 font-semibold">Live Receiving Desk</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">ETA (Mins)</label>
                  <input
                    type="number"
                    value={eta}
                    onChange={(e) => setEta(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">SpO2 (%)</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={hr}
                    onChange={(e) => setHr(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">BP (mmHg)</label>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">1-Tap Emergency Codes:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      triggerFastCode(
                        "STEMI",
                        "Crushing acute retrosternal chest pain radiating to left jaw with cold sweats"
                      )
                    }
                    className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-600/30"
                  >
                    🔴 STEMI (Cardiac)
                  </button>
                  <button
                    onClick={() =>
                      triggerFastCode(
                        "STROKE",
                        "Sudden right facial droop, arm weakness, slurred speech within 2 hours"
                      )
                    }
                    className="rounded-lg border border-yellow-500/40 bg-yellow-600/20 px-3 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-600/30"
                  >
                    🟡 Code Stroke
                  </button>
                  <button
                    onClick={() =>
                      triggerFastCode(
                        "TRAUMA",
                        "Severe motor vehicle collision with uncontrolled limb hemorrhage and confusion"
                      )
                    }
                    className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-600/30"
                  >
                    🔴 Major Trauma
                  </button>
                  <button
                    onClick={() =>
                      triggerFastCode(
                        "RESP_FAILURE",
                        "Severe acute respiratory failure, cyanotic lips and gasping"
                      )
                    }
                    className="rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 py-1 text-xs font-bold text-blue-300 hover:bg-blue-600/30"
                  >
                    🔵 Resp Failure
                  </button>
                </div>
              </div>

              <button
                onClick={transmitAmbulance}
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/40 hover:opacity-95 transition"
              >
                🚨 Transmit Pre-Arrival Telemetry to Emergency Desk
              </button>
            </div>
          )}
        </div>

        {/* Conversation History Area (Feature 3 & 4) */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>Conversation Dialogue History</span>
            </h2>
            <span className="text-xs text-slate-400">
              {messages.length} {messages.length === 1 ? "turn" : "turns"} recorded
            </span>
          </div>

          <div
            id="chat-history-container"
            className="space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {messages.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs sm:text-sm space-y-2">
                <Mic className="mx-auto h-8 w-8 text-slate-600" />
                <p>No messages yet. Speak or type your symptoms below to begin triage intake.</p>
              </div>
            )}

            {messages.map((m, idx) => {
              const isPatient = m.sender === "patient";
              const langLabel =
                SUPPORTED_LANGUAGES.find((l) => l.code === m.language)?.name || m.language;

              return (
                <div
                  key={m.id || idx}
                  className={`flex flex-col ${isPatient ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                      isPatient
                        ? "bg-blue-600/25 border border-blue-500/40 text-white"
                        : "bg-slate-800/90 border border-white/10 text-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-400 mb-1.5 pb-1 border-b border-white/5">
                      <span>{isPatient ? "👤 Patient Statement" : "🤖 Clinical Intake Assistant"}</span>
                      {m.language && m.language !== "en" && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">
                          {langLabel}
                        </span>
                      )}
                    </div>

                    {/* Original language text */}
                    <div className="text-sm font-semibold text-white leading-relaxed">
                      {m.original_text}
                    </div>

                    {/* English Translation */}
                    {m.english_text && (m.english_text.trim() !== m.original_text?.trim() || (m.language && m.language !== "en")) && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-xs text-slate-300 italic flex items-start gap-1.5">
                        <span className="font-bold text-[10px] uppercase text-cyan-400 not-italic shrink-0">
                          EN:
                        </span>
                        <span>{m.english_text}</span>
                      </div>
                    )}

                    {/* Backend Generated Timestamp (Feature 4) */}
                    <div className="mt-2 text-[10px] text-slate-400 text-right flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(m.submitted_at || m.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AI Follow-Up Question Callout */}
            {nextQuestion && (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/50 p-4 shadow-xl space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                    <HelpCircle className="h-4 w-4" />
                    <span>Clinical Follow-Up Question:</span>
                  </div>
                  {lang !== "en" && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-cyan-300 font-semibold">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name || lang}
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-white">{nextQuestion.native}</div>
                {nextQuestion.en && (nextQuestion.en.trim() !== nextQuestion.native?.trim() || lang !== "en") && (
                  <div className="text-xs text-cyan-300/80 italic pt-1 border-t border-white/5 flex items-start gap-1.5">
                    <span className="font-semibold text-cyan-400 not-italic shrink-0">EN:</span>
                    <span>{nextQuestion.en}</span>
                  </div>
                )}
              </div>
            )}

            {/* Readback Verification Area */}
            {readback && !confirmed && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 p-4 shadow-xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="h-4 w-4" />
                    <span>Symptom Verification (Readback):</span>
                  </div>
                  {lang !== "en" && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-emerald-300 font-semibold">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name || lang}
                    </span>
                  )}
                </div>
                <div className="text-sm text-emerald-100">{readback.native}</div>
                {readback.en && (readback.en.trim() !== readback.native?.trim() || lang !== "en") && (
                  <div className="text-xs text-emerald-300/80 italic pt-1 border-t border-white/5 flex items-start gap-1.5">
                    <span className="font-semibold text-emerald-400 not-italic shrink-0">EN:</span>
                    <span>{readback.en}</span>
                  </div>
                )}
                <button
                  onClick={handleConfirmIntake}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                >
                  ✓ Yes, That is Correct (Confirm Intake)
                </button>
              </div>
            )}


            {confirmed && (
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/60 p-4 text-center space-y-1">
                <CheckCircle className="mx-auto h-6 w-6 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Intake Confirmed &amp; Queued</h4>
                <p className="text-xs text-emerald-200">
                  Transmitted live to the nurse command queue.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* VOICE RECORDING & TRANSCRIPTION PREVIEW COMPOSER (Feature 1, 2, 3) */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-md space-y-5 shadow-xl">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Mic className="h-4 w-4 text-cyan-400" />
              <span>Voice Intake &amp; Live Speech Preview</span>
            </span>

            {/* Recording State Badges (Feature 1) */}
            <div>
              {recordingStatus === "listening" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/40 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  Listening... Speak now
                </span>
              )}
              {recordingStatus === "processing" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/40">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-spin" />
                  Processing Transcription &amp; Translation...
                </span>
              )}
              {recordingStatus === "ready" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                  ✓ Transcription Ready for Review
                </span>
              )}
              {recordingStatus === "error" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-400 border border-rose-500/40">
                  Recording Error
                </span>
              )}
              {recordingStatus === "idle" && (
                <span className="text-xs text-slate-400">Ready to record</span>
              )}
            </div>
          </div>

          {/* Recording Controls: Big Mic Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              id="mic-recording-btn"
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl transition duration-300 ${
                isRecording
                  ? "bg-red-600 shadow-red-600/50 scale-105 animate-pulse"
                  : "bg-gradient-to-tr from-blue-600 via-cyan-500 to-teal-400 shadow-cyan-500/40 hover:scale-105"
              }`}
            >
              {isRecording ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
            </button>

            <div className="text-center sm:text-left space-y-1">
              <div className="text-sm font-bold text-white">
                {isRecording ? "Recording active — Click to Stop" : "Tap Microphone to Speak"}
              </div>
              <p className="text-xs text-slate-400">
                Speaks in {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label || lang}
              </p>
            </div>
          </div>

          {/* Progressive Interim Speech Indicator */}
          {interimSpeech && isRecording && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-cyan-200 italic animate-pulse">
              <span className="font-bold not-italic text-cyan-400 mr-2">Hearing:</span>
              “{interimSpeech}”
            </div>
          )}

          {/* Error Banner with Retry */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={startRecording}
                className="rounded-lg bg-rose-600/40 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-600"
              >
                Retry
              </button>
            </div>
          )}

          {/* Editable Transcription & Translation Previews (Feature 1, 2, 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Original Language Transcript */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>
                    Original Speech Transcript (
                    {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name || lang})
                  </span>
                </label>
                <button
                  onClick={handleUpdateTranslation}
                  disabled={translatingDraft || !originalDraft.trim()}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-40 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{translatingDraft ? "Translating..." : "Update Translation"}</span>
                </button>
              </div>
              <textarea
                id="original-transcript-preview"
                rows={4}
                value={originalDraft}
                onChange={(e) => setOriginalDraft(e.target.value)}
                placeholder={`Recognized ${SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name} words appear here. You can edit before submitting.`}
                className="w-full rounded-xl border border-white/10 bg-slate-800/90 p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition leading-relaxed"
              />
            </div>

            {/* Box 2: English Translation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>English Translation (Nurse View)</span>
                </label>
                <span className="text-[10px] text-slate-400">Editable preview</span>
              </div>
              <textarea
                id="english-translation-preview"
                rows={4}
                value={englishDraft}
                onChange={(e) => setEnglishDraft(e.target.value)}
                placeholder="English translation appears here. You can refine or verify before submitting."
                className="w-full rounded-xl border border-white/10 bg-slate-800/90 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition leading-relaxed"
              />
            </div>
          </div>

          {/* Quick Multilingual Demos */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <span className="text-xs font-semibold text-slate-400">
              Quick Multilingual Test Utterances:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  text: "मुझे बहुत तेज सिरदर्द है, उल्टी जैसा लग रहा है",
                  eng: "I have a severe headache, feeling like vomiting",
                  l: "hi",
                  label: "🔴 Hindi: Headache (सिरदर्द)",
                },
                {
                  text: "मेरे सीने में तेज दर्द हो रहा है और सांस लेने में दिक्कत है",
                  eng: "I have severe chest pain and difficulty breathing",
                  l: "hi",
                  label: "🔴 Hindi: Cardiac (सीने में दर्द)",
                },
                {
                  text: "నాకు ఛాతీలో తీవ్రమైన నొప్పిగా ఉంది, చెమటలు పడుతున్నాయి, 9/10",
                  eng: "I have severe crushing chest pain, sweating profusely, 9/10",
                  l: "te",
                  label: "🔴 Telugu: Cardiac (ఛాతీలో నొప్పి)",
                },
                {
                  text: "నాకు తలనొప్పిగా ఉంది",
                  eng: "I have a headache",
                  l: "te",
                  label: "🔵 Telugu: Headache (తలనొప్పి)",
                },
                {
                  text: "என் மகளுக்கு 2 நாட்களாக காய்ச்சல், பால் குடிக்கிறாள்",
                  eng: "My daughter has had fever for 2 days, drinking milk",
                  l: "ta",
                  label: "🟢 Tamil: Pediatric Fever",
                },
                {
                  text: "सड़क दुर्घटना, मरीज बेहोश है, बहुत खून बह रहा है",
                  eng: "Road accident, patient is unconscious and bleeding profusely",
                  l: "hi",
                  label: "🔴 Hindi: Trauma Emergency",
                },
                {
                  text: "ಉಸಿರಾಟಕ್ಕೆ ತುಂಬಾ ತೊಂದರೆ, ಮಾತನಾಡಲು ಆಗುತ್ತಿಲ್ಲ",
                  eng: "Severe difficulty breathing, unable to speak",
                  l: "kn",
                  label: "🔴 Kannada: Severe Dyspnea",
                },
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleLanguageChange(s.l);
                    setOriginalDraft(s.text);
                    setEnglishDraft(s.eng);
                    setRecordingStatus("ready");
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls: Clear & Submit Button (Feature 1, 3, 4) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={handleClear}
              disabled={!originalDraft && !englishDraft}
              className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Clear Text</span>
            </button>

            <button
              onClick={handleSubmitMessage}
              disabled={submitting || (!originalDraft.trim() && !englishDraft.trim())}
              id="submit-symptoms-btn"
              className="flex-1 w-full rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 py-3.5 px-6 text-sm font-bold text-white shadow-xl shadow-cyan-600/30 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Submitting &amp; Analyzing Symptoms...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Symptoms to Nurse Queue</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5–7 SYMPTOM QUESTIONS BATCH (Requirement 2, 3, 4) */}
        {questionnaire.length > 0 && (
          <div
            ref={questionnaireRef}
            id="symptom-questionnaire-section"
            className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-5 sm:p-6 backdrop-blur-md shadow-2xl space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 text-white shadow-md">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Clinical Follow-Up Questionnaire</span>
                    <span className="text-xs font-normal text-cyan-300">
                      ({questionnaire.length} protocol questions)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Single-tap responses help clinical nurses prioritize care quickly. Never auto-fills "No".
                  </p>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">
                  Answered: {questionnaire.filter((q) => q.is_answered).length} of {questionnaire.length}
                </span>
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 border border-cyan-500/30">
                  {Math.round(
                    (questionnaire.filter((q) => q.is_answered).length / questionnaire.length) * 100
                  )}
                  %
                </span>
              </div>
            </div>

            {/* Questions Batch */}
            <div className="space-y-4">
              {questionnaire.map((q, idx) => {
                const selectedAns = patientAnswers[q.id] || q.answer;
                const isAnswered = Boolean(selectedAns);
                const isRedFlagQuestion = Boolean(q.red_flag_if);

                return (
                  <div
                    key={q.id}
                    id={`question-item-${q.id}`}
                    className={`rounded-xl border p-4 transition space-y-3 ${
                      isAnswered
                        ? "border-emerald-500/30 bg-slate-800/80"
                        : "border-amber-500/30 bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {q.category.toUpperCase()}
                          </span>
                          {isRedFlagQuestion && (
                            <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                              Priority Safety Rule
                            </span>
                          )}
                        </div>
                        {/* Native Question Text */}
                        <h4 className="text-sm sm:text-base font-semibold text-white leading-relaxed pt-1">
                          {q.text_native}
                        </h4>
                        {/* English Question Text if different */}
                        {q.text_en && q.text_en !== q.text_native && (
                          <p className="text-xs text-slate-400 italic">EN: {q.text_en}</p>
                        )}
                      </div>

                      {/* Answered / Unanswered Badge */}
                      <div>
                        {isAnswered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="h-3 w-3" />
                            Answered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30">
                            Unanswered
                          </span>
                        )}
                      </div>
                    </div>

                    {/* YES / NO / NOT SURE Touch Buttons (Requirement 3) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                      {/* YES Button */}
                      <button
                        type="button"
                        id={`btn-yes-${q.id}`}
                        disabled={answeringQuestionId === q.id}
                        onClick={() => handleAnswerQuestion(q.id, "yes")}
                        className={`rounded-xl py-3 px-2 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                          selectedAns === "yes"
                            ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-emerald-600/40"
                            : "bg-slate-700/60 hover:bg-emerald-950/60 text-slate-200 border border-white/10 hover:border-emerald-500/40"
                        }`}
                      >
                        <span>YES</span>
                        {selectedAns === "yes" && <span>✓</span>}
                      </button>

                      {/* NO Button */}
                      <button
                        type="button"
                        id={`btn-no-${q.id}`}
                        disabled={answeringQuestionId === q.id}
                        onClick={() => handleAnswerQuestion(q.id, "no")}
                        className={`rounded-xl py-3 px-2 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                          selectedAns === "no"
                            ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 shadow-blue-600/40"
                            : "bg-slate-700/60 hover:bg-blue-950/60 text-slate-200 border border-white/10 hover:border-blue-500/40"
                        }`}
                      >
                        <span>NO</span>
                        {selectedAns === "no" && <span>✓</span>}
                      </button>

                      {/* NOT SURE Button */}
                      <button
                        type="button"
                        id={`btn-not-sure-${q.id}`}
                        disabled={answeringQuestionId === q.id}
                        onClick={() => handleAnswerQuestion(q.id, "not_sure")}
                        className={`rounded-xl py-3 px-2 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                          selectedAns === "not_sure"
                            ? "bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-600/40"
                            : "bg-slate-700/60 hover:bg-amber-950/60 text-slate-200 border border-white/10 hover:border-amber-500/40"
                        }`}
                      >
                        <span>NOT SURE</span>
                        {selectedAns === "not_sure" && <span>✓</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verification Action Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
              <div className="text-xs text-slate-400">
                {questionnaire.some((q) => !q.is_answered) ? (
                  <span className="text-amber-400 font-medium">
                    ⚠️ {questionnaire.filter((q) => !q.is_answered).length} question(s) remain unanswered. You may still review the report.
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    ✓ All questions answered. Ready for report verification.
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowVerificationModal(true)}
                id="open-report-verification-btn"
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xl shadow-teal-600/30 hover:opacity-95 transition flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span>Review &amp; Verify Patient Report</span>
              </button>
            </div>
          </div>
        )}

        {/* STRUCTURED CLINICAL INTAKE SUMMARY CARD (Feature 6 & 7) */}
        {clinicalSummary && (
          <div
            id="clinical-summary-card"
            className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <FileText className="h-5 w-5" />
                <span>Structured Clinical Intake Summary</span>
              </div>
              <span className="rounded-full bg-cyan-500/20 px-3 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/30">
                Priority: {clinicalSummary.triage_priority}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">Chief Complaint</span>
                <span className="font-bold text-white capitalize">
                  {clinicalSummary.chief_complaint}
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">Symptom Onset</span>
                <span className="font-semibold text-slate-200">
                  {clinicalSummary.symptom_onset}
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">Severity Rating</span>
                <span className="font-bold text-amber-400">{clinicalSummary.severity}</span>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">Location / Pattern</span>
                <span className="font-semibold text-slate-200">
                  {clinicalSummary.pain_location} ({clinicalSummary.frequency})
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">Original Statement</span>
                <span className="font-medium text-slate-200 italic">
                  “{clinicalSummary.original_patient_statement}”
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-3 border border-white/5">
                <span className="text-slate-400 block text-[11px]">English Translation</span>
                <span className="font-medium text-slate-200 italic">
                  “{clinicalSummary.english_translation}”
                </span>
              </div>
            </div>

            {clinicalSummary.safety_flags && clinicalSummary.safety_flags.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-bold text-rose-400">Detected Safety Flags:</span>
                <div className="flex flex-wrap gap-2">
                  {clinicalSummary.safety_flags.map((flag, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-300"
                    >
                      ⚠️ {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
              <span>Intake Started: {formatTimestamp(clinicalSummary.intake_started)}</span>
              <span>Last Updated: {formatTimestamp(clinicalSummary.last_updated)}</span>
              <span className="italic text-slate-500">{clinicalSummary.disclaimer}</span>
            </div>
          </div>
        )}
      </main>

      {/* CONFIRMATION MODAL FOR "NEW PATIENT" (Feature 11) */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <UserPlus className="h-5 w-5" />
                <span>Start New Patient Session?</span>
              </div>
              <button
                onClick={() => setShowNewPatientModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
              <p>
                Starting a <b>New Patient</b> session will reset the current intake screen and start
                a fresh clinical conversation.
              </p>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                ✓ <b>Your current patient record is completely preserved</b> in the database and remains
                available to authorized nurses in the Command Center. It will never be deleted.
              </div>
              {messages.length > 0 && !confirmed && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
                  ⚠️ Note: The current intake has unconfirmed items. Starting a new patient will
                  keep this session in the queue as pending review.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowNewPatientModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel (Keep Current Patient)
              </button>
              <button
                onClick={handleConfirmNewPatient}
                id="confirm-new-patient-btn"
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition"
              >
                Confirm New Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGIONAL-LANGUAGE REPORT VERIFICATION MODAL (Requirement 6) */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="w-full max-w-2xl my-auto rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base">
                <FileText className="h-5 w-5" />
                <span>Patient Intake Verification &amp; Report Review</span>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Optional Patient Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Patient Name / రోగి పేరు (Optional):
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter patient full name..."
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Side-by-Side: Original Statement & English Translation */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-cyan-400" />
                <span>Initial Patient Distress Statement (Side-by-Side)</span>
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Original Language */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-300">
                    <span>Preferred Language ({SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name || lang})</span>
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5">Original</span>
                  </div>
                  <div className="text-sm font-semibold text-white leading-relaxed pt-1">
                    {messages.filter((m) => m.sender === "patient").slice(-1)[0]?.original_text ||
                      originalDraft ||
                      "No statement recorded"}
                  </div>
                </div>

                {/* English Translation */}
                <div className="rounded-xl border border-teal-500/30 bg-teal-950/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-teal-300">
                    <span>Clinical Nurse View</span>
                    <span className="rounded bg-teal-500/20 px-1.5 py-0.5">English Translation</span>
                  </div>
                  <div className="text-sm font-semibold text-white leading-relaxed pt-1">
                    {messages.filter((m) => m.sender === "patient").slice(-1)[0]?.english_text ||
                      englishDraft ||
                      "No translation available"}
                  </div>
                </div>
              </div>
            </div>

            {/* Follow-up Questions & Recorded Answers */}
            {questionnaire.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Follow-Up Questionnaire Answers:
                </span>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 rounded-xl border border-white/5 bg-slate-950/60 p-3 scrollbar-thin scrollbar-thumb-slate-700">
                  {questionnaire.map((q, i) => {
                    const ans = patientAnswers[q.id] || q.answer;
                    return (
                      <div
                        key={q.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-800/60 p-2.5 text-xs"
                      >
                        <div className="space-y-0.5 pr-2">
                          <div className="text-white font-medium">{q.text_native}</div>
                          {q.text_en && q.text_en !== q.text_native && (
                            <div className="text-[11px] text-slate-400 italic">EN: {q.text_en}</div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {ans === "yes" && (
                            <span className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                              YES ✓
                            </span>
                          )}
                          {ans === "no" && (
                            <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                              NO
                            </span>
                          )}
                          {ans === "not_sure" && (
                            <span className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                              NOT SURE ?
                            </span>
                          )}
                          {!ans && (
                            <span className="rounded-md bg-rose-950 px-2.5 py-1 text-xs font-bold text-rose-300 border border-rose-800">
                              UNANSWERED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clinical Summary & Uncertainties Indication */}
            {clinicalSummary && (
              <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 space-y-2 text-xs">
                <div className="text-xs font-bold text-cyan-300">Clinical Triage Summary:</div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Chief Complaint</span>
                    <span className="font-semibold text-white capitalize">{clinicalSummary.chief_complaint}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Triage Priority</span>
                    <span className="font-bold text-amber-400">{clinicalSummary.triage_priority}</span>
                  </div>
                </div>
                {clinicalSummary.missing_information && clinicalSummary.missing_information.length > 0 && (
                  <div className="text-amber-300 text-[11px] pt-1 border-t border-white/5">
                    <b>Uncertain / Missing Information:</b> {clinicalSummary.missing_information.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* THREE ACTIONS (Requirement 6) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/10">
              {/* ACTION 1: CONFIRM REPORT */}
              <button
                onClick={handleConfirmReport}
                id="modal-confirm-report-btn"
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 px-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:opacity-95 transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                <span>CONFIRM REPORT</span>
              </button>

              {/* ACTION 2: EDIT ANSWERS */}
              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  questionnaireRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                id="modal-edit-answers-btn"
                className="rounded-xl border border-white/10 bg-slate-800 py-3 px-3 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <Edit3 className="h-4 w-4 text-cyan-400" />
                <span>EDIT ANSWERS</span>
              </button>

              {/* ACTION 3: CORRECT STATEMENT */}
              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  handleOpenCorrection();
                }}
                id="modal-correct-statement-btn"
                className="rounded-xl border border-amber-500/40 bg-amber-950/40 py-3 px-3 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-900/50 transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4 text-amber-400" />
                <span>CORRECT STATEMENT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT CORRECTION MODAL (Requirement 6) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <RotateCcw className="h-5 w-5" />
                <span>Correct Distress Statement</span>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Edit any transcription mistakes in your preferred language. The correction history
              will be preserved and re-translated for the clinical nurse.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Original Statement ({SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.name || lang}):
              </label>
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Type or correct your statement here..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCorrection}
                disabled={correctingStatement || !correctionText.trim()}
                id="save-statement-correction-btn"
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 disabled:opacity-40 transition flex items-center gap-1.5"
              >
                {correctingStatement ? (
                  <span>Re-translating &amp; Saving...</span>
                ) : (
                  <span>Save Statement Correction</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
