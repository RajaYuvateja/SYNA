"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Mic,
  Check,
  X,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { HumanEscalationButton } from "@/components/HumanEscalationButton";
import { AudioWaveform } from "@/components/AudioWaveform";
import { LanguageSelector } from "@/components/LanguageSelector";
import { RegionalLanguage, ClarifyingQuestion } from "@/types/syna";
import { getClarifyingQuestions } from "@/lib/mockData";
import { offlineStorage } from "@/lib/offlineStorage";

const QUICK_LABELS: Record<RegionalLanguage, { yes: string; no: string; unsure: string }> = {
  hi: { yes: "हाँ (Yes)", no: "नहीं (No)", unsure: "पता नहीं (Not sure)" },
  te: { yes: "అవును (Yes)", no: "కాదు (No)", unsure: "తెలియదు (Not sure)" },
  ta: { yes: "ஆம் (Yes)", no: "இல்லை (No)", unsure: "தெரியாது (Not sure)" },
  kn: { yes: "ಹೌದು (Yes)", no: "ಇಲ್ಲ (No)", unsure: "ಗೊತ್ತಿಲ್ಲ (Not sure)" },
  ml: { yes: "അതെ (Yes)", no: "അല്ല (No)", unsure: "അറിയില്ല (Not sure)" },
  bn: { yes: "হ্যাঁ (Yes)", no: "না (No)", unsure: "জানি না (Not sure)" },
  mr: { yes: "होय (Yes)", no: "नाही (No)", unsure: "माहित नाही (Not sure)" },
  gu: { yes: "હા (Yes)", no: "ના (No)", unsure: "ખબર નથી (Not sure)" },
  or: { yes: "ହଁ (Yes)", no: "ନାହିଁ (No)", unsure: "ଜଣାନାହିଁ (Not sure)" },
  pa: { yes: "ਹਾਂ (Yes)", no: "ਨਹੀਂ (No)", unsure: "ਪਤਾ ਨਹੀਂ (Not sure)" },
  en: { yes: "Yes", no: "No", unsure: "I do not know / Not sure" },
};

