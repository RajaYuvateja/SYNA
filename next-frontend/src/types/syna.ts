/**
 * SYNA — Multilingual Clinical Voice Triage & Nurse Handoff Platform
 * Core Type Definitions & Clinical Data Contracts
 */

export type RegionalLanguage =
  | "te" // Telugu
  | "ta" // Tamil
  | "hi" // Hindi
  | "kn" // Kannada
  | "en" // English
  | "ml" // Malayalam
  | "bn" // Bengali
  | "mr" // Marathi
  | "gu" // Gujarati
  | "or" // Odia
  | "pa"; // Punjabi

export interface LanguageOption {
  code: RegionalLanguage;
  label: string;
  nativeLabel: string;
  flag?: string;
}

export type ClinicalPriority = "critical" | "urgent" | "concerning" | "stable";

export type ConfidenceLevel = "high" | "medium" | "low";

export type FieldSource =
  | "patient_reported"
  | "ai_extracted"
  | "patient_confirmed"
  | "nurse_corrected"
  | "nurse_confirmed";

export type LifecycleStatus = "active" | "archived";

export interface ClinicalField<T = string | number | string[]> {
  value: T;
  source: FieldSource;
  confidence: number; // 0.0 to 1.0
  confidenceLevel: ConfidenceLevel;
  originalText?: string;
  translatedText?: string;
  lastUpdated?: string;
  updatedBy?: string;
}

export interface RuleFlag {
  id: string;
  category: "cardiovascular" | "neurological" | "respiratory" | "trauma" | "pediatric" | "sepsis" | "general";
  title: string;
  description: string;
  protocolWarning: string;
  severity: "critical" | "urgent" | "warning";
  timestamp: string;
  isHardSafetyNet: boolean; // Cannot be suppressed by AI
}

export interface Contradiction {
  id: string;
  field: string;
  statementA: string;
  statementB: string;
  clarificationQuestion: string;
  resolved: boolean;
}

export interface AudioEvidenceSnippet {
  id: string;
  turnIndex: number;
  durationSeconds: number;
  nativeText: string;
  englishText: string;
  language: RegionalLanguage;
  asrConfidence: number;
  timestamp: string;
  audioBlobUrl?: string;
}

export interface TimelineEvent {
  id: string;
  timeframe: string;
  event: string;
  severityAtTime?: number;
  evidenceId?: string;
}

export interface ParamedicTelemetry {
  unitId: string;
  etaMinutes: number;
  fastCode: "CODE RED" | "CODE YELLOW" | "CODE GREEN";
  vitals: {
    spo2: number;
    hr: number;
    bp: string;
    respiratoryRate?: number;
    gcs?: number;
    bloodGlucose?: number;
  };
  interventionsGiven: string[];
  paramedicNotes?: string;
  transmittedAt: string;
}

export interface AuditEvent {
  id: string;
  caseId: string;
  timestamp: string;
  actor: "patient" | "sarvam_ai" | "nurse" | "paramedic" | "rule_engine";
  actorId?: string;
  eventType:
    | "audio_captured"
    | "transcription_generated"
    | "entity_extracted"
    | "contradiction_flagged"
    | "rule_flag_triggered"
    | "patient_clarified"
    | "patient_confirmed"
    | "nurse_accepted"
    | "nurse_escalated"
    | "nurse_downgraded"
    | "nurse_overridden"
    | "nurse_notes_saved"
    | "case_archived";
  details: string;
  previousValue?: string;
  newValue?: string;
  rationale?: string;
}

export interface SynaPatientCase {
  id: string;
  patientId: string;
  patientName: string;
  age: number | null;
  gender: "M" | "F" | "Other" | "Unknown";
  preferredLanguage: RegionalLanguage;
  source: "patient" | "caregiver" | "paramedic";
  channel: "kiosk" | "mobile" | "ambulance";
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;

  // Clinical Summary
  chiefComplaint: ClinicalField<string>;
  severity: ClinicalField<number>; // 1-10
  onsetText: ClinicalField<string>;
  location: ClinicalField<string>;
  associatedSymptoms: ClinicalField<string[]>;
  relevantHistory: ClinicalField<string>;

  // Safety & Audit
  ruleFlags: RuleFlag[];
  contradictions: Contradiction[];
  missingFields: string[];
  evidenceSnippets: AudioEvidenceSnippet[];
  timeline: TimelineEvent[];
  paramedicTelemetry?: ParamedicTelemetry;

  // Triage Priority
  provisionalPriority: ClinicalPriority;
  aiTriageScore: number;
  aiConfidence: number;
  aiReasoning: string;

  // Nurse Review & Audit
  reviewStatus: "awaiting_review" | "reviewed" | "overridden" | "verified";
  attendingNurseId?: string;
  nurseNotes: string;
  reviewedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  archivedAt?: string;
  lifecycleStatus: LifecycleStatus;

  auditTrail: AuditEvent[];
}

export interface ClarifyingQuestion {
  id: string;
  textEn: string;
  textNative: string;
  language: RegionalLanguage;
  category: string;
  options?: string[];
  redFlagIfYes?: boolean;
}

export interface OfflineDraft {
  id: string;
  language: RegionalLanguage;
  recordedAt: string;
  audioBlob?: Blob;
  nativeDraftText: string;
  englishDraftText: string;
  answers: Record<string, string>;
  syncStatus: "saved_locally" | "syncing" | "synced" | "error";
}
