export type Caregiver = {
  id: string;
  clerk_id: string;
  name: string;
  timezone: string;
  phone: string;
};

export type Patient = {
  id: string;
  caregiver_id: string;
  name: string;
  age: number;
  phone: string;
  timezone: string;
  meds: Record<string, unknown>[];
  conditions: Record<string, unknown>[];
  call_schedule: string[];
  voice_choice: string; // VAPI assistant ID
  assigned_assistant: 'Julia' | 'Clyde' | 'Andy' | 'Lucy' | 'Priya' | null;
  last_call_at: string | null;
  flags: Record<string, unknown>[];
  summary: string | null;
  baseline_embedding_url: string | null;
};

export type NewPatient = Omit<Patient, 'id' | 'last_call_at' | 'flags' | 'summary'> & {
  id?: string;
  flags?: Record<string, unknown>[];
  summary?: string | null;
  last_call_at?: string | null;
};

export type CallLog = {
  id: string;
  patient_id: string;
  timestamp: string;
  assistant_name: string | null;
  outcome: 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail' | null;
  transcript: string | null;
  mood: 'good' | 'neutral' | 'bad' | null;
  sleep_quality: string | null;
  sleep_hours: number | null;
  summary: string | null;
  flags: Record<string, unknown>[];
  meds_taken: Array<{ medName: string; taken: boolean; timestamp: string }>;
  sentiment_score: number | null;
  anomaly_score: number | null;
};

export type NewCallLog = Omit<CallLog, 'id'> & { id?: string };

export type Medication = {
  id: string;
  patient_id: string;
  med_name: string;
  schedule: string;
  created_at: string;
  updated_at: string;
};

export type HealthFlag = {
  id: string;
  patient_id: string;
  flag: string;
  source: 'assistant' | 'anomaly' | 'caregiver' | 'system';
  timestamp: string;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
};

export type DailyCheckIn = {
  id: string;
  patient_id: string;
  date: string; // ISO date string
  mood: 'good' | 'neutral' | 'bad' | null;
  sleep_hours: number | null;
  sleep_quality: 'excellent' | 'good' | 'fair' | 'poor' | null;
  meds_taken: Array<{ medName: string; taken: boolean; timestamp: string }>;
  summary: string | null;
  flags: Record<string, unknown>[];
  anomaly_score: number | null;
  anomaly_severity: 'low' | 'medium' | 'high' | 'critical' | null;
  created_at: string;
  updated_at: string;
};

export type PatientVoiceBaseline = {
  patient_id: string;
  embedding: number[] | null; // float array or vector
  embedding_url: string | null;
  created_at: string;
  updated_at: string;
};

