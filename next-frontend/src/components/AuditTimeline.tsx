"use client";

import React, { useState } from "react";
import { AuditEvent } from "@/types/syna";
import {
  Clock,
  Mic,
  Bot,
  UserCheck,
  ShieldAlert,
  ArrowRightCircle,
  FileCheck,
  Filter,
  CheckCircle2,
  Ambulance,
} from "lucide-react";
import { NeumorphicCard } from "./NeumorphicCard";

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
  showFilters?: boolean;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  events,
  className = "",
  showFilters = true,
}) => {
  const [actorFilter, setActorFilter] = useState<string>("all");

  const filteredEvents = events.filter((e) => {
    if (actorFilter === "all") return true;
    return e.actor === actorFilter;
  });

  const getActorBadge = (actor: AuditEvent["actor"]) => {
    switch (actor) {
      case "nurse":
        return {
          label: "Registered Nurse",
          icon: <UserCheck className="w-3.5 h-3.5 text-[#16805B]" />,
          style: "bg-[#16805B]/10 text-[#16805B] border-[#16805B]/30",
        };
      case "patient":
        return {
          label: "Patient Verified",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB]" />,
          style: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
        };
      case "sarvam_ai":
        return {
          label: "Sarvam Speech-Language AI",
          icon: <Bot className="w-3.5 h-3.5 text-[#B7791F]" />,
          style: "bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30",
        };
      case "rule_engine":
        return {
          label: "Safety Rule Engine",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-[#C24141]" />,
          style: "bg-[#C24141]/10 text-[#C24141] border-[#C24141]/30",
        };
      case "paramedic":
        return {
          label: "Paramedic EMS",
          icon: <Ambulance className="w-3.5 h-3.5 text-[#C24141]" />,
          style: "bg-[#C24141]/10 text-[#C24141] border-[#C24141]/30",
        };
      default:
        return {
          label: actor,
          icon: <Clock className="w-3.5 h-3.5" />,
          style: "bg-[#5B6575]/10 text-[#5B6575]",
        };
    }
  };

  const getEventTypeIcon = (type: AuditEvent["eventType"]) => {
    switch (type) {
      case "audio_captured":
      case "transcription_generated":
        return <Mic className="w-4 h-4 text-[#2563EB]" />;
      case "entity_extracted":
        return <Bot className="w-4 h-4 text-[#B7791F]" />;
      case "contradiction_flagged":
      case "rule_flag_triggered":
        return <ShieldAlert className="w-4 h-4 text-[#C24141]" />;
      case "nurse_overridden":
      case "nurse_escalated":
      case "nurse_downgraded":
        return <ArrowRightCircle className="w-4 h-4 text-[#2563EB]" />;
      case "nurse_accepted":
      case "case_archived":
        return <FileCheck className="w-4 h-4 text-[#16805B]" />;
      default:
        return <Clock className="w-4 h-4 text-[#5B6575]" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter controls */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs">
          <span className="font-bold text-[#5B6575] flex items-center gap-1.5 px-2">
            <Filter className="w-3.5 h-3.5" /> Filter Actor:
          </span>
          {["all", "patient", "sarvam_ai", "nurse", "paramedic", "rule_engine"].map((act) => (
            <button
              key={act}
              type="button"
              onClick={() => setActorFilter(act)}
              className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition-all ${
                actorFilter === act
                  ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                  : "text-[#5B6575] hover:text-[#172033]"
              }`}
            >
              {act.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* Events timeline */}
      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#8C9BAE]/30">
        {filteredEvents.map((evt) => {
          const actorBadge = getActorBadge(evt.actor);
          const typeIcon = getEventTypeIcon(evt.eventType);

          return (
            <div key={evt.id} className="relative flex items-start gap-3">
              {/* Timeline marker */}
              <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-[#E8EDF2] shadow-neu-raised border border-white/80 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
              </div>

              {/* Event card */}
              <NeumorphicCard variant="raised-sm" className="p-4 w-full space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#DEE5EC] shadow-neu-pressed">
                      {typeIcon}
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                        {evt.eventType.replace(/_/g, " ")}
                      </span>
                      {evt.caseId && (
                        <span className="text-[10px] font-mono text-[#5B6575] ml-2">
                          Case: {evt.caseId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${actorBadge.style}`}
                    >
                      {actorBadge.icon}
                      <span>{actorBadge.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#5B6575]">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#172033] font-medium leading-relaxed">
                  {evt.details}
                </p>

                {(evt.previousValue || evt.newValue) && (
                  <div className="p-2.5 rounded-xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/40 text-xs space-y-1">
                    {evt.previousValue && (
                      <div className="text-[#C24141] font-mono">
                        <span className="font-semibold text-[#5B6575]">Previous: </span>
                        {evt.previousValue}
                      </div>
                    )}
                    {evt.newValue && (
                      <div className="text-[#16805B] font-mono font-bold">
                        <span className="font-semibold text-[#5B6575]">Updated: </span>
                        {evt.newValue}
                      </div>
                    )}
                  </div>
                )}

                {evt.rationale && (
                  <div className="text-xs text-[#1E40AF] italic bg-[#2563EB]/5 p-2 rounded-lg border border-[#2563EB]/20">
                    <span className="font-semibold not-italic">Clinical Rationale: </span>
                    {evt.rationale}
                  </div>
                )}
              </NeumorphicCard>
            </div>
          );
        })}
      </div>
    </div>
  );
};
