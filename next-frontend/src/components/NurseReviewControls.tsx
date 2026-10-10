"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, ArrowUpRight, UserCheck } from "lucide-react";
import { NeumorphicButton } from "./NeumorphicButton";
import { NeumorphicCard } from "./NeumorphicCard";
import { ClinicalPriority } from "@/types/syna";

interface NurseReviewControlsProps {
  currentPriority: ClinicalPriority;
  nurseNotes: string;
  onAccept: (nurseNotes: string) => void;
  onOverridePriority: (newPriority: ClinicalPriority, rationale: string, nurseNotes: string) => void;
  onRejectDraft: (reason: string) => void;
  isVerified?: boolean;
}

export const NurseReviewControls: React.FC<NurseReviewControlsProps> = ({
  currentPriority,
  nurseNotes: initialNurseNotes,
  onAccept,
  onOverridePriority,
  onRejectDraft,
  isVerified = false,
}) => {
  const [notes, setNotes] = useState(initialNurseNotes || "");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedOverridePriority, setSelectedOverridePriority] = useState<ClinicalPriority>("critical");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleConfirmOverride = () => {
    if (!overrideRationale.trim()) return;
    onOverridePriority(selectedOverridePriority, overrideRationale, notes);
    setShowOverrideModal(false);
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    onRejectDraft(rejectReason);
    setShowRejectModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Nurse Clinical Observation Notes */}
      <div>
        <label htmlFor="nurse-notes-input" className="block text-xs font-bold uppercase tracking-wider text-[#172033] mb-1.5 flex items-center justify-between">
          <span>Attending Nurse Clinical Notes</span>
          <span className="text-[10px] text-[#5B6575] font-normal">Mandatory for Handoff Verification</span>
        </label>
        <textarea
          id="nurse-notes-input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter triage nurse observations, bedside vitals check, or clinical remarks..."
          className="w-full px-4 py-3 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-[#172033] placeholder-[#8C9BAE] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {isVerified ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#16805B]/10 border border-[#16805B]/30 text-xs font-bold text-[#16805B]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Case Verified & Confirmed by Attending Clinician</span>
          </div>
        ) : (
          <>
            <NeumorphicButton
              variant="success"
              size="md"
              onClick={() => onAccept(notes)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              ariaLabel="Verify and accept structured handoff"
            >
              Verify & Accept Handoff
            </NeumorphicButton>

            <NeumorphicButton
              variant="default"
              size="md"
              onClick={() => setShowOverrideModal(true)}
              leftIcon={<ArrowUpRight className="w-4 h-4 text-[#2563EB]" />}
              ariaLabel="Override triage priority"
            >
              Override Priority
            </NeumorphicButton>

            <NeumorphicButton
              variant="ghost"
              size="md"
              onClick={() => setShowRejectModal(true)}
              leftIcon={<XCircle className="w-4 h-4 text-[#C24141]" />}
              ariaLabel="Reject AI draft"
              className="text-[#C24141]"
            >
              Reject Draft
            </NeumorphicButton>
          </>
        )}
      </div>

      {/* Override Priority Modal */}
      {showOverrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <NeumorphicCard className="w-full max-w-md p-6 bg-[#E8EDF2] shadow-2xl space-y-4">
            <h3 id="override-title" className="text-base font-bold text-[#172033] flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#2563EB]" />
              <span>Clinician Priority Override</span>
            </h3>

            <p className="text-xs text-[#5B6575]">
              Current provisional priority: <span className="font-bold uppercase text-[#172033]">{currentPriority}</span>. Select updated priority based on clinical evaluation:
            </p>

            <div>
              <label htmlFor="select-new-priority" className="block text-xs font-semibold text-[#5B6575] mb-1">
                New Priority:
              </label>
              <select
                id="select-new-priority"
                value={selectedOverridePriority}
                onChange={(e) => setSelectedOverridePriority(e.target.value as ClinicalPriority)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-semibold text-[#172033]"
              >
                <option value="critical">Critical (Immediate Resus)</option>
                <option value="urgent">Urgent (Within 15 mins)</option>
                <option value="concerning">Concerning (Within 30 mins)</option>
                <option value="stable">Stable (Routine Queue)</option>
              </select>
            </div>

            <div>
              <label htmlFor="override-rationale" className="block text-xs font-semibold text-[#5B6575] mb-1">
                Clinical Override Rationale (Required for Audit Trail):
              </label>
              <textarea
                id="override-rationale"
                rows={2}
                value={overrideRationale}
                onChange={(e) => setOverrideRationale(e.target.value)}
                placeholder="E.g., Patient displays severe diaphoresis not captured in initial voice snippet..."
                className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs text-[#172033]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <NeumorphicButton variant="ghost" size="sm" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </NeumorphicButton>
              <NeumorphicButton
                variant="primary"
                size="sm"
                disabled={!overrideRationale.trim()}
                onClick={handleConfirmOverride}
              >
                Record Override
              </NeumorphicButton>
            </div>
          </NeumorphicCard>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <NeumorphicCard className="w-full max-w-md p-6 bg-[#E8EDF2] shadow-2xl space-y-4">
            <h3 id="reject-title" className="text-base font-bold text-[#C24141] flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#C24141]" />
              <span>Reject AI-Generated Draft</span>
            </h3>

            <p className="text-xs text-[#5B6575]">
              Rejecting this draft flags the case as unviable for automated extraction. A complete manual bedside intake will be initiated.
            </p>

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-[#5B6575] mb-1">
                Reason for Rejection:
              </label>
              <textarea
                id="reject-reason"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g., High background hospital noise corrupted audio; unable to parse patient complaint..."
                className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs text-[#172033]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <NeumorphicButton variant="ghost" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </NeumorphicButton>
              <NeumorphicButton
                variant="danger"
                size="sm"
                disabled={!rejectReason.trim()}
                onClick={handleConfirmReject}
              >
                Confirm Rejection
              </NeumorphicButton>
            </div>
          </NeumorphicCard>
        </div>
      )}
    </div>
  );
};
