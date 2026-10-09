"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldAlert, Check } from "lucide-react";
import { PriorityTier, ReviewAction, TriageSession } from "@/types/triage";

interface ReviewModalProps {
  session: TriageSession | null;
  action: ReviewAction | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    sessionId: string;
    action: ReviewAction;
    newTier?: PriorityTier | null;
    reason: string;
  }) => Promise<void>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  session,
  action,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [newTier, setNewTier] = useState<PriorityTier>("urgent");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setNewTier(session.risk?.tier || "urgent");
      setReason("");
    }
  }, [session, action]);

  if (!isOpen || !session || !action) return null;

  const currentTier = session.risk?.tier || "stable";

  const presets = [
    "Cardiovascular red flag confirmed; initiating bedside ECG",
    "Vital signs stable on arrival; no acute distress",
    "Discrepancy in symptom onset clarified with family",
    "Pediatric danger signs absent; alert and feeding",
    "Physician emergency bedside evaluation requested",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Clinical rationale is mandatory for medical audit compliance.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        sessionId: session.id,
        action,
        newTier: action === "override" ? newTier : null,
        reason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white uppercase">
              Clinical Review: {action}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300">
            Current Assessment: <span className="font-bold text-white uppercase">{currentTier}</span>.
            All nurse overrides and confirmations are permanently recorded to PostgreSQL / SQLite audit trails.
          </div>

          {action === "override" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Target Priority Tier:
              </label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as PriorityTier)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="critical">🔴 Critical - Immediate resuscitation</option>
                <option value="urgent">🟠 Urgent - Very urgent, evaluate in &lt;15m</option>
                <option value="concerning">🟡 Concerning - Urgent, evaluate in &lt;60m</option>
                <option value="stable">🟢 Stable - Routine outpatient queue</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Clinical Rationale &amp; Signs Observed (Mandatory):
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter clinical rationale, physical exam findings, or clarification details..."
              className="w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setReason(p)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {p.slice(0, 32)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:opacity-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{submitting ? "Signing..." : "Confirm & Sign Audit Log"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
