"use client";

import React from "react";
import Link from "next/link";
import { Activity, Radio, User, Zap, Trash2, Mic, BarChart3 } from "lucide-react";

interface HeaderProps {
  wsConnected: boolean;
  nurseId: string;
  onChangeNurse: () => void;
  onLoadDemo: () => void;
  onReset: () => void;
  onOpenAnalytics: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsConnected,
  nurseId,
  onChangeNurse,
  onLoadDemo,
  onReset,
  onOpenAnalytics,
}) => {
  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-900/85 px-6 py-3.5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Clinical Triage Command</h1>
          <p className="text-xs text-slate-400">Intake Priority Aid &amp; Live Nurse Handoff</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
            wsConnected
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"
          }`}
        >
          <Radio className="h-3 w-3" />
          <span>{wsConnected ? "Live Sync" : "Reconnecting"}</span>
        </div>

        <button
          onClick={onChangeNurse}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          title="Click to change Clinical Nurse ID"
        >
          <User className="h-3.5 w-3.5 text-cyan-400" />
          <span>{nurseId}</span>
        </button>

        <button
          onClick={onOpenAnalytics}
          className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/25"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Analytics</span>
        </button>

        <button
          onClick={onLoadDemo}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
        >
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span>Seed 4 Cases</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-red-500/20 hover:text-red-300"
          title="Reset triage queue"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <Link
          href="/patient"
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition hover:opacity-95"
        >
          <Mic className="h-3.5 w-3.5" />
          <span>Patient Intake</span>
        </Link>
      </div>
    </header>
  );
};
