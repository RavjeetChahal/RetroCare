-- Migration: Add new tables for RetroCare Phase 2+ features
-- Run this migration to add medications, patient_voice_baseline, health_flags, and daily_checkins tables
-- Also update patients and call_logs tables with new fields

-- Update patients table to add assigned_assistant field
alter table if exists patients 
  add column if not exists assigned_assistant text check (assigned_assistant in ('Julia', 'Clyde', 'Andy', 'Lucy', 'Priya'));

-- Create medications table
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  med_name text not null,
  schedule text not null, -- "morning", "evening", "afternoon", "night", etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create patient_voice_baseline table
create table if not exists patient_voice_baseline (
  patient_id uuid primary key references patients(id) on delete cascade,
  embedding vector(256), -- Using pgvector extension, or float[] if not available
  embedding_url text, -- URL to stored embedding file
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create health_flags table
create table if not exists health_flags (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  flag text not null,
  source text not null check (source in ('assistant', 'anomaly', 'caregiver', 'system')),
  timestamp timestamptz not null default now(),
  resolved boolean default false,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Update call_logs table with new fields
alter table if exists call_logs
  add column if not exists assistant_name text,
  add column if not exists outcome text check (outcome in ('answered', 'no_answer', 'busy', 'failed', 'voicemail')),
  add column if not exists transcript text,
  add column if not exists meds_taken jsonb default '[]'::jsonb,
  add column if not exists sentiment_score float check (sentiment_score >= 0.0 and sentiment_score <= 1.0),
  add column if not exists anomaly_score float check (anomaly_score >= 0.0 and anomaly_score <= 1.0);

-- Create daily_checkins table
create table if not exists daily_checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  date date not null,
  mood text check (mood in ('good', 'neutral', 'bad')),
  sleep_hours float,
  sleep_quality text check (sleep_quality in ('excellent', 'good', 'fair', 'poor')),
  meds_taken jsonb default '[]'::jsonb,
  summary text,
  flags jsonb default '[]'::jsonb,
  anomaly_score float check (anomaly_score >= 0.0 and anomaly_score <= 1.0),
  anomaly_severity text check (anomaly_severity in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(patient_id, date) -- One check-in per patient per day
);

-- Create indexes for performance
create index if not exists idx_medications_patient_id on medications(patient_id);
create index if not exists idx_health_flags_patient_id on health_flags(patient_id);
create index if not exists idx_health_flags_timestamp on health_flags(timestamp desc);
create index if not exists idx_health_flags_resolved on health_flags(resolved) where resolved = false;
create index if not exists idx_daily_checkins_patient_id on daily_checkins(patient_id);
create index if not exists idx_daily_checkins_date on daily_checkins(date desc);
create index if not exists idx_daily_checkins_patient_date on daily_checkins(patient_id, date);
create index if not exists idx_call_logs_patient_timestamp on call_logs(patient_id, timestamp desc);
create index if not exists idx_call_logs_outcome on call_logs(outcome) where outcome = 'answered';

