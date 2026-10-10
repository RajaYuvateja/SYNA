"use client";

import React, { useState } from "react";
import { CheckCircle2, Edit2, Volume2, HelpCircle } from "lucide-react";
import { NeumorphicCard } from "./NeumorphicCard";
import { NeumorphicButton } from "./NeumorphicButton";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { HumanEscalationButton } from "./HumanEscalationButton";
import { ClinicalField } from "@/types/syna";

export interface ConfirmationData {
  complaint: ClinicalField<string>;
  severity: ClinicalField<number>;
  onset: ClinicalField<string>;
  location: ClinicalField<string>;
  associatedSymptoms: ClinicalField<string[]>;
}

interface ConfirmationPanelProps {
  data: ConfirmationData;
  nativeLanguageLabel?: string;
  onConfirm: () => void;
  onCorrect: () => void;
  onRepeatAudio: () => void;
}

export const ConfirmationPanel: React.FC<ConfirmationPanelProps> = ({
  data,
  nativeLanguageLabel = "Telugu",
  onConfirm,
  onCorrect,
  onRepeatAudio,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleRepeat = () => {
    setIsPlayingAudio(true);
    onRepeatAudio();
    setTimeout(() => setIsPlayingAudio(false), 3500);
  };

  return (
    <div className="w-full space-y-5">
      {/* Read-Back Header Banner */}
      <div className="p-4 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#172033]">
              Read-Back Verification
            </h3>
            <p className="text-xs text-[#5B6575]">
              Please listen to or read what was understood. Confirm or request corrections.
            </p>
          </div>
        </div>

        <NeumorphicButton
          variant="default"
          size="sm"
          onClick={handleRepeat}
          disabled={isPlayingAudio}
          leftIcon={<Volume2 className="w-4 h-4 text-[#2563EB]" />}
        >
          {isPlayingAudio ? "Reading aloud..." : "Read Aloud in " + nativeLanguageLabel}
        </NeumorphicButton>
      </div>

      {/* Extracted Fields Table / Card Stack */}
      <div className="space-y-3">
        {/* Main Complaint */}
        <NeumorphicCard variant="raised-sm" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#5B6575] uppercase tracking-wider">
              1. Main Concern / Pain
            </span>
            <ConfidenceBadge
              level={data.complaint.confidenceLevel}
              score={data.complaint.confidence}
              source={data.complaint.source}
            />
          </div>
          <p className="text-sm sm:text-base font-semibold text-[#172033]">
            {data.complaint.value}
          </p>
          {data.complaint.originalText && (
            <div className="text-xs text-[#5B6575] bg-[#DEE5EC]/60 p-2 rounded-lg border border-white/40">
              <span className="font-bold text-[#1E40AF]">Spoken ({nativeLanguageLabel}): </span>
              &ldquo;{data.complaint.originalText}&rdquo;
            </div>
          )}
        </NeumorphicCard>

        {/* Severity & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#5B6575] uppercase tracking-wider">
                2. Pain Severity
              </span>
              <ConfidenceBadge
                level={data.severity.confidenceLevel}
                score={data.severity.confidence}
              />
            </div>
            <div className="text-xl font-extrabold text-[#C24141] flex items-baseline gap-1">
              <span>{data.severity.value}</span>
              <span className="text-xs text-[#5B6575]">/ 10</span>
            </div>
          </NeumorphicCard>

          <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#5B6575] uppercase tracking-wider">
                3. Body Location
              </span>
              <ConfidenceBadge
                level={data.location.confidenceLevel}
                score={data.location.confidence}
              />
            </div>
            <p className="text-sm font-semibold text-[#172033]">
              {data.location.value}
            </p>
          </NeumorphicCard>
        </div>

        {/* Onset & Duration */}
        <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#5B6575] uppercase tracking-wider">
              4. Onset & Duration
            </span>
            <ConfidenceBadge
              level={data.onset.confidenceLevel}
              score={data.onset.confidence}
            />
          </div>
          <p className="text-sm font-semibold text-[#172033]">
            {data.onset.value}
          </p>
        </NeumorphicCard>

        {/* Associated Symptoms */}
        <NeumorphicCard variant="raised-sm" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#5B6575] uppercase tracking-wider">
              5. Associated Symptoms Reported
            </span>
            <ConfidenceBadge
              level={data.associatedSymptoms.confidenceLevel}
              score={data.associatedSymptoms.confidence}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.associatedSymptoms.value.map((sym, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-[#DEE5EC] shadow-neu-pressed text-xs font-semibold text-[#172033] border border-white/50"
              >
                {sym}
              </span>
            ))}
          </div>
        </NeumorphicCard>
      </div>

      {/* Safety Notice */}
      <div className="p-3 rounded-xl bg-[#DEE5EC]/70 text-xs text-[#5B6575] border border-white/40 flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
        <span>
          Uncertain fields are flagged. Your confirmation updates the source attribution from AI-draft to Patient-Confirmed before handoff to the triage nurse.
        </span>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <HumanEscalationButton label="Talk to a Nurse" variant="default" size="md" />

        <div className="flex items-center gap-3">
          <NeumorphicButton
            variant="default"
            size="lg"
            onClick={onCorrect}
            leftIcon={<Edit2 className="w-4 h-4 text-[#5B6575]" />}
          >
            Correct Something
          </NeumorphicButton>

          <NeumorphicButton
            variant="primary"
            size="lg"
            onClick={onConfirm}
            leftIcon={<CheckCircle2 className="w-5 h-5 text-white" />}
          >
            Confirm & Send to Nurse
          </NeumorphicButton>
        </div>
      </div>
    </div>
  );
};
