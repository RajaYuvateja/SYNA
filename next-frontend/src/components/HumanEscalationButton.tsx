"use client";

import React, { useState } from "react";
import { PhoneCall, AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { NeumorphicButton } from "./NeumorphicButton";
import { NeumorphicCard } from "./NeumorphicCard";

interface HumanEscalationButtonProps {
  label?: string;
  variant?: "danger" | "default" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
  patientId?: string;
}

export const HumanEscalationButton: React.FC<HumanEscalationButtonProps> = ({
  label = "Emergency Human Help / Call Nurse",
  variant = "danger",
  size = "md",
  className = "",
  patientId,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [escalationStatus, setEscalationStatus] = useState<"idle" | "calling" | "dispatched">("idle");

  const handleEscalate = () => {
    setEscalationStatus("calling");
    setTimeout(() => {
      setEscalationStatus("dispatched");
    }, 1200);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setEscalationStatus("idle"), 300);
  };

  return (
    <>
      <NeumorphicButton
        variant={variant === "danger" ? "danger" : "default"}
        size={size}
        onClick={() => setIsModalOpen(true)}
        ariaLabel={label}
        leftIcon={<PhoneCall className="w-4 h-4 animate-bounce" aria-hidden="true" />}
        className={className}
      >
        {label}
      </NeumorphicButton>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="escalation-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <NeumorphicCard className="w-full max-w-md p-6 bg-[#E8EDF2] shadow-2xl relative">
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 rounded-xl text-[#5B6575] hover:bg-[#DEE5EC] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#C24141]/15 text-[#C24141] flex items-center justify-center border border-[#C24141]/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 id="escalation-title" className="text-lg font-bold text-[#172033]">
                  Emergency Human Help
                </h3>
                <p className="text-xs text-[#5B6575]">
                  Instant Triage Nurse Staff Summon
                </p>
              </div>
            </div>

            {escalationStatus === "idle" && (
              <div className="space-y-4">
                <p className="text-sm text-[#172033] leading-relaxed">
                  If you are experiencing severe difficulty, unmanageable pain, or cannot use the voice system, press below to immediately alert the intake nursing station.
                </p>
                <div className="p-3 rounded-xl bg-[#DEE5EC] shadow-neu-pressed text-xs text-[#5B6575] border border-white/50">
                  <span className="font-semibold text-[#172033]">Desk Reference: </span>
                  {patientId ? `Patient Ref #${patientId}` : "Intake Station 01 (ED Kiosk)"}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <NeumorphicButton variant="ghost" size="md" onClick={closeModal}>
                    Cancel
                  </NeumorphicButton>
                  <NeumorphicButton
                    variant="danger"
                    size="md"
                    onClick={handleEscalate}
                    leftIcon={<PhoneCall className="w-4 h-4" />}
                  >
                    Alert Nurse Now
                  </NeumorphicButton>
                </div>
              </div>
            )}

            {escalationStatus === "calling" && (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-10 h-10 border-4 border-[#C24141] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-[#172033]">
                  Connecting to Triage Nurse Command Desk...
                </p>
              </div>
            )}

            {escalationStatus === "dispatched" && (
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-full bg-[#16805B]/15 text-[#16805B] flex items-center justify-center mx-auto border border-[#16805B]/30">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#16805B]">
                    Nurse Dispatched to Intake Station
                  </h4>
                  <p className="text-xs text-[#5B6575] mt-1">
                    Nurse Station ED-A has been alerted. A qualified triage clinician is approaching your location.
                  </p>
                </div>
                <NeumorphicButton variant="primary" size="md" onClick={closeModal} className="w-full">
                  Understood — Return
                </NeumorphicButton>
              </div>
            )}
          </NeumorphicCard>
        </div>
      )}
    </>
  );
};
