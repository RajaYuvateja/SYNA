"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Volume2,
  CheckCircle2,
  Ambulance,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SymptomTimeline } from "@/components/SymptomTimeline";
import { EvidencePanel } from "@/components/EvidencePanel";
import { RuleFlagCard } from "@/components/RuleFlagCard";
import { NurseReviewControls } from "@/components/NurseReviewControls";
import { AuditTimeline } from "@/components/AuditTimeline";
import { MOCK_CLINICAL_CASES } from "@/lib/mockData";
import { SynaPatientCase, ClinicalPriority } from "@/types/syna";

export default function NurseCaseDetailPage() {
  const params = useParams();
  const caseId = (params?.id as string) || "case-syna-101";

  // Find matching case or default to first mock case
  const initialCase =
    MOCK_CLINICAL_CASES.find((c) => c.id === caseId) || MOCK_CLINICAL_CASES[0];

  const [patientCase, setPatientCase] = useState<SynaPatientCase>(initialCase);
  const [activeTab, setActiveTab] = useState<"handoff" | "evidence" | "audit">("handoff");
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Accept handoff action
  const handleAcceptHandoff = (nurseNotes: string) => {
    const updated: SynaPatientCase = {
      ...patientCase,
      reviewStatus: "verified",
      nurseNotes,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "RN-PRIYA-702",
      chiefComplaint: {
        ...patientCase.chiefComplaint,
        source: "nurse_confirmed",
      },
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          caseId: patientCase.id,
          timestamp: new Date().toISOString(),
          actor: "nurse",
          actorId: "RN-PRIYA-702",
          eventType: "nurse_accepted",
          details: "Triage handoff report verified and accepted by attending emergency nurse.",
          rationale: nurseNotes || "Clinical presentation congruent with reported findings.",
        },
        ...patientCase.auditTrail,
      ],
    };

    setPatientCase(updated);
    setSuccessNotice("Handoff verified and confirmed. Audit trail updated.");
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Override priority action
  const handleOverridePriority = (
    newPriority: ClinicalPriority,
    rationale: string,
    nurseNotes: string
  ) => {
    const prevPriority = patientCase.provisionalPriority;
    const updated: SynaPatientCase = {
      ...patientCase,
      provisionalPriority: newPriority,
      reviewStatus: "overridden",
      nurseNotes,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          caseId: patientCase.id,
          timestamp: new Date().toISOString(),
          actor: "nurse",
          actorId: "RN-PRIYA-702",
          eventType: "nurse_overridden",
          previousValue: prevPriority.toUpperCase(),
          newValue: newPriority.toUpperCase(),
          details: `Clinician override of provisional triage priority from ${prevPriority} to ${newPriority}.`,
          rationale,
        },
        ...patientCase.auditTrail,
      ],
    };

    setPatientCase(updated);
    setSuccessNotice(`Priority overridden to ${newPriority.toUpperCase()} and logged to audit trail.`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Reject draft action
  const handleRejectDraft = (reason: string) => {
    const updated: SynaPatientCase = {
      ...patientCase,
      reviewStatus: "overridden",
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          caseId: patientCase.id,
          timestamp: new Date().toISOString(),
          actor: "nurse",
          actorId: "RN-PRIYA-702",
          eventType: "nurse_overridden",
          details: "AI-generated draft rejected by triage nurse. Bedside intake required.",
          rationale: reason,
        },
        ...patientCase.auditTrail,
      ],
    };

    setPatientCase(updated);
    setSuccessNotice("AI draft rejected. Case flagged for manual bedside intake.");
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back link & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/nurse"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#2563EB] hover:text-[#1E40AF] px-3.5 py-2 rounded-xl bg-[#E8EDF2] shadow-neu-raised hover:bg-[#EEF2F6] active:shadow-neu-pressed border border-white/60 focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Triage Queue</span>
        </Link>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("handoff")}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === "handoff"
                ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                : "text-[#5B6575] hover:text-[#172033]"
            }`}
          >
            Structured Handoff
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("evidence")}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === "evidence"
                ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                : "text-[#5B6575] hover:text-[#172033]"
            }`}
          >
            Speech Evidence ({patientCase.evidenceSnippets?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === "audit"
                ? "bg-[#E8EDF2] shadow-neu-raised text-[#2563EB] border border-white/80"
                : "text-[#5B6575] hover:text-[#172033]"
            }`}
          >
            Audit Trail ({patientCase.auditTrail?.length || 0})
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successNotice && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-[#16805B]/15 border border-[#16805B]/40 text-xs sm:text-sm font-bold text-[#16805B] flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Patient Header Card */}
      <NeumorphicCard
        variant="raised"
        highlight={
          patientCase.provisionalPriority === "critical"
            ? "danger"
            : patientCase.provisionalPriority === "urgent"
            ? "warning"
            : "none"
        }
        className="p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed flex items-center justify-center font-bold text-lg text-[#2563EB]">
              {patientCase.gender === "M" ? "♂" : "♀"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-[#172033]">
                  {patientCase.patientName}
                </h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#DEE5EC] shadow-neu-pressed text-[#5B6575] border border-white/50">
                  {patientCase.patientId}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5B6575] mt-1 font-medium">
                <span>Age: <strong className="text-[#172033]">{patientCase.age || "Unknown"}y</strong></span>
                <span>•</span>
                <span>Gender: <strong className="text-[#172033]">{patientCase.gender}</strong></span>
                <span>•</span>
                <span>Language: <strong className="text-[#1E40AF]">{patientCase.preferredLanguage.toUpperCase()}</strong></span>
                <span>•</span>
                <span>Intake: <strong className="capitalize text-[#172033]">{patientCase.channel}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge type="priority" value={patientCase.provisionalPriority} size="md" />
            <StatusBadge type="status" value={patientCase.reviewStatus} size="md" />
          </div>
        </div>

        {/* Paramedic In-transit telemetry banner if present */}
        {patientCase.paramedicTelemetry && (
          <div className="p-4 rounded-2xl bg-[#C24141]/10 border border-[#C24141]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Ambulance className="w-5 h-5 text-[#C24141]" />
              <div>
                <span className="font-bold text-[#C24141]">
                  Incoming Ambulance: {patientCase.paramedicTelemetry.unitId}
                </span>
                <span className="text-[#5B6575] ml-2">
                  ETA: {patientCase.paramedicTelemetry.etaMinutes} mins ({patientCase.paramedicTelemetry.fastCode})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono font-bold text-[#172033]">
              <span>SpO2: {patientCase.paramedicTelemetry.vitals.spo2}%</span>
              <span>HR: {patientCase.paramedicTelemetry.vitals.hr}</span>
              <span>BP: {patientCase.paramedicTelemetry.vitals.bp}</span>
            </div>
          </div>
        )}
      </NeumorphicCard>

      {/* Main Tab Views */}
      {activeTab === "handoff" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Structured Clinical Handoff Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Main Concern */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5B6575]">
                  1. Main Reported Concern
                </span>
                <ConfidenceBadge
                  level={patientCase.chiefComplaint.confidenceLevel}
                  score={patientCase.chiefComplaint.confidence}
                  source={patientCase.chiefComplaint.source}
                />
              </div>
              <p className="text-base font-bold text-[#172033] leading-snug">
                {patientCase.chiefComplaint.value}
              </p>
              {patientCase.chiefComplaint.originalText && (
                <div className="p-3 rounded-xl bg-[#DEE5EC]/70 shadow-neu-pressed border border-white/50 text-xs text-[#5B6575]">
                  <span className="font-bold text-[#1E40AF]">Spoken Speech: </span>
                  &ldquo;{patientCase.chiefComplaint.originalText}&rdquo;
                </div>
              )}
            </NeumorphicCard>

            {/* 2. Onset, Duration, Severity, Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Severity */}
              <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#5B6575] uppercase tracking-wider">
                    Severity
                  </span>
                  <ConfidenceBadge
                    level={patientCase.severity.confidenceLevel}
                    score={patientCase.severity.confidence}
                    source={patientCase.severity.source}
                  />
                </div>
                <div className="text-2xl font-black text-[#C24141] flex items-baseline gap-1">
                  <span>{patientCase.severity.value}</span>
                  <span className="text-xs text-[#5B6575]">/ 10</span>
                </div>
                {patientCase.severity.originalText && (
                  <p className="text-[11px] italic text-[#5B6575]">
                    &ldquo;{patientCase.severity.originalText}&rdquo;
                  </p>
                )}
              </NeumorphicCard>

              {/* Location */}
              <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#5B6575] uppercase tracking-wider">
                    Location
                  </span>
                  <ConfidenceBadge
                    level={patientCase.location.confidenceLevel}
                    score={patientCase.location.confidence}
                    source={patientCase.location.source}
                  />
                </div>
                <p className="text-sm font-bold text-[#172033]">
                  {patientCase.location.value}
                </p>
              </NeumorphicCard>

              {/* Onset & Duration */}
              <NeumorphicCard variant="raised-sm" className="p-4 space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#5B6575] uppercase tracking-wider">
                    Onset &amp; Duration
                  </span>
                  <ConfidenceBadge
                    level={patientCase.onsetText.confidenceLevel}
                    score={patientCase.onsetText.confidence}
                    source={patientCase.onsetText.source}
                  />
                </div>
                <p className="text-sm font-semibold text-[#172033]">
                  {patientCase.onsetText.value}
                </p>
              </NeumorphicCard>
            </div>

            {/* 3. Associated Symptoms */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5B6575]">
                  Associated Symptoms
                </span>
                <ConfidenceBadge
                  level={patientCase.associatedSymptoms.confidenceLevel}
                  score={patientCase.associatedSymptoms.confidence}
                  source={patientCase.associatedSymptoms.source}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {patientCase.associatedSymptoms.value.map((sym, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs font-bold text-[#172033]"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            </NeumorphicCard>

            {/* 4. Relevant Medical History */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5B6575]">
                  Relevant Patient-Reported History
                </span>
                <ConfidenceBadge
                  level={patientCase.relevantHistory.confidenceLevel}
                  score={patientCase.relevantHistory.confidence}
                  source={patientCase.relevantHistory.source}
                />
              </div>
              <p className="text-sm font-medium text-[#172033]">
                {patientCase.relevantHistory.value}
              </p>
            </NeumorphicCard>

            {/* 5. Symptom Progression Timeline */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#2563EB]" />
                Symptom Timeline
              </span>
              <SymptomTimeline events={patientCase.timeline} />
            </NeumorphicCard>

            {/* 6. Contradictions Section */}
            {patientCase.contradictions && patientCase.contradictions.length > 0 && (
              <NeumorphicCard variant="raised-sm" highlight="danger" className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C24141]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Contradictory Responses Flagged</span>
                </div>
                {patientCase.contradictions.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs space-y-2">
                    <div className="font-bold text-[#172033]">Conflict in field: {c.field}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#5B6575]">
                      <div className="p-2 rounded bg-white/60">
                        <strong>Statement A:</strong> &ldquo;{c.statementA}&rdquo;
                      </div>
                      <div className="p-2 rounded bg-white/60">
                        <strong>Statement B:</strong> &ldquo;{c.statementB}&rdquo;
                      </div>
                    </div>
                    <div className="text-[#1E40AF] font-medium">
                      <strong>Nurse Action:</strong> {c.clarificationQuestion}
                    </div>
                  </div>
                ))}
              </NeumorphicCard>
            )}

            {/* 7. Missing Information Section */}
            {patientCase.missingFields && patientCase.missingFields.length > 0 && (
              <NeumorphicCard variant="raised-sm" className="p-5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B7791F]">
                  Missing / Unelicited Clinical Information
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {patientCase.missingFields.map((f, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-[#B7791F]/10 border border-[#B7791F]/30 text-xs font-semibold text-[#B7791F]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </NeumorphicCard>
            )}
          </div>

          {/* Right Col: Rule Flags & Clinician Verification Controls */}
          <div className="space-y-6">
            {/* Rule-based Safety Warning Flags */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#C24141]" />
                Rule-Based Safety Flags
              </span>
              <RuleFlagCard flags={patientCase.ruleFlags} />
            </NeumorphicCard>

            {/* Clinician Review & Override Station */}
            <NeumorphicCard variant="raised" highlight="blue" className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                <div>
                  <h3 className="text-sm font-bold text-[#172033]">
                    Nurse Review &amp; Verification
                  </h3>
                  <p className="text-[11px] text-[#5B6575]">
                    Required by hospital clinical governance
                  </p>
                </div>
              </div>

              <NurseReviewControls
                currentPriority={patientCase.provisionalPriority}
                nurseNotes={patientCase.nurseNotes}
                isVerified={patientCase.reviewStatus === "verified"}
                onAccept={handleAcceptHandoff}
                onOverridePriority={handleOverridePriority}
                onRejectDraft={handleRejectDraft}
              />
            </NeumorphicCard>

            {/* Quick Source Speech Preview Widget */}
            <NeumorphicCard variant="raised-sm" className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#2563EB]" />
                  Original Speech Audio
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("evidence")}
                  className="text-xs font-bold text-[#2563EB] hover:underline"
                >
                  View All ({patientCase.evidenceSnippets?.length || 0})
                </button>
              </div>

              {patientCase.evidenceSnippets && patientCase.evidenceSnippets[0] ? (
                <div className="p-3 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs space-y-2">
                  <div className="font-semibold text-[#172033]">
                    &ldquo;{patientCase.evidenceSnippets[0].nativeText}&rdquo;
                  </div>
                  <div className="text-[11px] text-[#5B6575]">
                    Mayura: {patientCase.evidenceSnippets[0].englishText}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#5B6575]">No audio attached</div>
              )}
            </NeumorphicCard>
          </div>
        </div>
      )}

      {/* Tab: Evidence Audio Panel */}
      {activeTab === "evidence" && (
        <NeumorphicCard variant="raised" className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#172033]">
              Evidence-Linked Source Speech Recordings
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6575] mt-0.5">
              Listen to the patient&apos;s verbatim audio recorded during intake turns, processed via Sarvam Saaras ASR and Mayura clinical translation.
            </p>
          </div>

          <EvidencePanel snippets={patientCase.evidenceSnippets} />
        </NeumorphicCard>
      )}

      {/* Tab: Audit Trail */}
      {activeTab === "audit" && (
        <NeumorphicCard variant="raised" className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#172033]">
              Clinical Lifecycle Audit Trail
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6575] mt-0.5">
              Full chronological record distinguishing AI extractions, patient confirmations, safety rule evaluations, and clinician overrides.
            </p>
          </div>

          <AuditTimeline events={patientCase.auditTrail} />
        </NeumorphicCard>
      )}
    </div>
  );
}
