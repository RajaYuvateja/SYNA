"use client";

import React from "react";
import { TimelineEvent } from "@/types/syna";
import { Clock } from "lucide-react";

interface SymptomTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const SymptomTimeline: React.FC<SymptomTimelineProps> = ({
  events,
  className = "",
}) => {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-[#5B6575] bg-[#DEE5EC]/50 rounded-xl">
        No chronological timeline events extracted.
      </div>
    );
  }

  return (
    <div className={`relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#8C9BAE]/30 ${className}`}>
      {events.map((evt, idx) => (
        <div key={evt.id || idx} className="relative flex items-start gap-3">
          {/* Timeline node */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#E8EDF2] border-2 border-[#2563EB] shadow-neu-raised flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
          </div>

          <div className="p-3 rounded-xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/50 w-full">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1E40AF] mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {evt.timeframe}
              </span>
              {evt.severityAtTime && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C24141]/10 text-[#C24141] border border-[#C24141]/20">
                  Pain: {evt.severityAtTime}/10
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#172033] font-medium leading-relaxed">
              {evt.event}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
