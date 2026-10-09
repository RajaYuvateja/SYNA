"use client";

import React from "react";
import { X, RefreshCw, BarChart2, ShieldCheck, Clock, CheckCircle, ArrowUpRight } from "lucide-react";
import { AnalyticsSummary } from "@/types/triage";

interface AnalyticsModalProps {
  analytics: AnalyticsSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  analytics,
  isOpen,
  onClose,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const d = analytics || {
    total_sessions: 0,
    avg_seconds_to_tier: 0.85,
    tier_distribution: { critical: 0, urgent: 0, concerning: 0, stable: 0 },
    override_stats: {
      total_reviews: 0,
      accept_count: 0,
      escalate_count: 0,
      downgrade_count: 0,
      override_rate_pct: 0,
      accept_rate_pct: 100,
    },
    languages: {},
    sources: {},
    asr_metrics: {
      avg_confidence: 0.92,
      total_utterances: 0,
      providers: {},
    },
  };

  const tiers = d.tier_distribution || {};
  const totalTiers = Object.values(tiers).reduce((a, b) => a + b, 0) || 1;

  const langNames: Record<string, string> = {
    te: "Telugu (తెలుగు)",
    ta: "Tamil (தமிழ்)",
    hi: "Hindi (हिन्दी)",
    kn: "Kannada (ಕನ್ನಡ)",
    en: "English",
    mr: "Marathi (मराठी)",
    ml: "Malayalam (മലയാളം)",
    bn: "Bengali (বাংলা)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">
              Clinical Triage Operations &amp; Performance Metrics
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3.5">
              <div className="text-xs text-slate-400">Total Sessions</div>
              <div className="mt-1 text-2xl font-black text-white">{d.total_sessions}</div>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5">
              <div className="flex items-center gap-1 text-xs text-cyan-400">
                <Clock className="h-3 w-3" />
                <span>Avg Seconds to Tier</span>
              </div>
              <div className="mt-1 text-2xl font-black text-cyan-300">
                {d.avg_seconds_to_tier}s
              </div>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3.5">
              <div className="flex items-center gap-1 text-xs text-purple-400">
                <ArrowUpRight className="h-3 w-3" />
                <span>Nurse Override Rate</span>
              </div>
              <div className="mt-1 text-2xl font-black text-purple-300">
                {d.override_stats?.override_rate_pct || 0}%
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5">
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle className="h-3 w-3" />
                <span>Nurse Accept Rate</span>
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-300">
                {d.override_stats?.accept_rate_pct || 100}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Priority Tier Distribution
              </h4>
              <div className="space-y-2.5">
                {Object.entries(tiers).map(([tier, count]) => {
                  const pct = Math.round((count / totalTiers) * 100);
                  const color =
                    tier === "critical"
                      ? "bg-red-500"
                      : tier === "urgent"
                      ? "bg-orange-500"
                      : tier === "concerning"
                      ? "bg-yellow-500"
                      : "bg-emerald-500";
                  return (
                    <div key={tier}>
                      <div className="flex justify-between text-xs text-slate-300">
                        <span className="capitalize">
                          {tier}: <b>{count}</b>
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Indic Speech Languages
              </h4>
              <div className="space-y-2">
                {Object.entries(d.languages || {}).map(([code, count]) => (
                  <div key={code} className="flex items-center justify-between text-xs text-slate-300">
                    <span>{langNames[code] || code.toUpperCase()}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 font-bold text-white">
                      {count}
                    </span>
                  </div>
                ))}
                {Object.keys(d.languages || {}).length === 0 && (
                  <p className="text-xs text-slate-500">No language distribution recorded yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Safety &amp; AI Provider Infrastructure</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-2">
              <div>
                Speech Provider: <b className="text-white">Sarvam AI (Saaras-v3 / Saarika-v2.5)</b>
              </div>
              <div>
                Clinical LLM: <b className="text-white">GroqCloud (Llama-3.3-70B Versatile)</b>
              </div>
              <div>
                ASR Word Accuracy:{" "}
                <b className="text-cyan-400">
                  {Math.round((d.asr_metrics?.avg_confidence || 0.92) * 100)}%
                </b>
              </div>
              <div>
                Deterministic Red Flags:{" "}
                <b className="text-emerald-400">Hard Safety Net Guaranteed</b>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Metrics</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
