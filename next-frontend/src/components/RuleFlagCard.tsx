"use client";

import React from "react";
import { RuleFlag } from "@/types/syna";
import { AlertTriangle, ShieldAlert, HeartPulse, Activity, Zap, CheckCircle2 } from "lucide-react";

interface RuleFlagCardProps {
  flags: RuleFlag[];
  className?: string;
}

export const RuleFlagCard: React.FC<RuleFlagCardProps> = ({ flags, className = "" }) => {
  if (!flags || flags.length === 0) {
    return (
      <div className="p-3.5 rounded-xl bg-[#16805B]/10 border border-[#16805B]/20 text-xs font-medium text-[#16805B] flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>No clinical safety rule violations triggered. Standard triage review applies.</span>
      </div>
    );
  }

  const getCategoryIcon = (category: RuleFlag["category"]) => {
    switch (category) {
      case "cardiovascular":
        return <HeartPulse className="w-5 h-5 text-[#C24141]" />;
      case "respiratory":
        return <Activity className="w-5 h-5 text-[#B7791F]" />;
      case "trauma":
        return <Zap className="w-5 h-5 text-[#C24141]" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-[#C24141]" />;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {flags.map((flag) => {
        const isCritical = flag.severity === "critical";

        return (
          <div
            key={flag.id}
            role="alert"
            className={`p-4 rounded-2xl border transition-all ${
              isCritical
                ? "bg-[#C24141]/10 border-[#C24141]/35 shadow-sm"
                : "bg-[#B7791F]/10 border-[#B7791F]/35"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#E8EDF2] shadow-neu-raised">
                  {getCategoryIcon(flag.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#172033]">{flag.title}</span>
                    {flag.isHardSafetyNet && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-[#C24141] text-white">
                        Hard Safety Net
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6575]">
                    Category: {flag.category} • Severity: {flag.severity.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-[#5B6575]">
                {flag.timestamp}
              </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#172033] mb-2 leading-relaxed font-medium">
              {flag.description}
            </p>

            {/* Mandatory Protocol Guidance */}
            <div className="p-2.5 rounded-xl bg-[#E8EDF2] border border-white/60 text-xs text-[#172033] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#C24141] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#C24141]">Protocol Instruction: </span>
                {flag.protocolWarning}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
