import { TriageSession, AnalyticsSummary, AmbulanceAlertPayload, ReviewAction, QueueFilter, QueueCounts } from "@/types/triage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchQueue(
  filter: QueueFilter | string = "all",
  sortBy: "newest" | "oldest" | "severity" = "newest"
): Promise<TriageSession[]> {
  const res = await fetch(`${API_BASE}/api/queue?filter=${filter}&sort_by=${sortBy}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch queue: ${res.statusText}`);
  return res.json();
}

export async function fetchQueueCounts(): Promise<QueueCounts> {
  const res = await fetch(`${API_BASE}/api/queue/counts`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch queue counts");
  return res.json();
}

export async function fetchSession(id: string): Promise<TriageSession> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.statusText}`);
  return res.json();
}

export async function createSession(params: {
  language: string;
  source: string;
  channel?: string;
  eta_minutes?: number | null;
  telemetry?: any;
}): Promise<{ id: string; session: TriageSession }> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function transcribeAndTranslate(params: {
  text?: string;
  audio_b64?: string;
  language?: string;
  target_language?: string;
  codemixed?: boolean;
}): Promise<{
  original_text: string;
  english_text: string;
  language: string;
  confidence: number;
}> {
  const res = await fetch(`${API_BASE}/api/speech/transcribe-translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Speech recognition error" }));
    throw new Error(err.detail || "Transcription service error");
  }
  return res.json();
}

export async function fetchSessionMessages(sessionId: string): Promise<{
  session_id: string;
  messages: any[];
}> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load conversation messages");
  return res.json();
}

export async function saveNurseNotes(sessionId: string, params: {
  nurse_id: string;
  notes: string;
  mark_reviewed?: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/nurse-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to save nurse notes");
  return res.json();
}

export async function sendUtterance(sessionId: string, params: {
  text?: string;
  english_text?: string;
  audio_b64?: string;
  language?: string;
  asr_confidence?: number;
  codemixed?: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/utterance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Server error");
  }
  return res.json();
}

export async function submitQuestionnaireAnswer(
  sessionId: string,
  params: {
    question_id: string;
    answer: string;
    clarification?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/questionnaire-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to record answer" }));
    throw new Error(err.detail || "Failed to save questionnaire answer");
  }
  return res.json();
}

export async function confirmReport(
  sessionId: string,
  params: {
    patient_name?: string;
    notes?: string;
  } = {}
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirm-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to confirm report");
  return res.json();
}

export async function correctStatement(
  sessionId: string,
  params: {
    corrected_text: string;
    language?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/correct-statement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to correct statement");
  return res.json();
}

export async function updateSessionLanguage(
  sessionId: string,
  language: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/language`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new Error("Failed to update session language");
  return res.json();
}

export async function confirmIntake(sessionId: string, text: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to confirm intake");
  return res.json();
}


export async function reviewSession(
  sessionId: string,
  params: {
    nurse_id: string;
    action: ReviewAction;
    new_tier?: string | null;
    reason: string;
  }
): Promise<TriageSession> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Review failed" }));
    throw new Error(err.detail || "Clinical review submission failed");
  }
  return res.json();
}

export async function streamAmbulanceTelemetry(payload: AmbulanceAlertPayload): Promise<{
  status: string;
  session_id: string;
  session: TriageSession;
}> {
  const res = await fetch(`${API_BASE}/api/ambulance/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to transmit ambulance telemetry");
  return res.json();
}

export async function fetchAnalytics(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/api/analytics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function seedDemoCases(): Promise<{ seeded: number; total_active: number }> {
  const res = await fetch(`${API_BASE}/api/dev/seed`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed demo cases");
  return res.json();
}

export async function resetSessions(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/dev/reset`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset queue");
  return res.json();
}

export function getWebSocketUrl(): string {
  if (typeof window !== "undefined") {
    const host = process.env.NEXT_PUBLIC_WS_HOST || "localhost:8000";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}/ws/nurse`;
  }
  return "ws://localhost:8000/ws/nurse";
}
