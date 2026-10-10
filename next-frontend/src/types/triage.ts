export type PriorityTier = "critical" | "urgent" | "concerning" | "stable";
export type ReviewAction = "accept" | "escalate" | "downgrade" | "override";

export interface Entities {
  chief_complaint?: string | null;
  symptoms: string[];
  associated?: string[];
  severity?: number | null;
  age?: number | null;
  progression?: string | null;
  onset_text?: string | null;
  aggravating?: string[];
  relieving?: string[];
  location?: string | null;
  duration?: string | null;
  frequency?: string | null;
  radiation?: string | null;
  medical_history?: string | null;
}

export interface RiskAssessment {
  tier: PriorityTier;
  score: number;
  is_emergency: boolean;
  confidence: number;
  reasoning: string;
  disclaimer: string;
}

export interface ProtocolGap {
  symptom: string;
  missing: string;
  question: string;
}

export interface Contradiction {
  field: string;
  turn_a: number;
  turn_b: number;
  statement_a: string;
  statement_b: string;
  confidence: number;
  clarification: string;
}

export interface TimelineEvent {
  at: string;
  hours_ago: number;
  label: string;
  turn: number;
}

export interface TranscriptTurn {
  native: string;
  english: string;
  asr_confidence: number;
}

export interface AuditLogEntry {
  nurse_id: string;
  action: string;
  old_tier: string;
  new_tier: string;
  reason: string;
  at: string;
}

export interface TelemetryVitals {
  spo2?: number | string | null;
  hr?: number | string | null;
  bp?: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  sender: "patient" | "assistant" | "nurse";
  language: string;
  original_text: string;
  english_text: string;
  created_at: string;
  submitted_at: string;
  status: string;
}

export interface EmergencyGuidance {
  level: string;
  alert: string;
  action: string;
  emergency_number: string;
  disclaimer: string;
}

export interface ClinicalSummary {
  chief_complaint: string;
  original_language: string;
  original_patient_statement: string;
  english_translation: string;
  symptom_onset: string;
  duration: string;
  frequency: string;
  severity: string;
  pain_location: string;
  associated_symptoms: string[];
  relevant_medical_history: string;
  missing_information: string[];
  safety_flags: string[];
  triage_priority: string;
  confidence_score: number;
  intake_started?: string | null;
  intake_submitted?: string | null;
  last_updated?: string | null;
  nurse_reviewed_at?: string | null;
  nurse_notes?: string;
  review_status: string;
  disclaimer: string;
}

export interface TranscribeTranslateResponse {
  original_text: string;
  english_text: string;
  language: string;
  confidence: number;
}

export type AnswerChoice = "yes" | "no" | "not_sure" | string;

export interface SymptomQuestion {
  id: string;
  text_en: string;
  text_native: string;
  type: "yes_no" | "scale" | "text";
  red_flag_if?: "yes" | "no" | null;
  red_flag_reason?: string | null;
  category: string;
  answer?: AnswerChoice | null;
  is_answered: boolean;
}

export type PatientAnswersMap = Record<string, AnswerChoice>;

export type QueueFilter = "all" | "active" | "pending" | "critical" | "review_required" | "completed" | "history";

export interface QueueCounts {
  all: number;
  active?: number;
  pending: number;
  critical: number;
  urgent?: number;
  concerning?: number;
  stable?: number;
  review_required: number;
  completed: number;
  archived?: number;
  history?: number;
}

export interface TriageSession {
  id: string;
  patient_name?: string | null;
  source: string;
  language: string;
  channel: string;
  status: "pending_review" | "verified" | "completed" | string;
  lifecycle_status?: "active" | "archived" | string;
  archived_at?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  final_tier?: PriorityTier | null;
  eta_minutes?: number | null;
  telemetry?: TelemetryVitals | null;
  paramedic_unit?: string | null;
  fast_code?: string | null;
  entities: Entities;
  gaps: ProtocolGap[];
  contradictions: Contradiction[];
  timeline: TimelineEvent[];
  red_flags: string[];
  risk?: RiskAssessment | null;
  next_question?: string | null;
  next_question_en?: string | null;
  next_question_native?: string | null;
  questionnaire?: SymptomQuestion[];
  patient_answers?: PatientAnswersMap;
  readback_en?: string | null;
  handoff?: Record<string, any>;
  audit: AuditLogEntry[];
  transcripts: TranscriptTurn[];
  messages?: Message[];
  started_at?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  confirmed_at?: string | null;
  last_activity_at?: string | null;
  escalation_status?: "none" | "escalated" | string;
  nurse_notes?: string;
  summary?: ClinicalSummary | null;
  emergency_guidance?: EmergencyGuidance | null;
  confirmed: boolean;
}

export interface AnalyticsSummary {
  total_sessions: number;
  avg_seconds_to_tier: number;
  tier_distribution: Record<string, number>;
  override_stats: {
    total_reviews: number;
    accept_count: number;
    escalate_count: number;
    downgrade_count: number;
    override_rate_pct: number;
    accept_rate_pct: number;
  };
  languages: Record<string, number>;
  sources: Record<string, number>;
  asr_metrics: {
    avg_confidence: number;
    total_utterances: number;
    providers: Record<string, number>;
  };
}

export interface AmbulanceAlertPayload {
  session_id?: string;
  chief_complaint: string;
  eta_minutes: number;
  telemetry: TelemetryVitals;
  paramedic_unit: string;
  fast_code?: string;
}
