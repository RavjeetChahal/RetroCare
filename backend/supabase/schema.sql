-- RetroCare Database Schema
-- Structure: Caregivers -> Patients -> Call Logs
-- Each caregiver (linked via clerk_id) has multiple patients
-- Each patient has multiple call logs

-- Enable Row Level Security (RLS is enabled but app uses Clerk for auth)
-- Application code filters by clerk_id for user-specific data

create table if not exists caregivers (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique, -- Links to Clerk user ID for authentication
  name text not null,
  timezone text not null,
  phone text not null,
  created_at timestamptz default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references caregivers(id) on delete cascade,
  name text not null,
  age integer not null,
  phone text not null,
  timezone text not null,
  meds jsonb default '[]'::jsonb, -- Array of medication names
  conditions jsonb default '[]'::jsonb, -- Array of pre-existing conditions
  call_schedule jsonb default '[]'::jsonb, -- Array of scheduled call times
  voice_choice text not null, -- Selected ElevenLabs voice ID
  last_call_at timestamptz, -- Timestamp of most recent call
  flags jsonb default '[]'::jsonb, -- Array of flags (e.g., ["low-priority"])
  summary text, -- Patient summary/notes
  baseline_embedding_url text, -- URL to stored baseline voice embedding
  created_at timestamptz default now()
);

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  timestamp timestamptz not null default now(),
  mood text, -- Patient's mood during call
  sleep_quality text, -- Sleep quality reported
  summary text, -- Call summary/notes
  flags jsonb default '[]'::jsonb -- Array of flags from the call
);

-- Voice Anomaly Detection Logs
create table if not exists voice_anomaly_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  call_log_id uuid references call_logs(id) on delete set null,
  timestamp timestamptz not null default now(),
  anomaly_score float not null check (anomaly_score >= 0 and anomaly_score <= 1),
  raw_similarity float,
  normalized_score float,
  snr float,
  baseline_embedding_url text, -- URL to stored baseline embedding (S3, Supabase Storage, etc.)
  current_embedding_url text,   -- URL to current call embedding
  alert_sent boolean default false,
  alert_type text check (alert_type in ('warning', 'emergency', null)),
  notes text,
  created_at timestamptz default now()
);

-- Indexes for fast queries
create index if not exists idx_voice_anomaly_patient_id on voice_anomaly_logs(patient_id);
create index if not exists idx_voice_anomaly_timestamp on voice_anomaly_logs(timestamp desc);
create index if not exists idx_voice_anomaly_alert_type on voice_anomaly_logs(alert_type) where alert_type is not null;