export default function ClarifyPage() {
  const router = useRouter();
  const [currentLanguage, setCurrentLanguage] = useState<RegionalLanguage>("hi");
  const [symptomCategory, setSymptomCategory] = useState<string>("headache");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<string | null>(null);

  // Load latest draft and detect symptom category and preferred language
  useEffect(() => {
    if (typeof window !== "undefined") {
      const drafts = offlineStorage.getAllDrafts();
      const latestDraft = drafts.length > 0 ? drafts[0] : null;

      let detectedLang: RegionalLanguage = "hi";
      const savedLang = localStorage.getItem("syna_selected_language") as RegionalLanguage | null;
      if (savedLang) detectedLang = savedLang;
      if (latestDraft?.language) detectedLang = latestDraft.language;
      setCurrentLanguage(detectedLang);

      // Detect symptom category from draft text
      const combinedText = `${latestDraft?.englishDraftText || ""} ${latestDraft?.nativeDraftText || ""}`.toLowerCase();
      let cat = "headache";
      if (
        combinedText.includes("chest") ||
        combinedText.includes("cardiac") ||
        combinedText.includes("heart") ||
        combinedText.includes("छाती") ||
        combinedText.includes("ఛాతీ")
      ) {
        cat = "chest_pain";
      } else if (
        combinedText.includes("headache") ||
        combinedText.includes("head") ||
        combinedText.includes("सिरदर्द") ||
        combinedText.includes("सिर दर्द") ||
        combinedText.includes("सरदर्द") ||
        combinedText.includes("तలనొప్పి")
      ) {
        cat = "headache";
      }
      setSymptomCategory(cat);

      const onLang = (e: any) => {
        if (e.detail) setCurrentLanguage(e.detail);
      };
      window.addEventListener("syna_language_changed", onLang);
      return () => window.removeEventListener("syna_language_changed", onLang);
    }
  }, []);

  const handleLanguageChange = (newLang: RegionalLanguage) => {
    setCurrentLanguage(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("syna_selected_language", newLang);
      window.dispatchEvent(new CustomEvent("syna_language_changed", { detail: newLang }));
    }
  };

  const questions: ClarifyingQuestion[] = getClarifyingQuestions(symptomCategory, currentLanguage);
  const currentQuestion = questions[currentIndex] || questions[0];
  const progressPercent = Math.round(((currentIndex + 1) / Math.max(questions.length, 1)) * 100);

  const handleSelectAnswer = (answer: string) => {
    if (!currentQuestion) return;
    const updated = { ...answers, [currentQuestion.id]: answer };
    setAnswers(updated);
    setVoiceDraft(null);
    setIsVoiceActive(false);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Save answers in draft and navigate to confirm
      const drafts = offlineStorage.getAllDrafts();
      if (drafts.length > 0) {
        const latest = drafts[0];
        offlineStorage.saveDraft({
          ...latest,
          answers: updated,
        });
      }
      router.push("/patient/confirm");
    }
  };

  const handleVoiceAnswer = () => {
    setIsVoiceActive(true);
    setTimeout(() => {
      let draftAnswer = "No complications reported";
      if (symptomCategory === "headache") {
        draftAnswer =
          currentLanguage === "hi"
            ? "नहीं, गर्दन में अकड़न या उल्टी नहीं है (No, no neck stiffness or vomiting)"
            : currentLanguage === "te"
            ? "లేదు, మెడ పట్టేయడం లేదా వాంతులు లేవు (No neck stiffness or vomiting)"
            : "No, no fever or neck stiffness";
      } else {
        draftAnswer =
          currentLanguage === "hi"
            ? "हाँ, हल्का दर्द है (Yes, mild discomfort)"
            : currentLanguage === "te"
            ? "అవును, నొప్పి ఉంది (Yes, discomfort present)"
            : "Yes, discomfort present";
      }
      setVoiceDraft(draftAnswer);
      setIsVoiceActive(false);
    }, 1800);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const quickLabels = QUICK_LABELS[currentLanguage] || QUICK_LABELS.hi;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Progress & Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            aria-label="Previous question"
            className="p-2.5 rounded-xl bg-[#E8EDF2] shadow-neu-raised hover:bg-[#EEF2F6] active:shadow-neu-pressed border border-white/60 text-[#5B6575] disabled:opacity-40 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              Step 2: Adaptive Clinical Clarification ({symptomCategory.toUpperCase().replace("_", " ")})
            </span>
            <div className="text-sm font-semibold text-[#172033]">
              Question {currentIndex + 1} of {questions.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
          />
        </div>
      </div>

      {/* Neumorphic Progress Bar */}
      <div className="w-full h-3 rounded-full bg-[#DEE5EC] shadow-neu-pressed p-0.5 border border-white/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Main Single Question Card */}
      {currentQuestion && (
        <NeumorphicCard variant="raised" className="p-6 sm:p-10 space-y-8 animate-in fade-in duration-200">
          {/* Category Badge */}
          <div className="flex items-center justify-between border-b border-black/5 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B6575] bg-[#DEE5EC] px-3 py-1 rounded-full shadow-neu-pressed">
              Clinical Area: {currentQuestion.category}
            </span>
            {currentQuestion.redFlagIfYes && (
              <span className="text-xs font-bold text-[#C24141] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> High Clinical Significance
              </span>
            )}
          </div>

          {/* Large Readable Question: Native on Top, English Directly Underneath */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] leading-tight">
              {currentQuestion.textNative}
            </h2>
            <p className="text-sm sm:text-base text-[#5B6575] font-medium leading-relaxed bg-[#DEE5EC]/50 p-3 rounded-xl border border-white/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB] block mb-1">
                English Translation:
              </span>
              {currentQuestion.textEn}
            </p>
          </div>

          {/* Voice Answer Option */}
          <div className="p-4 rounded-2xl bg-[#DEE5EC]/80 shadow-neu-pressed border border-white/50 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#172033]">
              <span className="flex items-center gap-1.5 text-[#2563EB]">
                <Mic className="w-4 h-4" /> Answer using Voice:
              </span>
              <span className="text-[#5B6575]">Speak in {currentLanguage.toUpperCase()} or any preferred language</span>
            </div>

            {isVoiceActive ? (
              <div className="space-y-2 py-2">
                <AudioWaveform isRecording={true} barCount={20} />
                <div className="text-center text-xs font-bold text-[#2563EB] animate-pulse">
                  Listening to your answer...
                </div>
              </div>
            ) : (
              <NeumorphicButton
                variant="default"
                size="md"
                onClick={handleVoiceAnswer}
                leftIcon={<Mic className="w-4 h-4 text-[#2563EB]" />}
                className="w-full"
              >
                Speak Answer
              </NeumorphicButton>
            )}

            {voiceDraft && (
              <div className="p-3 rounded-xl bg-[#E8EDF2] border border-white/70 space-y-2">
                <div className="text-xs text-[#172033] font-semibold">
                  Captured: &ldquo;{voiceDraft}&rdquo;
                </div>
                <div className="flex justify-end gap-2">
                  <NeumorphicButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleSelectAnswer(voiceDraft)}
                  >
                    Confirm This Answer
                  </NeumorphicButton>
                </div>
              </div>
            )}
          </div>

          {/* Quick Answer Buttons: Localized Yes / No / Unsure */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B6575]">
              Or Select Quick Response:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <NeumorphicButton
                variant="default"
                size="lg"
                onClick={() => handleSelectAnswer("Yes")}
                leftIcon={<Check className="w-5 h-5 text-[#16805B]" />}
                className="hover:bg-[#16805B]/10 hover:text-[#16805B]"
              >
                {quickLabels.yes}
              </NeumorphicButton>

              <NeumorphicButton
                variant="default"
                size="lg"
                onClick={() => handleSelectAnswer("No")}
                leftIcon={<X className="w-5 h-5 text-[#C24141]" />}
                className="hover:bg-[#C24141]/10 hover:text-[#C24141]"
              >
                {quickLabels.no}
              </NeumorphicButton>

              <NeumorphicButton
                variant="default"
                size="lg"
                onClick={() => handleSelectAnswer("I do not know / Not sure")}
                leftIcon={<HelpCircle className="w-5 h-5 text-[#5B6575]" />}
              >
                {quickLabels.unsure}
              </NeumorphicButton>
            </div>
          </div>

          {/* Escalation & Nurse Assistance */}
          <div className="pt-4 border-t border-black/5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#5B6575]">
              Uncertain about a question?
            </div>
            <HumanEscalationButton label="Talk to a Nurse" variant="default" size="sm" />
          </div>
        </NeumorphicCard>
      )}
    </div>
  );
}
