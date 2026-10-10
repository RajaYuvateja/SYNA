"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Flame,
  AlertTriangle,
  Clock,
  Ambulance,
  Shield,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";
import { CaseCard } from "@/components/CaseCard";
import { OfflineStatus } from "@/components/OfflineStatus";
import { MOCK_CLINICAL_CASES } from "@/lib/mockData";
import { SynaPatientCase } from "@/types/syna";

export default function NurseDashboardPage() {
  const [cases] = useState<SynaPatientCase[]>(MOCK_CLINICAL_CASES);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "critical" | "urgent" | "awaiting" | "completed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [nurseId] = useState("RN-PRIYA-702");

  // Filtering logic
  const filteredCases = cases.filter((c) => {
    // Priority / Status filter
    if (activeFilter === "critical" && c.provisionalPriority !== "critical") return false;
    if (activeFilter === "urgent" && c.provisionalPriority !== "urgent") return false;
    if (activeFilter === "awaiting" && c.reviewStatus !== "awaiting_review") return false;
    if (activeFilter === "completed" && c.reviewStatus !== "verified") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.patientName.toLowerCase().includes(q);
      const matchId = c.patientId.toLowerCase().includes(q);
      const matchComplaint = c.chiefComplaint.value.toLowerCase().includes(q);
      const matchLang = c.preferredLanguage.toLowerCase().includes(q);
      return matchName || matchId || matchComplaint || matchLang;
    }

    return true;
  });

  // Metric counts
  const criticalCount = cases.filter((c) => c.provisionalPriority === "critical").length;
  const urgentCount = cases.filter((c) => c.provisionalPriority === "urgent").length;
  const awaitingCount = cases.filter((c) => c.reviewStatus === "awaiting_review").length;
  const verifiedCount = cases.filter((c) => c.reviewStatus === "verified").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Nurse Identity */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#16805B]">
              Emergency Department Triage
            </span>
            <span className="text-xs text-[#5B6575]">• Station Desk A</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#172033]">
            Nurse Command Center
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6575] mt-0.5">
            Real-time structured patient intake handoffs, rule-based safety flags &amp; clinician review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <OfflineStatus />

          <div className="px-3.5 py-1.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs font-semibold text-[#172033] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16805B] animate-pulse" />
            <span>Nurse: {nurseId}</span>
          </div>

          <Link href="/paramedic">
            <NeumorphicButton
              variant="default"
              size="sm"
              leftIcon={<Ambulance className="w-3.5 h-3.5 text-[#C24141]" />}
            >
              EMS Incoming
            </NeumorphicButton>
          </Link>
        </div>
      </div>

      {/* Safety Notice Strip */}
      <div className="p-3.5 rounded-2xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/50 text-xs text-[#5B6575] flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-[#172033]">Clinical Responsibility: </strong>
          SYNA is an assistive prioritization tool. It does not diagnose or make final triage assignments. A qualified nurse must inspect each handoff, review evidence audio, and verify or override provisional findings.
        </div>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Active */}
        <NeumorphicCard variant="raised-sm" className="p-4 space-y-1">
          <div className="text-xs font-semibold text-[#5B6575]">Total in Queue</div>
          <div className="text-2xl font-black text-[#172033]">{cases.length}</div>
          <div className="text-[11px] text-[#2563EB] font-medium">Active telemetry sync</div>
        </NeumorphicCard>

        {/* Critical */}
        <NeumorphicCard variant="raised-sm" highlight="danger" className="p-4 space-y-1">
          <div className="text-xs font-semibold text-[#C24141] flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Critical Review
          </div>
          <div className="text-2xl font-black text-[#C24141]">{criticalCount}</div>
          <div className="text-[11px] text-[#5B6575]">Immediate resus bay</div>
        </NeumorphicCard>

        {/* Urgent */}
        <NeumorphicCard variant="raised-sm" highlight="warning" className="p-4 space-y-1">
          <div className="text-xs font-semibold text-[#B7791F] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Urgent Review
          </div>
          <div className="text-2xl font-black text-[#B7791F]">{urgentCount}</div>
          <div className="text-[11px] text-[#5B6575]">Within 15 minutes</div>
        </NeumorphicCard>

        {/* Awaiting Verification */}
        <NeumorphicCard variant="raised-sm" className="p-4 space-y-1">
          <div className="text-xs font-semibold text-[#5B6575] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#2563EB]" /> Awaiting Review
          </div>
          <div className="text-2xl font-black text-[#2563EB]">{awaitingCount}</div>
          <div className="text-[11px] text-[#16805B] font-medium">{verifiedCount} Verified</div>
        </NeumorphicCard>
      </div>

      {/* Queue Filter Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Priority Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs">
          {[
            { id: "all", label: `All (${cases.length})` },
            { id: "critical", label: `Critical (${criticalCount})` },
            { id: "urgent", label: `Urgent (${urgentCount})` },
            { id: "awaiting", label: `Awaiting Review (${awaitingCount})` },
            { id: "completed", label: `Verified (${verifiedCount})` },
          ].map((f) => {
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  isSelected
                    ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                    : "text-[#5B6575] hover:text-[#172033]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#5B6575] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, ID, symptoms..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs sm:text-sm text-[#172033] placeholder-[#8C9BAE] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
      </div>

      {/* Cases Queue Grid */}
      {filteredCases.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#DEE5EC]/50 border border-white/50 space-y-3">
          <p className="text-sm font-semibold text-[#5B6575]">
            No patient cases matching the selected filter or search criteria.
          </p>
          <NeumorphicButton
            variant="default"
            size="sm"
            onClick={() => {
              setActiveFilter("all");
              setSearchQuery("");
            }}
          >
            Clear Filters
          </NeumorphicButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCases.map((c) => (
            <CaseCard key={c.id} patientCase={c} />
          ))}
        </div>
      )}

      {/* Synthetic Data Disclaimer Footer */}
      <div className="text-center text-xs text-[#5B6575] pt-4">
        Synthetic demonstration data — not real patient data. Designed for Indian Healthcare Environments.
      </div>
    </div>
  );
}
