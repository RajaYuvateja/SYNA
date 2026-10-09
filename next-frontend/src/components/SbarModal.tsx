"use client";

import React, { useState } from "react";
import { X, Copy, Check, FileText } from "lucide-react";
import { TriageSession } from "@/types/triage";

interface SbarModalProps {
  session: TriageSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SbarModal: React.FC<SbarModalProps> = ({ session, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !session) return null;

  const e = session.entities || { symptoms: [] };
  const r = session.risk;
  const currentTier = (session.final_tier || r?.tier || "STABLE").toUpperCase();
  const currentScore = r?.score || 0;
  const confidence = r?.confidence ? `${Math.round(r.confidence * 100)}%` : "N/A";
  const reasoning = r?.reasoning || "Pending nurse review";

  const sbarText = `
CLINICAL SBAR INTAKE HANDOFF RECORD
=========================================
PATIENT IDENTIFIER: ${session.id}
INTAKE SOURCE:      ${session.source} (${session.channel || "kiosk"})
LANGUAGE:           ${session.language.toUpperCase()}
PROVISIONAL TIER:   ${currentTier} (Score: ${currentScore})

[S - SITUATION]
Chief Complaint:    ${e.chief_complaint || "Unspecified chief complaint"}
Current Severity:   ${e.severity ? `${e.severity}/10` : "Not reported"}
Age:                ${e.age != null ? `${e.age} years` : "Unknown"}
Onset / Duration:   ${e.onset_text || "Not specified"}

[B - BACKGROUND]
Reported Symptoms:  ${(e.symptoms || []).join(", ") || "None"}
Progression:        ${e.progression || "Not specified"}
Red Flags Noted:    ${(session.red_flags || []).join("; ") || "None"}

[A - ASSESSMENT]
AI Triage Tier:     ${currentTier}
Confidence Score:   ${confidence}
Clinical Reasoning: ${reasoning}

[R - RECOMMENDATION]
Required Action:    Bedside nursing triage evaluation and vital signs verification.
Assigned Priority:  ${currentTier}

AUDIT TRAIL:
${(session.audit || []).map((a) => `[${a.at}] ${a.nurse_id} performed ${a.action.toUpperCase()}: ${a.reason}`).join("\n") || "No nurse audit actions recorded yet."}

DISCLAIMER: Clinical intake aid only. Never diagnoses or prescribes. Final decision made by attending nursing staff.
=========================================
`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(sbarText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Clinical SBAR Handoff Record</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <textarea
            readOnly
            rows={14}
            value={sbarText}
            className="w-full rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-slate-300 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:opacity-95"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? "Copied!" : "Copy SBAR to Clipboard"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
