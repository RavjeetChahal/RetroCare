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

