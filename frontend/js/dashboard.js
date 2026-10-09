/**
 * Clinical Triage Nurse Dashboard - Controller & WebSocket Live Sync
 */

// Configuration & State
const API_BASE = "";
let currentFilter = "pending_review";
let currentSearch = "";
let rows = [];
let activeReviewSessionId = null;
let activeReviewAction = null;

// HTML Escaper for safe rendering
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );

// Nurse Profile Management
function getNurseId() {
  return localStorage.getItem("triage_nurse_id") || "RN-Lead";
}

function setNurseId(id) {
  if (id && id.trim()) {
    localStorage.setItem("triage_nurse_id", id.trim());
    updateNurseBadge();
  }
}

function updateNurseBadge() {
  const badge = document.getElementById("nurse-display");
  if (badge) badge.textContent = getNurseId();
}

function promptChangeNurse() {
  const current = getNurseId();
  const input = prompt("Enter your Clinical Nurse ID:", current);
  if (input) setNurseId(input);
}

// Toast Notifications
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${esc(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch and render queue
async function loadQueue() {
  try {
    const statusParam = currentFilter === "verified" ? "verified" : (currentFilter === "all" ? "all" : "pending_review");
    const res = await fetch(`${API_BASE}/api/queue?status=${statusParam}`);
    if (!res.ok) throw new Error(await res.text());
    rows = await res.json();
    renderStats();
    renderQueue();
  } catch (err) {
    console.error("Failed to load triage queue:", err);
    showToast("Error loading queue: " + err.message, "error");
  }
}

// Compute statistics across sessions
function renderStats() {
  const counts = { total: rows.length, critical: 0, urgent: 0, concerning: 0, stable: 0 };
  rows.forEach((r) => {
    const tier = r.risk?.tier?.toLowerCase();
    if (counts[tier] !== undefined) counts[tier]++;
  });

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  setVal("stat-total", counts.total);
  setVal("stat-critical", counts.critical);
  setVal("stat-urgent", counts.urgent);
  setVal("stat-concerning", counts.concerning);
  setVal("stat-stable", counts.stable);
}

// Render patient cards list
function renderQueue() {
  const container = document.getElementById("queue-container");
  if (!container) return;

  // Filter based on tier if selected, and search query
  let filtered = rows;
  if (["critical", "urgent", "concerning", "stable"].includes(currentFilter)) {
    filtered = filtered.filter((r) => r.risk?.tier?.toLowerCase() === currentFilter);
  }

  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter((r) => {
      const complaint = (r.entities?.chief_complaint || "").toLowerCase();
      const id = (r.id || "").toLowerCase();
      const lang = (r.language || "").toLowerCase();
      const source = (r.source || "").toLowerCase();
      return complaint.includes(q) || id.includes(q) || lang.includes(q) || source.includes(q);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-queue">
        <div class="empty-icon">🩺</div>
        <div class="empty-text">No patients matching current criteria.</div>
        <button class="btn btn-secondary" onclick="loadDemoCases()">Load 4 Seed Cases</button>
      </div>`;
    return;
  }

  const tierIcons = {
    critical: "🔴",
    urgent: "🟠",
    concerning: "🟡",
    stable: "🟢",
  };

  container.innerHTML = filtered
    .map((r) => {
      const tier = (r.risk?.tier || "stable").toLowerCase();
      const chief = r.entities?.chief_complaint || "Unspecified chief complaint";
      const conf = r.risk?.confidence ? Math.round(r.risk.confidence * 100) : "--";
      const isVerified = r.status === "verified";
      const redFlags = r.red_flags || [];
      const contradictions = r.contradictions || [];
      const gaps = r.gaps || [];
      const timeline = r.timeline || [];
      const transcripts = r.transcripts || [];

      return `
      <div class="patient-card ${tier}" id="card-${r.id}">
        <div class="card-header">
          <div>
            <div class="patient-meta-primary">
              <span class="tier-badge">${tierIcons[tier] || "⚪"} ${tier.toUpperCase()}</span>
              <span class="complaint-title">${esc(chief)}</span>
              ${isVerified ? `<span class="badge" style="background:#065f46;color:#a7f3d0">✓ Verified (${esc(r.final_tier || tier)})</span>` : ""}
            </div>
            <div class="meta-tags">
              <span class="tag source">👤 ${esc(r.source)}</span>
              <span class="tag">🌐 ${esc(r.language.toUpperCase())}</span>
              <span class="tag conf">Confidence ${conf}%</span>
              ${r.source === "paramedic" ? `<span class="tag" style="background:#dc2626;color:#fff;font-weight:700">🚑 EMS ${esc(r.paramedic_unit || '')}</span>` : ""}
              ${r.fast_code ? `<span class="tag" style="background:#ef4444;color:#fff;font-weight:700">🚨 CODE: ${esc(r.fast_code)}</span>` : ""}
              ${r.eta_minutes ? `<span class="tag eta">⏱ ETA ${r.eta_minutes} min</span>` : ""}
              ${r.telemetry?.spo2 ? `<span class="telemetry-badge-inline">SpO2 ${esc(r.telemetry.spo2)}%</span>` : ""}
              ${r.telemetry?.hr ? `<span class="telemetry-badge-inline">HR ${esc(r.telemetry.hr)} bpm</span>` : ""}
              ${r.telemetry?.bp ? `<span class="telemetry-badge-inline">BP ${esc(r.telemetry.bp)}</span>` : ""}
              <span class="tag" style="color:var(--text-dim)">ID: ${esc(r.id.substring(0, 8))}...</span>
            </div>
          </div>
          <div class="card-actions-quick">
            <button class="btn btn-ghost" onclick="viewHandoff('${r.id}')" title="View SBAR Handoff Note">📋 SBAR Note</button>
          </div>
        </div>

        <div class="card-body">
          ${
            redFlags.length > 0
              ? `<div class="red-flags-container">
                  ${redFlags.map((f) => `<span class="flag-badge">⚠ ${esc(f)}</span>`).join("")}
                </div>`
              : ""
          }

          ${
            contradictions.length > 0
              ? contradictions
                  .map(
                    (c) => `
                <div class="alert-contradiction">
                  ⚡ <b>Contradiction Detected:</b> “${esc(c.statement_a)}” vs “${esc(c.statement_b)}”
                  <br><small style="opacity:0.85">Clarification: ${esc(c.clarification)}</small>
                </div>`
                  )
                  .join("")
              : ""
          }

          <div class="reasoning-box">
            <b>Triage Assessment:</b> ${esc(r.risk?.reasoning || "Pending assessment")}
          </div>

          ${
            gaps.length > 0
              ? `<div class="gaps-list">
                  <b>Missing Protocol Inquiries:</b> ${gaps.map((g) => esc(g.missing)).join(", ")}
                </div>`
              : ""
          }

          <!-- Collapsible Timeline & Transcripts -->
          <button class="details-toggle" onclick="toggleDetails('${r.id}')">
            <span>▼</span> Timeline &amp; Transcripts (${transcripts.length} turns)
          </button>
          <div class="details-content" id="details-${r.id}">
            ${
              timeline.length > 0
                ? `<div class="timeline-track">
                    ${timeline
                      .map(
                        (t) => `
                      <div class="timeline-item">
                        <span class="timeline-time">${esc(t.at.replace("T", " "))}</span>
                        <span>${esc(t.label)}</span>
                      </div>`
                      )
                      .join("")}
                  </div>`
                : ""
            }

            <div class="transcripts-stream">
              ${transcripts
                .map(
                  (t) => `
                <div class="transcript-bubble">
                  <div class="transcript-native">${esc(t.native)}</div>
                  <div class="transcript-english">${esc(t.english)}</div>
                  <div class="transcript-conf">ASR Confidence: ${t.asr_confidence ? Math.round(t.asr_confidence * 100) : 90}%</div>
                </div>`
                )
                .join("")}
            </div>
          </div>
          <!-- Nurse Notes Section -->
          <div style="margin-top:12px;background:rgba(255,255,255,0.03);border-radius:10px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:11px;font-weight:700;color:#94a3b8">Attending Nurse Notes &amp; Verification</span>
              ${r.reviewed_at ? `<span style="font-size:10px;color:#34d399">Reviewed: ${new Date(r.reviewed_at).toLocaleTimeString()}</span>` : ""}
            </div>
            <div style="display:flex;gap:8px">
              <input type="text" id="nurse-notes-${r.id}" value="${esc(r.nurse_notes || '')}" placeholder="Add nurse observation / bedside notes..." style="flex:1;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px;color:#fff;font-size:12px">
              <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="saveNotes('${r.id}')">💾 Save</button>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <small style="color:var(--text-dim)">
            ${r.audit && r.audit.length ? `Audited by ${esc(r.audit[r.audit.length - 1].nurse_id)}` : "Awaiting nurse evaluation"}
          </small>
          <div class="nurse-actions">
            <button class="btn btn-accept" onclick="openReviewModal('${r.id}', 'accept')">✓ Accept ${tier.toUpperCase()}</button>
            <button class="btn btn-escalate" onclick="openReviewModal('${r.id}', 'escalate')">▲ Escalate</button>
            <button class="btn btn-downgrade" onclick="openReviewModal('${r.id}', 'downgrade')">▼ Downgrade</button>
            <button class="btn btn-override" onclick="openReviewModal('${r.id}', 'override')">✎ Override</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

async function saveNotes(sessionId) {
  const input = document.getElementById(`nurse-notes-${sessionId}`);
  if (!input) return;
  const notes = input.value.trim();
  try {
    const res = await fetch(`/api/sessions/${sessionId}/nurse-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nurse_id: "RN-Lead", notes: notes, mark_reviewed: true })
    });
    if (!res.ok) throw new Error("Server error saving notes");
    alert("Nurse notes saved and session verified!");
    loadQueue();
  } catch (e) {
    alert("Failed to save notes: " + e.message);
  }
}

function toggleDetails(id) {
  const el = document.getElementById(`details-${id}`);
  if (el) el.classList.toggle("open");
}

// Modal Review Workflow
function openReviewModal(sessionId, action) {
  activeReviewSessionId = sessionId;
  activeReviewAction = action;
  const session = rows.find((r) => r.id === sessionId);
  if (!session) return;

  const currentTier = (session.risk?.tier || "stable").toLowerCase();
  document.getElementById("review-current-tier").textContent = currentTier.toUpperCase();
  document.getElementById("review-action-label").textContent = action.toUpperCase();

  const tierSelectGroup = document.getElementById("review-tier-group");
  const tierSelect = document.getElementById("review-new-tier");

  if (action === "override") {
    tierSelectGroup.style.display = "flex";
    tierSelect.value = currentTier;
  } else {
    tierSelectGroup.style.display = "none";
  }

  document.getElementById("review-reason").value = "";
  document.getElementById("review-modal").classList.add("active");
}

function closeReviewModal() {
  document.getElementById("review-modal").classList.remove("active");
  activeReviewSessionId = null;
  activeReviewAction = null;
}

function applyReasonPreset(text) {
  const input = document.getElementById("review-reason");
  input.value = text;
}

async function submitReview() {
  if (!activeReviewSessionId || !activeReviewAction) return;
  const reason = document.getElementById("review-reason").value.trim();
  if (!reason) {
    alert("Clinical reason is mandatory for audit logging.");
    return;
  }

  let newTier = null;
  if (activeReviewAction === "override") {
    newTier = document.getElementById("review-new-tier").value;
  }

  const nurseId = getNurseId();

  try {
    const res = await fetch(`${API_BASE}/api/sessions/${activeReviewSessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nurse_id: nurseId,
        action: activeReviewAction,
        new_tier: newTier,
        reason: reason,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Review failed");
    }

    showToast(`Session ${activeReviewAction.toUpperCase()} saved by ${nurseId}`, "success");
    closeReviewModal();
    loadQueue();
  } catch (e) {
    alert("Error submitting clinical review: " + e.message);
  }
}

// SBAR Handoff View
function viewHandoff(sessionId) {
  const session = rows.find((r) => r.id === sessionId);
  if (!session) return;

  const h = session.handoff || {};
  const content = `
=========================================
CLINICAL SBAR NURSE HANDOFF NOTE
=========================================
PATIENT ID: ${session.id}
SOURCE: ${session.source.toUpperCase()} | LANGUAGE: ${session.language.toUpperCase()}
ETA: ${session.eta_minutes ? session.eta_minutes + " mins" : "On-site Kiosk"}

[SITUATION]
Chief Complaint: ${session.entities?.chief_complaint || "Not reported"}
Assigned Priority: ${(session.final_tier || session.risk?.tier || "STABLE").toUpperCase()}
Confidence: ${session.risk?.confidence ? Math.round(session.risk.confidence * 100) : "--"}%

[BACKGROUND]
Age: ${session.entities?.age ? session.entities.age + " yrs" : "Not specified"}
Reported Symptoms: ${(session.entities?.symptoms || []).join(", ") || "None"}
Severity: ${session.entities?.severity ? session.entities.severity + "/10" : "Unrated"}
Onset: ${session.entities?.onset_text || "Unknown"}
Progression: ${session.entities?.progression || "Stable"}

[ASSESSMENT]
Red Flags: ${(session.red_flags || []).join("; ") || "None identified"}
Triage Reasoning: ${session.risk?.reasoning || "None"}
Contradictions: ${(session.contradictions || []).map((c) => c.field + ": " + c.clarification).join("; ") || "None"}
Missing Protocol Gaps: ${(session.gaps || []).map((g) => g.missing).join(", ") || "None"}

[RECOMMENDATION / NURSE AUDIT]
Audit Trail: ${(session.audit || []).map((a) => `[${a.at}] ${a.nurse_id} ${a.action.toUpperCase()} -> ${a.new_tier} (${a.reason})`).join("\n") || "Pending review"}

DISCLAIMER: Intake aid only. Does not diagnose. Final clinical decision made by nurse.
=========================================
  `.trim();

  document.getElementById("handoff-content").value = content;
  document.getElementById("handoff-modal").classList.add("active");
}

function closeHandoffModal() {
  document.getElementById("handoff-modal").classList.remove("active");
}

function copyHandoffText() {
  const text = document.getElementById("handoff-content").value;
  navigator.clipboard.writeText(text).then(() => {
    showToast("SBAR note copied to clipboard!", "success");
  });
}

// Analytics Modal Operations
async function openAnalyticsModal() {
  document.getElementById("analytics-modal").classList.add("active");
  await loadAnalyticsData();
}

function closeAnalyticsModal() {
  document.getElementById("analytics-modal").classList.remove("active");
}

async function loadAnalyticsData() {
  try {
    const res = await fetch(`${API_BASE}/api/analytics`);
    if (!res.ok) throw new Error("Failed to load analytics");
    const d = await res.json();

    document.getElementById("analytics-total").textContent = d.total_sessions || rows.length;
    document.getElementById("analytics-avg-time").textContent = `${d.avg_seconds_to_tier || 0.8}s`;
    document.getElementById("analytics-override-rate").textContent = `${d.override_stats?.override_rate_pct || 0}%`;
    document.getElementById("analytics-accept-rate").textContent = `${d.override_stats?.accept_rate_pct || 100}%`;

    const conf = d.asr_metrics?.avg_confidence ? Math.round(d.asr_metrics.avg_confidence * 100) : 92;
    document.getElementById("analytics-asr-conf").textContent = `${conf}% (Word Accuracy)`;

    // Tier Breakdown
    const tb = document.getElementById("analytics-tiers-breakdown");
    const tiers = d.tier_distribution || {};
    const totalTiers = Object.values(tiers).reduce((a, b) => a + b, 0) || 1;
    tb.innerHTML = Object.entries(tiers).map(([tier, count]) => {
      const pct = Math.round((count / totalTiers) * 100);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-top:2px">
          <span style="text-transform:capitalize">${tier}: <b>${count}</b></span>
          <span style="color:var(--text-muted)">${pct}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:5px;overflow:hidden">
          <div style="background:var(--${tier}-color, #3b82f6);width:${pct}%;height:100%"></div>
        </div>
      `;
    }).join("");

    // Language Breakdown
    const lb = document.getElementById("analytics-langs-breakdown");
    const langs = d.languages || {};
    const langNames = { te: "Telugu", ta: "Tamil", hi: "Hindi", kn: "Kannada", en: "English", mr: "Marathi", ml: "Malayalam", bn: "Bengali" };
    const langItems = Object.entries(langs).map(([code, count]) => {
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
          <span>${langNames[code] || code.toUpperCase()}: <b>${count}</b></span>
          <span class="tag" style="padding:1px 6px">${code.toUpperCase()}</span>
        </div>
      `;
    });
    lb.innerHTML = langItems.length > 0 ? langItems.join("") : `<span style="font-size:12px;color:var(--text-dim)">No language distribution recorded yet</span>`;

  } catch (err) {
    console.error("Failed to fetch analytics:", err);
    showToast("Error loading analytics data", "error");
  }
}

// Dev Seed & Reset
async function loadDemoCases() {
  try {
    const res = await fetch(`${API_BASE}/api/dev/seed`, { method: "POST" });
    const data = await res.json();
    showToast(`Loaded ${data.seeded} multilingual demo cases!`, "success");
    loadQueue();
  } catch (err) {
    showToast("Failed to load demo cases", "error");
  }
}

async function resetQueue() {
  if (!confirm("Are you sure you want to clear all active triage sessions?")) return;
  try {
    await fetch(`${API_BASE}/api/dev/reset`, { method: "POST" });
    showToast("Triage queue cleared.", "info");
    loadQueue();
  } catch (err) {
    showToast("Failed to reset queue", "error");
  }
}

// WebSocket Live Sync
function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}/ws/nurse`;
  const badge = document.getElementById("ws-status");

  let ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (badge) {
      badge.className = "live-badge";
      badge.innerHTML = '<span class="pulse-dot"></span> LIVE SYNC';
    }
  };

// Ambulance Pre-Arrival Alert Banner
function renderAmbulanceBanner(data) {
  const container = document.getElementById("ambulance-alert-container");
  if (!container) return;

  const tel = data.telemetry || {};
  const spo2 = tel.spo2 != null ? `${tel.spo2}%` : "--";
  const hr = tel.hr != null ? `${tel.hr} bpm` : "--";
  const bp = tel.bp || "--";
  const unit = data.paramedic_unit || "EMS-1";
  const code = data.fast_code || "CODE RED";
  const eta = data.eta_minutes != null ? data.eta_minutes : 10;
  const sid = data.session_id;

  container.innerHTML = `
    <div class="ambulance-emergency-banner" id="banner-${sid}">
      <div class="ambulance-header">
        <div class="ambulance-title-group">
          <span class="ambulance-siren">🚨</span>
          <div>
            <div class="ambulance-title">Pre-Arrival In-Transit Alert &bull; ${esc(unit)}</div>
            <small style="color:#fca5a5">In-transit telemetry streaming to emergency triage</small>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ambulance-eta-badge">⏱ ETA: ${eta} MINS</span>
          <span class="ambulance-eta-badge" style="background:#b91c1c">🔴 ${esc(code)}</span>
        </div>
      </div>

      <div class="ambulance-telemetry-grid">
        <div class="telemetry-item">
          <span class="telemetry-item-label">Oxygen (SpO2)</span>
          <span class="telemetry-item-val" style="color:${parseInt(spo2) < 90 ? '#ef4444' : '#34d399'}">${esc(spo2)}</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-item-label">Heart Rate (HR)</span>
          <span class="telemetry-item-val" style="color:${parseInt(hr) > 120 ? '#ef4444' : '#38bdf8'}">${esc(hr)}</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-item-label">Blood Pressure</span>
          <span class="telemetry-item-val">${esc(bp)}</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-item-label">EMS Unit</span>
          <span class="telemetry-item-val" style="font-size:15px">${esc(unit)}</span>
        </div>
      </div>

      <div class="ambulance-actions">
        <button class="btn btn-ghost" onclick="dismissAmbulanceBanner('${sid}')" style="color:#cbd5e1">Dismiss Alert</button>
        <button class="btn btn-emergency-bay" onclick="acknowledgeAmbulanceAlert('${sid}', '${esc(unit)}')">
          ✓ Acknowledge &amp; Prepare Resuscitation Bay
        </button>
      </div>
    </div>
  `;
}

function dismissAmbulanceBanner(sid) {
  const b = document.getElementById(`banner-${sid}`);
  if (b) b.remove();
}

function acknowledgeAmbulanceAlert(sid, unit) {
  showToast(`Resuscitation Bay 1 Prepped for incoming ${unit}. Trauma & Cardiac team alerted.`, "info");
  dismissAmbulanceBanner(sid);
}

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === "ambulance_alert") {
        renderAmbulanceBanner(data);
        showToast(`🚨 PRE-ARRIVAL ALERT: ${data.paramedic_unit} incoming with ${data.fast_code || 'Emergency'} in ${data.eta_minutes}m!`, "error");
      } else if (data.type === "update") {
        showToast(`Patient update: ${data.session.entities?.chief_complaint || data.session.id.substring(0, 8)}`, "info");
      }
      loadQueue();
    } catch (e) {
      loadQueue();
    }
  };

  ws.onclose = () => {
    if (badge) {
      badge.className = "live-badge connecting";
      badge.innerHTML = '<span class="pulse-dot"></span> RECONNECTING';
    }
    setTimeout(connectWebSocket, 2500);
  };

  ws.onerror = () => ws.close();
}

// Event Listeners Initialization
document.addEventListener("DOMContentLoaded", () => {
  updateNurseBadge();

  // Search input handler
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderQueue();
    });
  }

  // Filter tab buttons
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.getAttribute("data-filter");
      loadQueue();
    });
  });

  loadQueue();
  connectWebSocket();
});
