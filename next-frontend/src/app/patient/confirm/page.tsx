"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { ConfirmationPanel, ConfirmationData } from "@/components/ConfirmationPanel";
import { MOCK_CLINICAL_CASES } from "@/lib/mockData";
import { offlineStorage } from "@/lib/offlineStorage";

export default function PatientConfirmPage() {
  const router = useRouter();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const confirmedCaseId = "PAT-HI-8402";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const drafts = offlineStorage.getAllDrafts();
      if (drafts.length > 0) {
        setDraft(drafts[0]);
      }
    }
  }, []);

  const sampleCase = MOCK_CLINICAL_CASES[0];
  const isHeadache = draft && /headache|head|सिरदर्द|सिर दर्द|तలనొప్పి/i.test(`${draft.englishDraftText || ""} ${draft.nativeDraftText || ""}`);

  const confirmationData: ConfirmationData = {
    complaint: draft
      ? {
          value: draft.englishDraftText || draft.nativeDraftText,
          confidence: 0.95,
          confidenceLevel: "high",
          source: "patient_confirmed",
          originalText: draft.nativeDraftText,
          translatedText: draft.englishDraftText,
        }
      : sampleCase.chiefComplaint,
    severity: isHeadache
      ? {
          value: 8,
          confidence: 0.94,
          confidenceLevel: "high",
          source: "patient_confirmed",
          originalText: draft?.nativeDraftText,
          translatedText: "Pain is 8 out of 10, intense pressure.",
        }
      : sampleCase.severity,
    onset: draft
      ? {
          value: "Sudden onset within last 2 hours",
          confidence: 0.90,
          confidenceLevel: "high",
          source: "ai_extracted",
          originalText: draft?.nativeDraftText,
          translatedText: "Started within last 2 hours.",
        }
      : sampleCase.onsetText,
    location: isHeadache
      ? {
          value: "Head / Frontal & Temporal regions",
          confidence: 0.93,
          confidenceLevel: "high",
          source: "ai_extracted",
          originalText: draft?.nativeDraftText,
          translatedText: "Bilateral frontal and temporal headache.",
        }
      : sampleCase.location,
    associatedSymptoms: isHeadache
      ? {
          value: ["Severe headache", "Dizziness", "Photophobia"],
          confidence: 0.91,
          confidenceLevel: "high",
          source: "ai_extracted",
          originalText: draft?.nativeDraftText,
          translatedText: "Headache, dizziness, light sensitivity.",
        }
      : sampleCase.associatedSymptoms,
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
  };

  const handleCorrect = () => {
    // Navigate back to voice intake or clarification
    router.push("/patient");
  };

  const handleRepeatAudio = () => {
    // Audio synthesis placeholder
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
          Step 3: Verification &amp; Read-Back
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
          Confirm Your Symptom Report
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6575] mt-1">
          Review the clinical information extracted from your speech before it is transmitted to the emergency intake nurse.
        </p>
      </div>

      {isConfirmed ? (
        <NeumorphicCard variant="raised" className="p-8 sm:p-12 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-[#16805B]/15 text-[#16805B] flex items-center justify-center mx-auto border-2 border-[#16805B]/30 shadow-neu-raised">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#172033]">
              Intake Report Confirmed &amp; Transmitted
            </h2>
            <p className="text-sm text-[#5B6575] max-w-md mx-auto">
              Your information has been securely transmitted to the Triage Command Desk. A qualified emergency nurse will review your case immediately.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 max-w-md mx-auto space-y-2 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5B6575]">
              <span>Triage Queue Reference:</span>
              <span className="font-mono text-[#2563EB] font-bold text-sm">#{confirmedCaseId}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#5B6575]">
              <span>Triage Station:</span>
              <span className="text-[#172033]">Emergency Intake Desk A</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#5B6575]">
              <span>Status:</span>
              <span className="text-[#16805B] font-bold">Awaiting Nurse Bedside Review</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href="/nurse">
              <NeumorphicButton
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View in Nurse Command Center
              </NeumorphicButton>
            </Link>
            <Link href="/">
              <NeumorphicButton variant="default" size="lg">
                Return to Home
              </NeumorphicButton>
            </Link>
          </div>
        </NeumorphicCard>
      ) : (
        <ConfirmationPanel
          data={confirmationData}
          nativeLanguageLabel="Telugu (తెలుగు)"
          onConfirm={handleConfirm}
          onCorrect={handleCorrect}
          onRepeatAudio={handleRepeatAudio}
        />
      )}
    </div>
  );
}
