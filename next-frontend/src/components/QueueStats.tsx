"use client";

import React from "react";
import { TriageSession, QueueCounts } from "@/types/triage";
import { Archive, ShieldCheck } from "lucide-react";

interface QueueStatsProps {
  sessions: TriageSession[];
  counts?: QueueCounts;
}

export const QueueStats: React.FC<QueueStatsProps> = ({ sessions, counts }) => {
  // Derive counts strictly from active cases
  // Exclude any archived or nurse-verified cases from active metrics
  const activeSessions = sessions.filter(
    (s) => s.lifecycle_status !== "archived" && s.status !== "verified"
  );

  let activeTotal = activeSessions.length;
  let criticalCount = 0;
  let urgentCount = 0;
  let concerningCount = 0;
  let stableCount = 0;
  let archivedCount = sessions.filter(
    (s) => s.lifecycle_status === "archived" || s.status === "verified"
  ).length;

  if (counts) {
    activeTotal = counts.active ?? counts.all ?? 0;
    criticalCount = counts.critical ?? 0;
    urgentCount = counts.urgent ?? 0;
    concerningCount = counts.concerning ?? 0;
    stableCount = counts.stable ?? 0;
    archivedCount = counts.archived ?? counts.history ?? counts.completed ?? 0;
  } else {
    activeSessions.forEach((s) => {
      const isEmergency = s.risk?.is_emergency || s.escalation_status === "escalated";
      const tier = (s.final_tier || s.risk?.tier || "stable").toLowerCase();
      if (tier === "critical" || isEmergency) {
        criticalCount++;
      } else if (tier === "urgent") {
        urgentCount++;
      } else if (tier === "concerning") {
        concerningCount++;
      } else if (tier === "stable") {
        stableCount++;
      }
    });
  }

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur transition hover:border-white/20">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Active Queue
        </div>
        <div className="mt-1 text-2xl font-black text-white">{activeTotal}</div>
        <div className="mt-1 text-[11px] text-slate-500">Excludes archived</div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 backdrop-blur transition hover:border-red-500/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
          Critical (Immediate)
        </div>
        <div className="mt-1 text-2xl font-black text-red-500">{criticalCount}</div>
        <div className="mt-1 text-[11px] text-red-400/60">Active emergency</div>
      </div>

      <div className="rounded-xl border border-orange-500/20 bg-orange-950/20 p-4 backdrop-blur transition hover:border-orange-500/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
          Urgent (&lt;15m)
        </div>
        <div className="mt-1 text-2xl font-black text-orange-400">{urgentCount}</div>
        <div className="mt-1 text-[11px] text-orange-400/60">Active priority</div>
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-950/20 p-4 backdrop-blur transition hover:border-yellow-500/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
          Concerning (&lt;60m)
        </div>
        <div className="mt-1 text-2xl font-black text-yellow-400">{concerningCount}</div>
        <div className="mt-1 text-[11px] text-yellow-400/60">Active monitoring</div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 backdrop-blur transition hover:border-emerald-500/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Stable
        </div>
        <div className="mt-1 text-2xl font-black text-emerald-400">{stableCount}</div>
        <div className="mt-1 text-[11px] text-emerald-400/60">Active non-urgent</div>
      </div>

      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/25 p-4 backdrop-blur transition hover:border-indigo-500/50">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-400">
          <span>Verified History</span>
          <Archive className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div className="mt-1 text-2xl font-black text-indigo-300">{archivedCount}</div>
        <div className="mt-1 text-[11px] text-indigo-400/70 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          <span>Nurse-Archived</span>
        </div>
      </div>
    </section>
  );
};
