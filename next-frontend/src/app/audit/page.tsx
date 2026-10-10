"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Shield,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowLeft,
  UserCheck,
  Bot,
  Ambulance,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { AuditTimeline } from "@/components/AuditTimeline";
import { MOCK_CLINICAL_CASES } from "@/lib/mockData";
import { AuditEvent } from "@/types/syna";

export default function AuditPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("all");

  // Aggregate audit trails across cases
  const allEvents: AuditEvent[] = MOCK_CLINICAL_CASES.flatMap((c) => c.auditTrail).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const displayedEvents =
    selectedCaseId === "all"
      ? allEvents
      : allEvents.filter((e) => e.caseId === selectedCaseId);

  const handleExportCSV = () => {
    const headers = "ID,CaseID,Timestamp,Actor,EventType,Details,Rationale\n";
    const rows = displayedEvents
      .map(
        (e) =>
          `"${e.id}","${e.caseId}","${e.timestamp}","${e.actor}","${e.eventType}","${e.details.replace(/"/g, '""')}","${(e.rationale || "").replace(/"/g, '""')}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `syna-audit-trail-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              Governance &amp; Accountability
            </span>
            <span className="text-xs text-[#5B6575]">• Regulatory Audit Trail</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#172033]">
            Clinical Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6575] mt-0.5">
            Transparent chronological tracking distinguishing AI drafts, patient confirmations, and nurse overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NeumorphicButton
            variant="default"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5 text-[#2563EB]" />}
          >
            Export CSV Log
          </NeumorphicButton>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 rounded-2xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/50 text-xs text-[#5B6575] flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-[#172033]">Audit Integrity: </strong>
          Every clinical interaction, speech translation event, rule trigger, and clinician review decision is timestamped and immutable. This ensures legal defensibility and clinical transparency across emergency shifts.
        </div>
      </div>

      {/* Case Filter Selector & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-[#5B6575]">Filter by Patient Case:</span>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 font-semibold text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="all">All Cases ({allEvents.length} events)</option>
            {MOCK_CLINICAL_CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.patientName} ({c.patientId})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-semibold text-[#5B6575]">
          Displaying {displayedEvents.length} recorded events
        </div>
      </div>

      {/* Main Audit Timeline View */}
      <NeumorphicCard variant="raised" className="p-6 sm:p-8">
        <AuditTimeline events={displayedEvents} showFilters={true} />
      </NeumorphicCard>
    </div>
  );
}
