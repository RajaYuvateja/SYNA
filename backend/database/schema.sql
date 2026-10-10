-- PostgreSQL schema for Clinical Voice Triage
-- All tables and indexes for patient intake, triage state, transcripts, and audit logs.

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  age NUMERIC(5, 2),  -- Supports pediatric ages (e.g., 0.5 years for 6 months)
  sex TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS triage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  source TEXT CHECK (source IN ('patient', 'relative', 'paramedic', 'community_health_worker')),
  channel TEXT DEFAULT 'kiosk',
  language TEXT,
  tier TEXT CHECK (tier IN ('stable', 'concerning', 'urgent', 'critical')),
  score INT,
  is_emergency BOOL DEFAULT false,
  confidence REAL,
  reasoning TEXT,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'verified')),
  eta_minutes INT,
  handoff_note JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcripts (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE CASCADE,
  turn INT,
  speaker TEXT,
  language TEXT,
  dialect TEXT,
  native_text TEXT,
  english_text TEXT,
  asr_confidence REAL,
  audio_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS symptoms (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE CASCADE,
  name TEXT,
  severity INT,
  onset_iso TIMESTAMPTZ,
  details JSONB
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE CASCADE,
  at TIMESTAMPTZ,
  label TEXT,
  source_turn INT
);

CREATE TABLE IF NOT EXISTS contradictions (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE CASCADE,
  field TEXT,
  turn_a INT,
  turn_b INT,
  statement_a TEXT,
  statement_b TEXT,
  confidence REAL,
  clarification TEXT,
  resolved BOOL DEFAULT false
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES triage_sessions(id) ON DELETE CASCADE,
  nurse_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('accept', 'escalate', 'downgrade', 'override')),
  old_tier TEXT,
  new_tier TEXT,
  reason TEXT NOT NULL,
  at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intake_metrics (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,
  turns INT,
  seconds_to_tier REAL,
  asr_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for fast queue filtering and session lookups
CREATE INDEX IF NOT EXISTS idx_triage_sessions_status_tier ON triage_sessions (status, tier);
CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs (session_id);

-- Safely migrate lifecycle and verification columns
ALTER TABLE triage_sessions ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE triage_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE triage_sessions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE triage_sessions ADD COLUMN IF NOT EXISTS verified_by TEXT;
