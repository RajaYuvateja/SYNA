"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Shield,
  AlertTriangle,
  RotateCcw,
  Type,
  Users,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { LanguageSelector } from "@/components/LanguageSelector";
import { HumanEscalationButton } from "@/components/HumanEscalationButton";
import { sarvamService } from "@/lib/sarvam";
import { offlineStorage } from "@/lib/offlineStorage";
import { RegionalLanguage } from "@/types/syna";

export default function PatientVoiceIntakePage() {
  const router = useRouter();
  const [language, setLanguage] = useState<RegionalLanguage>("hi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"patient" | "caregiver">("patient");

  // Synchronize language state across all app components and localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("syna_selected_language") as RegionalLanguage | null;
      if (saved) setLanguage(saved);

      const handleLangChange = (e: any) => {
        if (e.detail) setLanguage(e.detail);
      };
      window.addEventListener("syna_language_changed", handleLangChange);
      return () => window.removeEventListener("syna_language_changed", handleLangChange);
    }
  }, []);

  const handleLanguageChange = (newLang: RegionalLanguage) => {
    setLanguage(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("syna_selected_language", newLang);
      window.dispatchEvent(new CustomEvent("syna_language_changed", { detail: newLang }));
    }
  };

  // Handle voice recorded
  const handleRecordingComplete = async (audioBlob: Blob, _durationSeconds: number) => {
    setIsProcessing(true);
    setServiceError(null);
    setIsLowConfidence(false);

    try {
      // Check service availability
      if (!sarvamService.isServiceAvailable()) {
        throw new Error("Language service unavailable. Continue with manual entry or request staff assistance.");
      }

      // Call Sarvam AI STT
      const sttResult = await sarvamService.speechToText(audioBlob, language);
      setTranscribedText(sttResult.transcript);
      setConfidence(sttResult.confidence);

      // Auto-detect language if patient spoke a different language (e.g. Hindi)
      let effectiveLang = language;
      if (sttResult.languageCode) {
        const norm = sttResult.languageCode.split("-")[0].toLowerCase() as RegionalLanguage;
        if (norm && norm !== language) {
          effectiveLang = norm;
          handleLanguageChange(norm);
        }
      }

      // Check if low confidence
      if (sttResult.confidence < 0.70) {
        setIsLowConfidence(true);
      }

      // Translate to English
      const transResult = await sarvamService.translateToEnglish(sttResult.transcript, effectiveLang);
      setTranslatedText(transResult.translatedText);

      // Save as draft locally
      offlineStorage.saveDraft({
        id: `draft-${Date.now()}`,
        language: effectiveLang,
        recordedAt: new Date().toISOString(),
        nativeDraftText: sttResult.transcript,
        englishDraftText: transResult.translatedText,
        answers: {},
        syncStatus: "saved_locally",
      });
    } catch (err: any) {
      console.warn("Intake processing error:", err);
      setServiceError(err.message || "Language service unavailable. Continue with manual entry or request staff assistance.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle manual typed fallback
  const handleManualTextSubmit = async (text: string) => {
    setIsProcessing(true);
    setServiceError(null);
    setIsLowConfidence(false);

    try {
      setTranscribedText(text);
      setConfidence(0.95);

      let effectiveLang = language;
      if (/[\u0900-\u097F]/.test(text)) {
        effectiveLang = "hi";
        handleLanguageChange("hi");
      } else if (/[\u0C00-\u0C7F]/.test(text)) {
        effectiveLang = "te";
        handleLanguageChange("te");
      }

      const transResult = await sarvamService.translateToEnglish(text, effectiveLang);
      setTranslatedText(transResult.translatedText);

      offlineStorage.saveDraft({
        id: `draft-${Date.now()}`,
        language: effectiveLang,
        recordedAt: new Date().toISOString(),
        nativeDraftText: text,
        englishDraftText: transResult.translatedText,
        answers: {},
        syncStatus: "saved_locally",
      });
    } catch (err: any) {
      setServiceError(err.message || "Unable to translate text. Proceeding with draft.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToClarify = () => {
    // Navigate to step 2: Clarification questions
    router.push("/patient/clarify");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Role Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
            Voice-First Clinical Intake
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
            Describe Your Symptoms
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Patient vs Caregiver Toggle */}
          <div className="p-1 rounded-xl bg-[#DEE5EC] shadow-neu-pressed flex items-center gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUserRole("patient")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                userRole === "patient"
                  ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB]"
                  : "text-[#5B6575]"
              }`}
            >
              I am the Patient
            </button>
            <button
              type="button"
              onClick={() => setUserRole("caregiver")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                userRole === "caregiver"
                  ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB]"
                  : "text-[#5B6575]"
              }`}
            >
              I am a Caregiver
            </button>
          </div>

          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
        </div>
      </div>

      {/* Main Intake Voice Card */}
      <NeumorphicCard variant="raised" className="p-6 sm:p-8 space-y-6">
        {/* Permission Explanation Note */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#DEE5EC]/80 shadow-neu-pressed border border-white/50 text-xs sm:text-sm text-[#172033]">
          <Shield className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#1E40AF]">Microphone Privacy: </strong>
            Your speech is processed solely for triage information extraction via Sarvam AI. We convert your words into clinical summaries for the hospital nurse.
          </p>
        </div>

        {/* Voice Recorder Component */}
        <VoiceRecorder
          onRecordingComplete={handleRecordingComplete}
          onManualTextSubmit={handleManualTextSubmit}
          isProcessing={isProcessing}
          promptGuidance="Speak naturally in short sentences. E.g., 'मुझे सिरदर्द है' / 'నాకు ఛాతీలో నొప్పి ఉంది' / 'Severe headache since morning'."
        />

        {/* External Service Unavailable Banner */}
        {serviceError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[#B7791F]/15 border border-[#B7791F]/40 text-xs sm:text-sm text-[#172033] space-y-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-bold text-[#B7791F]">
              <AlertTriangle className="w-5 h-5" />
              <span>Language Service Unavailable</span>
            </div>
            <p className="leading-relaxed text-[#5B6575]">
              Language service unavailable. Continue with manual entry or request staff assistance.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <HumanEscalationButton label="Request Staff Assistance" variant="warning" size="sm" />
            </div>
          </div>
        )}

        {/* Low Confidence or Unclear Speech Detection */}
        {isLowConfidence && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[#C24141]/10 border border-[#C24141]/30 text-xs sm:text-sm text-[#172033] space-y-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-bold text-[#C24141]">
              <AlertTriangle className="w-5 h-5" />
              <span>Your response was not clear. Please repeat slowly.</span>
            </div>
            <p className="text-[#5B6575] leading-relaxed">
              We were unable to confidently understand your speech due to audio quality or background noise.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <NeumorphicButton
                variant="default"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => setIsLowConfidence(false)}
              >
                Repeat
              </NeumorphicButton>
              <NeumorphicButton
                variant="default"
                size="sm"
                leftIcon={<Type className="w-3.5 h-3.5" />}
                onClick={() => setIsLowConfidence(false)}
              >
                Type an Answer
              </NeumorphicButton>
              <NeumorphicButton
                variant="default"
                size="sm"
                leftIcon={<Users className="w-3.5 h-3.5" />}
                onClick={() => setUserRole("caregiver")}
              >
                Ask a Caregiver
              </NeumorphicButton>
              <HumanEscalationButton label="Talk to a Nurse" variant="danger" size="sm" />
            </div>
          </div>
        )}

        {/* Transcription Preview if Captured */}
        {transcribedText && (
          <div className="p-4 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033]">
              <span className="flex items-center gap-1.5 text-[#2563EB]">
                <Sparkles className="w-4 h-4" /> Understood Speech:
              </span>
              {confidence !== null && (
                <span className="text-[11px] font-semibold text-[#5B6575]">
                  Sarvam Confidence: {Math.round(confidence * 100)}%
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#E8EDF2] border border-white/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6575] mb-1">
                Your Words ({language.toUpperCase()}):
              </div>
              <p className="text-sm font-semibold text-[#172033]">
                &ldquo;{transcribedText}&rdquo;
              </p>
            </div>

            {translatedText && (
              <div className="p-3 rounded-xl bg-[#E8EDF2] border border-white/70">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">
                  Clinical Translation (English):
                </div>
                <p className="text-sm font-medium text-[#172033]">
                  {translatedText}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <NeumorphicButton
                variant="primary"
                size="md"
                onClick={handleProceedToClarify}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Clarifying Questions
              </NeumorphicButton>
            </div>
          </div>
        )}
      </NeumorphicCard>

      {/* Emergency Escalate Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#DEE5EC]/60 border border-white/50">
        <div className="text-xs text-[#5B6575]">
          Feeling severe shortness of breath, collapse, or unbearable pain?
        </div>
        <HumanEscalationButton label="Immediate Emergency Human Help" variant="danger" size="md" />
      </div>
    </div>
  );
}
