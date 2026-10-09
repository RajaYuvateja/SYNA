"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Stethoscope } from "lucide-react";
import { Header } from "@/components/Header";
import { QueueStats } from "@/components/QueueStats";
import { PatientCard } from "@/components/PatientCard";
import { AmbulanceBanner } from "@/components/AmbulanceBanner";
import { ReviewModal } from "@/components/ReviewModal";
import { SbarModal } from "@/components/SbarModal";
import { AnalyticsModal } from "@/components/AnalyticsModal";
import {
  fetchQueue,
  fetchQueueCounts,
  reviewSession,
  fetchAnalytics,
  seedDemoCases,
  resetSessions,
  getWebSocketUrl,
} from "@/lib/api";
import {
  TriageSession,
  PriorityTier,
  ReviewAction,
  AmbulanceAlertPayload,
  AnalyticsSummary,
  QueueFilter,
  QueueCounts,
} from "@/types/triage";

export default function CommandCenterPage() {
  const [sessions, setSessions] = useState<TriageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "severity">("newest");
  const [counts, setCounts] = useState<QueueCounts>({
    all: 0,
    pending: 0,
    critical: 0,
    review_required: 0,
    completed: 0,
  });
  const [search, setSearch] = useState("");
  const [nurseId, setNurseId] = useState("RN-Lead");
  const [wsConnected, setWsConnected] = useState(false);

  // Modals state
  const [activeReviewSession, setActiveReviewSession] = useState<TriageSession | null>(null);
  const [activeReviewAction, setActiveReviewAction] = useState<ReviewAction | null>(null);
  const [activeSbarSession, setActiveSbarSession] = useState<TriageSession | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);

  // Pre-arrival ambulance alert state
  const [ambulanceAlert, setAmbulanceAlert] = useState<
    (AmbulanceAlertPayload & { session_id?: string }) | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      const [data, queueCounts] = await Promise.all([
        fetchQueue(filter, sortBy),
        fetchQueueCounts().catch(() => null),
      ]);
      setSessions(data);
      if (queueCounts) {
        setCounts(queueCounts);
      }
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy]);

  const loadAnalytics = async () => {
    try {
      const d = await fetchAnalytics();
      setAnalyticsData(d);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket Live Sync
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(getWebSocketUrl());
        ws.onopen = () => {
          setWsConnected(true);
        };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "ambulance_alert") {
              setAmbulanceAlert({
                session_id: msg.session_id,
                chief_complaint: msg.session?.entities?.chief_complaint || "Acute emergency",
                eta_minutes: msg.eta_minutes,
                telemetry: msg.telemetry || {},
                paramedic_unit: msg.paramedic_unit || "EMS-Unit",
                fast_code: msg.fast_code || "CODE RED",
              });
            }
            loadData();
          } catch (e) {
            loadData();
          }
        };
        ws.onclose = () => {
          setWsConnected(false);
          timer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        setWsConnected(false);
        timer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      ws?.close();
      clearTimeout(timer);
    };
  }, [loadData]);

  const handleReviewSubmit = async (params: {
    sessionId: string;
    action: ReviewAction;
    newTier?: PriorityTier | null;
    reason: string;
  }) => {
    await reviewSession(params.sessionId, {
      nurse_id: nurseId,
      action: params.action,
      new_tier: params.newTier,
      reason: params.reason,
    });
    loadData();
  };

  const handleSeed = async () => {
    try {
      const res = await seedDemoCases();
      alert(`Seeded ${res.seeded} multilingual cases into live queue!`);
      loadData();
    } catch (e: any) {
      alert("Failed to seed cases: " + e.message);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to clear all active triage sessions?")) return;
    try {
      await resetSessions();
      loadData();
    } catch (e: any) {
      alert("Failed to reset: " + e.message);
    }
  };

  const handleChangeNurse = () => {
    const val = prompt("Enter Clinical Nurse ID:", nurseId);
    if (val && val.trim()) setNurseId(val.trim());
  };

  const filteredSessions = sessions.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const chief = (s.entities?.chief_complaint || "").toLowerCase();
      const id = s.id.toLowerCase();
      const lang = s.language.toLowerCase();
      const src = s.source.toLowerCase();
      const patName = (s.patient_name || "").toLowerCase();
      return (
        chief.includes(q) ||
        id.includes(q) ||
        lang.includes(q) ||
        src.includes(q) ||
        patName.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        wsConnected={wsConnected}
        nurseId={nurseId}
        onChangeNurse={handleChangeNurse}
        onLoadDemo={handleSeed}
        onReset={handleReset}
        onOpenAnalytics={() => {
          loadAnalytics();
          setAnalyticsOpen(true);
        }}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {ambulanceAlert && (
          <AmbulanceBanner
            alert={ambulanceAlert}
            onDismiss={() => setAmbulanceAlert(null)}
            onAcknowledge={(unit) => {
              alert(`Resuscitation Bay 1 Prepared for incoming ${unit}. Trauma team alerted.`);
              setAmbulanceAlert(null);
            }}
          />
        )}

        <QueueStats sessions={sessions} />

        {/* Controls, Filter Tabs & Search Bar (Requirement 8 & 9) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 p-1.5">
            {[
              { id: "all", label: `ALL (${counts.all})` },
              { id: "pending", label: `PENDING (${counts.pending})` },
              { id: "critical", label: `CRITICAL (${counts.critical})` },
              { id: "review_required", label: `REVIEW REQUIRED (${counts.review_required})` },
              { id: "completed", label: `COMPLETED (${counts.completed})` },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`filter-tab-${tab.id}`}
                onClick={() => setFilter(tab.id as QueueFilter)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === tab.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sorting Control (Requirement 7 & 10) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                id="queue-sort-selector"
                className="rounded-xl border border-white/10 bg-slate-900/80 py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First (Chronological)</option>
                <option value="oldest">Oldest First</option>
                <option value="severity">Severity Priority</option>
              </select>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search complaint, language, ID..."
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Queue List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading triage queue...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 py-20 text-center">
            <Stethoscope className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-300">No patients matching current criteria.</h3>
            <p className="text-xs text-slate-500 mt-1">Load the 4 seed multilingual cases to test triage flow.</p>
            <button
              onClick={handleSeed}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-500"
            >
              Seed 4 Demo Cases
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredSessions.map((s) => (
              <PatientCard
                key={s.id}
                session={s}
                onReview={(session, action) => {
                  setActiveReviewSession(session);
                  setActiveReviewAction(action);
                }}
                onViewSbar={(session) => setActiveSbarSession(session)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Review Modal */}
      <ReviewModal
        isOpen={Boolean(activeReviewSession && activeReviewAction)}
        session={activeReviewSession}
        action={activeReviewAction}
        onClose={() => {
          setActiveReviewSession(null);
          setActiveReviewAction(null);
        }}
        onSubmit={handleReviewSubmit}
      />

      {/* SBAR Modal */}
      <SbarModal
        isOpen={Boolean(activeSbarSession)}
        session={activeSbarSession}
        onClose={() => setActiveSbarSession(null)}
      />

      {/* Analytics Modal */}
      <AnalyticsModal
        isOpen={analyticsOpen}
        analytics={analyticsData}
        onClose={() => setAnalyticsOpen(false)}
        onRefresh={loadAnalytics}
      />
    </div>
  );
}
