"use client";

import React from "react";
import Link from "next/link";
import { SynaPatientCase } from "@/types/syna";
import { NeumorphicCard } from "./NeumorphicCard";
import { StatusBadge } from "./StatusBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import {
  Clock,
  Volume2,
  AlertTriangle,
  ArrowRight,
  User,
  Ambulance,
} from "lucide-react";

interface CaseCardProps {
  patientCase: SynaPatientCase;
  onSelect?: (id: string) => void;
}

export const CaseCard: React.FC<CaseCardProps> = ({ patientCase, onSelect }) => {
  const getLanguageLabel = (code: string) => {
    switch (code) {
      case "te":
        return "Telugu (తెలుగు)";
      case "ta":
        return "Tamil (தமிழ்)";
      case "hi":
        return "Hindi (हिन्दी)";
      case "kn":
        return "Kannada (ಕನ್ನಡ)";
      case "en":
        return "English";
      default:
        return code.toUpperCase();
    }
  };

  const formattedTime = new Date(patientCase.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasContradictions = patientCase.contradictions && patientCase.contradictions.length > 0;
  const hasRuleFlags = patientCase.ruleFlags && patientCase.ruleFlags.length > 0;
  const hasAudioEvidence = patientCase.evidenceSnippets && patientCase.evidenceSnippets.length > 0;
  const missingCount = patientCase.missingFields ? patientCase.missingFields.length : 0;

  return (
    <NeumorphicCard
      variant="raised"
      highlight={
        patientCase.provisionalPriority === "critical"
          ? "danger"
          : patientCase.provisionalPriority === "urgent"
          ? "warning"
          : "none"
      }
      className="p-5 hover:translate-y-[-2px] transition-transform duration-200"
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#DEE5EC] shadow-neu-pressed flex items-center justify-center font-bold text-xs text-[#2563EB]">
            {patientCase.source === "paramedic" ? (
              <Ambulance className="w-4 h-4 text-[#C24141]" />
            ) : (
              <User className="w-4 h-4 text-[#2563EB]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#172033]">{patientCase.patientName}</span>
              <span className="text-xs font-mono text-[#5B6575]">({patientCase.patientId})</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#5B6575]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formattedTime}
              </span>
              <span>•</span>
              <span className="font-medium text-[#1E40AF]">
                {getLanguageLabel(patientCase.preferredLanguage)}
              </span>
            </div>
          </div>
        </div>

        {/* Priority & Review Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge type="priority" value={patientCase.provisionalPriority} size="sm" />
          <StatusBadge type="status" value={patientCase.reviewStatus} size="sm" />
        </div>
      </div>

      {/* Main Clinical Complaint */}
      <div className="py-3 space-y-1.5">
        <div className="text-[11px] font-bold text-[#5B6575] uppercase tracking-wider flex items-center gap-1.5">
          <span>Main Reported Concern</span>
          <ConfidenceBadge
            level={patientCase.chiefComplaint.confidenceLevel}
            score={patientCase.chiefComplaint.confidence}
            source={patientCase.chiefComplaint.source}
          />
        </div>
        <p className="text-sm font-semibold text-[#172033] leading-snug">
          {patientCase.chiefComplaint.value}
        </p>

        {patientCase.chiefComplaint.originalText && (
          <p className="text-xs italic text-[#5B6575] bg-[#DEE5EC]/60 px-2.5 py-1 rounded-lg border border-white/40">
            &ldquo;{patientCase.chiefComplaint.originalText}&rdquo;
          </p>
        )}
      </div>

      {/* Warning flags and indicators */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-3">
        {hasRuleFlags && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#C24141]/10 text-[#C24141] border border-[#C24141]/30">
            <AlertTriangle className="w-3 h-3" />
            <span>{patientCase.ruleFlags.length} Rule Flag{patientCase.ruleFlags.length > 1 ? "s" : ""}</span>
          </span>
        )}

        {hasContradictions && (
          <StatusBadge type="contradiction" value="" size="sm" />
        )}

        {missingCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/30">
            <span>{missingCount} Missing Field{missingCount > 1 ? "s" : ""}</span>
          </span>
        )}

        {hasAudioEvidence && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/30">
            <Volume2 className="w-3 h-3" />
            <span>Speech Audio Available</span>
          </span>
        )}
      </div>

      {/* Footer & Review Link */}
      <div className="pt-2 border-t border-black/5 flex items-center justify-between">
        <div className="text-[11px] text-[#5B6575]">
          Channel: <span className="font-semibold capitalize text-[#172033]">{patientCase.channel}</span>
        </div>

        <Link
          href={`/nurse/case/${patientCase.id}`}
          onClick={() => onSelect && onSelect(patientCase.id)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E8EDF2] shadow-neu-raised hover:bg-[#EEF2F6] active:shadow-neu-pressed border border-white/70 text-xs font-bold text-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <span>Open Full Handoff</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </NeumorphicCard>
  );
};
