"use client";

import React from "react";
import { TriageSession } from "@/types/triage";

interface QueueStatsProps {
  sessions: TriageSession[];
}

export const QueueStats: React.FC<QueueStatsProps> = ({ sessions }) => {
  const counts = {
    total: sessions.length,
    critical: 0,
    urgent: 0,
    concerning: 0,
    stable: 0,
  };

  sessions.forEach((s) => {
    const tier = s.risk?.tier?.toLowerCase() as keyof typeof counts;
    if (counts[tier] !== undefined) {
      counts[tier]++;
    }
  });

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Active Queue
        </div>
        <div className="mt-1 text-2xl font-black text-white">{counts.total}</div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wider text-red-400">
          Critical (Immediate)
        </div>
        <div className="mt-1 text-2xl font-black text-red-500">{counts.critical}</div>
      </div>

      <div className="rounded-xl border border-orange-500/20 bg-orange-950/20 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
          Urgent (&lt;15m)
        </div>
        <div className="mt-1 text-2xl font-black text-orange-400">{counts.urgent}</div>
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-950/20 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
          Concerning (&lt;60m)
        </div>
        <div className="mt-1 text-2xl font-black text-yellow-400">{counts.concerning}</div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Stable
        </div>
        <div className="mt-1 text-2xl font-black text-emerald-400">{counts.stable}</div>
      </div>
    </section>
  );
};
