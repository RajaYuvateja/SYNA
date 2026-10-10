"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ambulance,
  Mic,
  Activity,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { NeumorphicCard } from "@/components/NeumorphicCard";
import { NeumorphicButton } from "@/components/NeumorphicButton";

export default function ParamedicIntakePage() {
  // EMS Telemetry State
  const [unitId] = useState("EMS-04");
  const [patientName, setPatientName] = useState("Sunil Sharma (Demo)");
  const [patientAge, setPatientAge] = useState("42");
  const [patientGender, setPatientGender] = useState("M");
  const [chiefComplaint, setChiefComplaint] = useState(
    "Motorcycle collision with open right tibia fracture & blunt head trauma"
  );
  const [etaMinutes, setEtaMinutes] = useState(8);
  const [fastCode, setFastCode] = useState<"CODE RED" | "CODE YELLOW" | "CODE GREEN">("CODE RED");

  // Vitals
  const [spo2, setSpo2] = useState("91");
  const [hr, setHr] = useState("128");
  const [bp, setBp] = useState("90/60");
  const [respiratoryRate, setRespiratoryRate] = useState("26");
  const [gcs, setGcs] = useState("13");
  const [bloodGlucose, setBloodGlucose] = useState("118");

  // Checklist
  const [selectedFlags, setSelectedFlags] = useState<string[]>([
    "Major Trauma",
    "Active Hemorrhage",
    "Hypotensive / Tachycardic",
  ]);

  const [voiceNotes, setVoiceNotes] = useState(
    "Tourniquet applied right lower limb, 1L Normal Saline running, 4L O2 via nasal cannula."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransmitted, setIsTransmitted] = useState(false);

  const toggleFlag = (flag: string) => {
    if (selectedFlags.includes(flag)) {
      setSelectedFlags(selectedFlags.filter((f) => f !== flag));
    } else {
      setSelectedFlags([...selectedFlags, flag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsTransmitted(true);
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#C24141]/15 text-[#C24141] flex items-center justify-center border border-[#C24141]/30 shadow-neu-raised">
            <Ambulance className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C24141]">
              Pre-Arrival Telemetry Link
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
              Paramedic Rapid Intake
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed font-mono text-xs font-bold text-[#172033] border border-white/50">
            Unit: {unitId}
          </span>
        </div>
      </div>

      {isTransmitted ? (
        <NeumorphicCard variant="raised" className="p-8 sm:p-12 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-[#16805B]/15 text-[#16805B] flex items-center justify-center mx-auto border-2 border-[#16805B]/30 shadow-neu-raised">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#172033]">
              Pre-Arrival Alert Successfully Dispatched
            </h2>
            <p className="text-sm text-[#5B6575] max-w-md mx-auto">
              Emergency Resuscitation Bay has received priority alert for {unitId}. Trauma team alerted for {etaMinutes} min ETA.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 max-w-md mx-auto text-left text-xs space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span className="text-[#5B6575]">Priority Code:</span>
              <span className="font-bold text-[#C24141]">{fastCode}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#5B6575]">Patient:</span>
              <span className="text-[#172033]">{patientName} ({patientAge}y {patientGender})</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#5B6575]">SpO2 / HR / BP:</span>
              <span className="text-[#172033]">{spo2}% • {hr} bpm • {bp}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href="/nurse">
              <NeumorphicButton variant="primary" size="lg">
                View in Nurse Command Queue
              </NeumorphicButton>
            </Link>
            <NeumorphicButton
              variant="default"
              size="lg"
              onClick={() => setIsTransmitted(false)}
            >
              Submit Another Case
            </NeumorphicButton>
          </div>
        </NeumorphicCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fast-Code Priority & ETA Banner */}
          <NeumorphicCard variant="raised" highlight="danger" className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#C24141]" />
                1. Select Fast-Code Priority
              </span>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-bold text-[#5B6575]">ETA:</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Number(e.target.value))}
                  className="w-16 px-2.5 py-1 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
                <span className="text-xs font-semibold text-[#5B6575]">Mins</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFastCode("CODE RED")}
                className={`p-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  fastCode === "CODE RED"
                    ? "bg-[#C24141] text-white shadow-[6px_6px_14px_rgba(194,65,65,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] border-2 border-white/50"
                    : "bg-[#E8EDF2] shadow-neu-raised text-[#C24141] hover:bg-[#EEF2F6]"
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>CODE RED (Resuscitation)</span>
              </button>

              <button
                type="button"
                onClick={() => setFastCode("CODE YELLOW")}
                className={`p-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  fastCode === "CODE YELLOW"
                    ? "bg-[#B7791F] text-white shadow-[6px_6px_14px_rgba(183,121,31,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] border-2 border-white/50"
                    : "bg-[#E8EDF2] shadow-neu-raised text-[#B7791F] hover:bg-[#EEF2F6]"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>CODE YELLOW (Urgent)</span>
              </button>

              <button
                type="button"
                onClick={() => setFastCode("CODE GREEN")}
                className={`p-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  fastCode === "CODE GREEN"
                    ? "bg-[#16805B] text-white shadow-[6px_6px_14px_rgba(22,128,91,0.35),-6px_-6px_14px_rgba(255,255,255,0.8)] border-2 border-white/50"
                    : "bg-[#E8EDF2] shadow-neu-raised text-[#16805B] hover:bg-[#EEF2F6]"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>CODE GREEN (Stable)</span>
              </button>
            </div>
          </NeumorphicCard>

          {/* Patient Identification & Chief Complaint */}
          <NeumorphicCard variant="raised" className="p-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              2. Patient Demographics &amp; Chief Complaint
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5B6575] mb-1">
                  Patient Name:
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-semibold text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5B6575] mb-1">
                  Age:
                </label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-semibold text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5B6575] mb-1">
                  Gender:
                </label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-semibold text-[#172033]"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="Other">Other</option>
                  <option value="Unknown">Unknown / Unidentified</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5B6575] mb-1">
                Main Incident / Chief Complaint:
              </label>
              <textarea
                rows={2}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm text-[#172033]"
              />
            </div>
          </NeumorphicCard>

          {/* Vitals Placeholders */}
          <NeumorphicCard variant="raised" className="p-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              3. Telemetry Vitals
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  Heart Rate
                </label>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  Blood Pressure
                </label>
                <input
                  type="text"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  Resp Rate
                </label>
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  GCS (3-15)
                </label>
                <input
                  type="number"
                  value={gcs}
                  onChange={(e) => setGcs(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5B6575] mb-1">
                  Glucose (mg/dL)
                </label>
                <input
                  type="number"
                  value={bloodGlucose}
                  onChange={(e) => setBloodGlucose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-sm font-bold text-center text-[#172033]"
                />
              </div>
            </div>
          </NeumorphicCard>

          {/* Quick Symptoms Checklist */}
          <NeumorphicCard variant="raised" className="p-6 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              4. High-Risk Symptoms Checklist
            </span>

            <div className="flex flex-wrap gap-2">
              {[
                "Chest Pain",
                "Severe Dyspnea",
                "Unconscious / Unresponsive",
                "Major Trauma",
                "Active Hemorrhage",
                "Stroke FAST Symptoms",
                "Seizures Active",
                "Hypotensive / Tachycardic",
              ].map((flag) => {
                const isSelected = selectedFlags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => toggleFlag(flag)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-[#C24141] text-white shadow-sm border border-white/40"
                        : "bg-[#DEE5EC] shadow-neu-pressed text-[#5B6575] hover:text-[#172033]"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {flag}
                  </button>
                );
              })}
            </div>
          </NeumorphicCard>

          {/* Voice Notes Capture */}
          <NeumorphicCard variant="raised" className="p-6 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#172033] flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-[#2563EB]" />
              5. Paramedic Voice Dictation &amp; Interventions
            </span>

            <textarea
              rows={2}
              value={voiceNotes}
              onChange={(e) => setVoiceNotes(e.target.value)}
              placeholder="Dictate in-transit interventions (e.g., Tourniquet, IV access, medications given)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#DEE5EC] shadow-neu-pressed border border-white/50 text-xs sm:text-sm text-[#172033]"
            />
          </NeumorphicCard>

          {/* Transmit Action */}
          <div className="flex justify-end pt-2">
            <NeumorphicButton
              variant="danger"
              size="xl"
              type="submit"
              disabled={isSubmitting}
              leftIcon={<Send className="w-5 h-5" />}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Transmitting to ED Command..." : "Transmit to Nurse Command Center"}
            </NeumorphicButton>
          </div>
        </form>
      )}
    </div>
  );
}
