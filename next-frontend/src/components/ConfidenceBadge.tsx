"use client";

import React from "react";
import { ConfidenceLevel, FieldSource } from "@/types/syna";
import { CheckCircle2, HelpCircle, UserCheck, Bot, Sparkles, AlertTriangle } from "lucide-react";

interface ConfidenceBadgeProps {
  level?: ConfidenceLevel;
  score?: number; // 0.0 - 1.0
  source?: FieldSource;
  showScore?: boolean;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  level,
  score,
  source,
  showScore = false,
  className = "",
}) => {
  // Compute level from score if not explicitly passed
  const resolvedLevel: ConfidenceLevel =
    level || (score !== undefined ? (score >= 0.85 ? "high" : score >= 0.65 ? "medium" : "low") : "medium");

  const getSourceIconAndText = () => {
    switch (source) {
      case "nurse_confirmed":
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-[#16805B]" aria-hidden="true" />,
          label: "Nurse Confirmed",
          colorClass: "bg-[#16805B]/10 text-[#16805B] border-[#16805B]/30",
        };
      case "nurse_corrected":
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />,
          label: "Nurse Corrected",
          colorClass: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
        };
      case "patient_confirmed":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#16805B]" aria-hidden="true" />,
          label: "Patient Confirmed",
          colorClass: "bg-[#16805B]/10 text-[#16805B] border-[#16805B]/30",
        };
      case "patient_reported":
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />,
          label: "Patient Reported",
          colorClass: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
        };
      case "ai_extracted":
      default:
        return {
          icon: <Bot className="w-3.5 h-3.5 text-[#B7791F]" aria-hidden="true" />,
          label: "AI-Generated Draft",
          colorClass: "bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30",
        };
    }
  };

  const getConfidenceInfo = () => {
    switch (resolvedLevel) {
      case "high":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#16805B]" aria-hidden="true" />,
          label: "High Confidence",
          colorClass: "bg-[#16805B]/10 text-[#16805B] border-[#16805B]/30",
        };
      case "low":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-[#C24141]" aria-hidden="true" />,
          label: "Low Confidence",
          colorClass: "bg-[#C24141]/10 text-[#C24141] border-[#C24141]/30",
        };
      case "medium":
      default:
        return {
          icon: <HelpCircle className="w-3.5 h-3.5 text-[#B7791F]" aria-hidden="true" />,
          label: "Medium Confidence",
          colorClass: "bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30",
        };
    }
  };

  if (source) {
    const sInfo = getSourceIconAndText();
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sInfo.colorClass} ${className}`}
        title={`Source: ${sInfo.label}`}
      >
        {sInfo.icon}
        <span>{sInfo.label}</span>
        {showScore && score !== undefined && (
          <span className="opacity-75 text-[10px]">({Math.round(score * 100)}%)</span>
        )}
      </span>
    );
  }

  const cInfo = getConfidenceInfo();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cInfo.colorClass} ${className}`}
      title={`Confidence: ${cInfo.label}`}
    >
      {cInfo.icon}
      <span>{cInfo.label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75 text-[10px]">({Math.round(score * 100)}%)</span>
      )}
    </span>
  );
};
