"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Zap,
  HelpCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Wind,
  Heart,
  Gauge,
  Check,
  ArrowUp,
  ArrowDown,
  Edit3,
  MessageSquare,
  Save,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Archive,
} from "lucide-react";
import { TriageSession, ReviewAction } from "@/types/triage";
import { saveNurseNotes } from "@/lib/api";

interface PatientCardProps {
  session: TriageSession;
  onReview?: (session: TriageSession, action: ReviewAction) => void;
  onViewSbar: (session: TriageSession) => void;
  isArchived?: boolean;
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export const PatientCard: React.FC<PatientCardProps> = ({
  session,
  onReview,
  onViewSbar,
  isArchived: isArchivedProp,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [nurseNotes, setNurseNotes] = useState(session.nurse_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const isArchived = Boolean(
    session.lifecycle_status === "archived" ||
    session.status === "verified" ||
    isArchivedProp
  );

  const tier = (session.final_tier || session.risk?.tier || "stable").toLowerCase();
  const chief = session.entities?.chief_complaint || "Unspecified chief complaint";
  const conf = session.risk?.confidence ? Math.round(session.risk.confidence * 100) : null;
  const isVerified = session.status === "verified";
  const tel = session.telemetry || {};
  const summary = session.summary;

  const borderColors: Record<string, string> = {
    critical: "border-red-500/40 hover:border-red-500 shadow-red-950/20",
    urgent: "border-orange-500/40 hover:border-orange-500 shadow-orange-950/20",
    concerning: "border-yellow-500/40 hover:border-yellow-500 shadow-yellow-950/20",
    stable: "border-emerald-500/40 hover:border-emerald-500 shadow-emerald-950/20",
  };

  const badgeColors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    urgent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    concerning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    stable: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  const handleSaveNotes = async () => {
    if (!nurseNotes.trim() || isArchived) return;
    setSavingNotes(true);
    try {
      await saveNurseNotes(session.id, {
        nurse_id: "RN-Lead",
        notes: nurseNotes.trim(),
        mark_reviewed: true,
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err: any) {
      alert("Failed to save nurse notes: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-slate-900/75 p-5 shadow-xl backdrop-blur transition ${
        isArchived ? "border-indigo-500/30 shadow-indigo-950/20" : (borderColors[tier] || "border-white/10")
      }`}
    >
      {/* Historical Record Audit Banner */}
      {isArchived && (
        <div className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3.5 text-xs text-indigo-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-bold text-indigo-300">
                Clinical History Record — Nurse Verified &amp; Archived
              </span>
              <div className="text-[11px] text-indigo-300/80 mt-0.5">
                Verified by RN: {session.verified_by || (session.audit.length ? session.audit[session.audit.length - 1].nurse_id : "RN-Lead")}
                {(session.verified_at || session.archived_at || session.reviewed_at) && ` on ${formatTime(session.verified_at || session.archived_at || session.reviewed_at)}`}
              </div>
            </div>
          </div>
          <span className="rounded-md border border-indigo-500/40 bg-indigo-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1">
            <Lock className="h-3 w-3 text-indigo-300" />
            <span>Read-Only Audit Record</span>
          </span>
        </div>
      )}

      {/* Emergency Guidance Banner on Card if present */}
      {session.emergency_guidance && (
        <div className="mb-4 rounded-xl border border-red-500/50 bg-red-950/60 p-3 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
            <span className="font-bold text-red-300">
              {session.emergency_guidance.alert}
            </span>
          </div>
          <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
            CALL 112
          </span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-black uppercase tracking-wider ${
                badgeColors[tier] || "bg-white/10 text-white"
              }`}
            >
              {tier}
            </span>
            <h3 className="text-base font-bold text-white capitalize">{chief}</h3>
            {isArchived ? (
              <span className="rounded-full bg-indigo-950 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300 border border-indigo-800 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <span>Archived Case ({session.final_tier || tier})</span>
              </span>
            ) : isVerified ? (
              <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800">
                ✓ Verified ({session.final_tier || tier})
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-slate-300 font-semibold">
              👤 {session.patient_name ? session.patient_name : session.source}
            </span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-slate-300 font-mono">
              🌐 {session.language.toUpperCase()}
            </span>
            {conf && (
              <span className="rounded-md bg-white/5 px-2 py-0.5 text-cyan-400">
                AI Confidence: {conf}%
              </span>
            )}
            {session.source === "paramedic" && (
              <span className="rounded-md bg-red-600 px-2 py-0.5 font-bold text-white">
                🚑 EMS {session.paramedic_unit || ""}
              </span>
            )}
            {session.fast_code && (
              <span className="rounded-md bg-red-500/20 px-2 py-0.5 font-bold text-red-300 border border-red-500/40">
                🚨 {session.fast_code}
              </span>
            )}
            {session.escalation_status === "escalated" && (
              <span className="rounded-md bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow animate-pulse">
                🚨 Escalated RN Alert
              </span>
            )}
            {session.questionnaire && session.questionnaire.filter((q) => !q.is_answered).length > 0 && (
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30">
                ⚠️ {session.questionnaire.filter((q) => !q.is_answered).length} Unanswered Inquiries
              </span>
            )}
            {session.eta_minutes && (
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-amber-300 border border-amber-500/30">
                ⏱ ETA {session.eta_minutes} min
              </span>
            )}
            {tel.spo2 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-slate-300">
                <Wind className="h-3 w-3 text-cyan-400" />
                <span>SpO2 {tel.spo2}%</span>
              </span>
            )}
            {tel.hr && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-slate-300">
                <Heart className="h-3 w-3 text-rose-400" />
                <span>HR {tel.hr} bpm</span>
              </span>
            )}
            {tel.bp && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-slate-300">
                <Gauge className="h-3 w-3 text-amber-400" />
                <span>BP {tel.bp}</span>
              </span>
            )}
            <span className="text-[11px] text-slate-500 font-mono">
              ID: {session.id.slice(0, 8)}...
            </span>
            <span className="text-[11px] text-slate-400">
              🕒 {formatTime(session.submitted_at || session.confirmed_at || session.started_at || session.created_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewSbar(session)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <FileText className="h-3.5 w-3.5 text-cyan-400" />
            <span>SBAR Note</span>
          </button>
        </div>
      </div>

      <div className="py-4 space-y-3">
        {/* Red Flags Alert */}
        {session.red_flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.red_flags.map((flag, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-300"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span>{flag}</span>
              </span>
            ))}
          </div>
        )}

        {/* Contradictions */}
        {session.contradictions.length > 0 && (
          <div className="space-y-1.5">
            {session.contradictions.map((c, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200"
              >
                <div className="flex items-center gap-1 font-bold text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Contradiction Detected:</span>
                </div>
                <div className="mt-1 pl-4">
                  “{c.statement_a}” vs “{c.statement_b}”
                  <br />
                  <span className="text-slate-300">Clarification: {c.clarification}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Assessment reasoning */}
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 text-xs text-slate-300 leading-relaxed">
          <b className="text-white">Triage Assessment:</b>{" "}
          {session.risk?.reasoning || "Pending assessment"}
        </div>

        {/* Missing Inquiries */}
        {session.gaps.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              <b className="text-slate-300">Missing Protocol Inquiries:</b>{" "}
              {session.gaps.map((g) => g.missing).join(", ")}
            </span>
          </div>
        )}

        {/* Collapsible Structured Clinical Intake Summary (Feature 6 & 7) */}
        <div>
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
          >
            {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>Structured Clinical Intake Summary</span>
          </button>

          {summaryOpen && (
            <div className="mt-3 rounded-xl border border-teal-500/30 bg-slate-950/70 p-4 space-y-3 text-xs text-slate-300 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">Chief Complaint</span>
                  <span className="text-white font-bold capitalize">{summary?.chief_complaint || chief}</span>
                </div>
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">Onset</span>
                  <span className="text-white font-medium">{summary?.symptom_onset || session.entities?.onset_text || "Not provided"}</span>
                </div>
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">Severity</span>
                  <span className="text-amber-400 font-bold">{summary?.severity || (session.entities?.severity ? `${session.entities.severity}/10` : "Not provided")}</span>
                </div>
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">Location / Pattern</span>
                  <span className="text-white font-medium">{summary?.pain_location || session.entities?.location || "Not provided"}</span>
                </div>
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">Original Patient Statement</span>
                  <span className="text-slate-200 italic font-medium">{summary?.original_patient_statement || session.transcripts[0]?.native || "Not provided"}</span>
                </div>
                <div className="rounded-lg bg-slate-900 p-2.5 border border-white/5">
                  <span className="text-[10px] text-slate-400 block font-semibold">English Translation</span>
                  <span className="text-slate-200 italic font-medium">{summary?.english_translation || session.transcripts[0]?.english || "Not provided"}</span>
                </div>
              </div>

              {summary?.missing_information && summary.missing_information.length > 0 && (
                <div className="pt-1 text-[11px] text-slate-400">
                  <b className="text-slate-300">Missing Information:</b> {summary.missing_information.join(", ")}
                </div>
              )}

              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[10px] text-slate-500">
                <span>Started: {formatTime(summary?.intake_started || session.started_at)}</span>
                <span>Submitted: {formatTime(summary?.intake_submitted || session.submitted_at)}</span>
                <span>Reviewed: {formatTime(summary?.nurse_reviewed_at || session.reviewed_at)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Follow-Up Symptom Questionnaire & Patient Answers (Requirement 8) */}
        {session.questionnaire && session.questionnaire.length > 0 && (
          <div>
            <button
              onClick={() => setQuestionnaireOpen(!questionnaireOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              {questionnaireOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>
                Follow-Up Symptom Questionnaire ({session.questionnaire.filter((q) => q.is_answered).length}/{session.questionnaire.length} answered)
              </span>
            </button>

            {questionnaireOpen && (
              <div className="mt-3 rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 space-y-3 text-xs text-slate-300 animate-fade-in">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                  <span>Questions &amp; Verified Patient Responses</span>
                  <span>{session.questionnaire.length} questions batch</span>
                </div>

                <div className="space-y-2.5">
                  {session.questionnaire.map((q, idx) => {
                    const ans = session.patient_answers?.[q.id] || q.answer;
                    return (
                      <div
                        key={q.id || idx}
                        className={`rounded-lg p-3 border space-y-1.5 ${
                          ans === "yes" && q.red_flag_if === "yes"
                            ? "border-red-500/50 bg-red-950/30"
                            : ans
                            ? "border-white/10 bg-slate-900/80"
                            : "border-amber-500/30 bg-amber-950/20"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="font-semibold text-white">
                            {idx + 1}. {q.text_en}
                          </div>
                          <div>
                            {ans === "yes" && (
                              <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                                YES ✓
                              </span>
                            )}
                            {ans === "no" && (
                              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                                NO (Explicit Negative)
                              </span>
                            )}
                            {ans === "not_sure" && (
                              <span className="rounded-md bg-amber-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                                NOT SURE
                              </span>
                            )}
                            {!ans && (
                              <span className="rounded-md bg-rose-950 px-2 py-0.5 text-[11px] font-bold text-rose-300 border border-rose-800">
                                UNANSWERED
                              </span>
                            )}
                          </div>
                        </div>

                        {q.text_native && q.text_native !== q.text_en && (
                          <div className="text-[11px] text-slate-400 italic">
                            Patient Language: {q.text_native}
                          </div>
                        )}

                        {ans === "yes" && q.red_flag_reason && (
                          <div className="text-[11px] text-red-300 font-medium">
                            ⚠️ Red Flag Alert: {q.red_flag_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Timeline & Complete Conversation History (Feature 7) */}
        <div>
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>
              Chronological Dialogue &amp; Transcripts ({session.messages?.length || session.transcripts.length} entries)
            </span>
          </button>

          {detailsOpen && (
            <div className="mt-3 space-y-3 rounded-xl border border-white/5 bg-slate-950/60 p-4">
              {session.timeline.length > 0 && (
                <div className="space-y-1 border-b border-white/10 pb-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Clinical Timeline
                  </div>
                  {session.timeline.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="font-mono text-slate-400">{t.at.replace("T", " ")}</span>
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Message dialogue stream */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Multilingual Patient-AI Dialogue Stream</span>
                </div>

                {session.messages && session.messages.length > 0 ? (
                  session.messages.map((m, i) => (
                    <div
                      key={m.id || i}
                      className={`rounded-xl border p-3 text-xs space-y-1 ${
                        m.sender === "patient"
                          ? "border-blue-500/30 bg-blue-950/20 text-white"
                          : "border-slate-700 bg-slate-800/40 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                        <span>{m.sender === "patient" ? "👤 Patient" : "🤖 Clinical Assistant"}</span>
                        <span>{formatTime(m.submitted_at || m.created_at)}</span>
                      </div>
                      <div className="text-white font-medium">{m.original_text}</div>
                      {m.english_text && m.english_text !== m.original_text && (
                        <div className="text-slate-300 italic pt-1 border-t border-white/5">
                          EN: {m.english_text}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  session.transcripts.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/5 bg-slate-800/60 p-2.5 text-xs"
                    >
                      <div className="text-white font-medium">{t.native}</div>
                      <div className="text-slate-300 italic">{t.english}</div>
                      <div className="mt-1 text-[10px] text-cyan-400">
                        ASR Confidence: {Math.round(t.asr_confidence * 100)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* NURSE CLINICAL NOTES & SIGN-OFF (Feature 7 & 8) */}
        <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Attending Nurse Notes &amp; Verification</span>
            </label>
            {(session.verified_at || session.archived_at || session.reviewed_at) && (
              <span className="text-[10px] text-emerald-400 font-medium">
                {isArchived ? "Verified & Archived at: " : "Reviewed at: "}
                {formatTime(session.verified_at || session.archived_at || session.reviewed_at)}
              </span>
            )}
          </div>
          {isArchived ? (
            <div className="rounded-lg border border-white/5 bg-slate-900/90 p-2.5 text-xs text-slate-300">
              {nurseNotes ? (
                <span>{nurseNotes}</span>
              ) : (
                <span className="italic text-slate-500">Case signed off and archived without additional bedside notes.</span>
              )}
            </div>
          ) : (
            <>
              <textarea
                rows={2}
                value={nurseNotes}
                onChange={(e) => setNurseNotes(e.target.value)}
                placeholder="Add nurse assessment notes, bedside verification observations, or clarify patient response..."
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <div className="flex items-center justify-between">
                {notesSaved && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Notes Saved &amp; Intake Verified!</span>
                  </span>
                )}
                {!notesSaved && <span />}
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes || !nurseNotes.trim()}
                  className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40 transition"
                >
                  <Save className="h-3 w-3" />
                  <span>{savingNotes ? "Saving..." : "Save Nurse Notes"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span className="text-xs text-slate-400">
          {session.audit.length > 0
            ? `Audited & Verified by ${session.verified_by || session.audit[session.audit.length - 1].nurse_id}`
            : isArchived
            ? "Archived in Clinical History"
            : "Awaiting attending nurse evaluation"}
        </span>

        {isArchived ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/60 px-3.5 py-1.5 text-xs font-bold text-indigo-300">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Archived &amp; Signed-Off</span>
            </span>
            <button
              onClick={() => onViewSbar(session)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 transition"
            >
              <FileText className="h-3.5 w-3.5 text-cyan-400" />
              <span>View Full SBAR Summary</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onReview && onReview(session, "accept")}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept {tier.toUpperCase()}</span>
            </button>

            <button
              onClick={() => onReview && onReview(session, "escalate")}
              className="flex items-center gap-1 rounded-xl bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-red-500 transition"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>Escalate</span>
            </button>

            <button
              onClick={() => onReview && onReview(session, "downgrade")}
              className="flex items-center gap-1 rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-slate-600 transition"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>Downgrade</span>
            </button>

            <button
              onClick={() => onReview && onReview(session, "override")}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Override</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
