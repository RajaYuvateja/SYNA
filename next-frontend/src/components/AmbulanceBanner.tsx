"use client";

import React from "react";
import { Siren, Clock, Heart, Wind, Gauge, X, Check } from "lucide-react";
import { AmbulanceAlertPayload } from "@/types/triage";

interface AmbulanceBannerProps {
  alert: AmbulanceAlertPayload & { session_id?: string };
  onDismiss: () => void;
  onAcknowledge: (unit: string) => void;
}

export const AmbulanceBanner: React.FC<AmbulanceBannerProps> = ({
  alert,
  onDismiss,
  onAcknowledge,
}) => {
  const tel = alert.telemetry || {};
  const spo2 = tel.spo2 != null ? Number(tel.spo2) : null;
  const hr = tel.hr != null ? Number(tel.hr) : null;
  const bp = tel.bp || "--";
  const unit = alert.paramedic_unit || "EMS-Unit";
  const code = alert.fast_code || "CODE RED";
  const eta = alert.eta_minutes != null ? alert.eta_minutes : 10;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-950/80 via-red-900/60 to-slate-900/90 p-5 shadow-2xl shadow-red-500/30 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/50">
            <Siren className="h-7 w-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-wide text-white uppercase">
                Incoming In-Transit Alert &bull; {unit}
              </span>
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white shadow">
                {code}
              </span>
            </div>
            <p className="text-xs text-red-200">
              Paramedic pre-arrival streaming to Emergency Resuscitation Team
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-red-950/80 px-3.5 py-1.5 border border-red-500/40">
          <Clock className="h-4 w-4 text-red-400" />
          <span className="text-sm font-black text-white">ETA {eta} MINS</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-red-500/30 bg-black/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
            <Wind className="h-3.5 w-3.5 text-cyan-400" />
            <span>SpO2 (Oxygen)</span>
          </div>
          <div
            className={`mt-1 text-xl font-black ${
              spo2 && spo2 < 90 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {spo2 != null ? `${spo2}%` : "--"}
          </div>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-black/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            <span>Heart Rate</span>
          </div>
          <div
            className={`mt-1 text-xl font-black ${
              hr && (hr > 120 || hr < 50) ? "text-red-400" : "text-sky-400"
            }`}
          >
            {hr != null ? `${hr} bpm` : "--"}
          </div>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-black/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
            <Gauge className="h-3.5 w-3.5 text-amber-400" />
            <span>Blood Pressure</span>
          </div>
          <div className="mt-1 text-xl font-black text-white">{bp}</div>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-black/40 p-3">
          <div className="text-xs font-medium text-red-300">EMS Unit ID</div>
          <div className="mt-1 text-base font-bold text-slate-100">{unit}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-red-500/30 pt-3">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
          <span>Dismiss Alert</span>
        </button>

        <button
          onClick={() => onAcknowledge(unit)}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/50 transition hover:bg-red-500"
        >
          <Check className="h-4 w-4" />
          <span>Acknowledge &amp; Prepare Resuscitation Bay 1</span>
        </button>
      </div>
    </div>
  );
};
