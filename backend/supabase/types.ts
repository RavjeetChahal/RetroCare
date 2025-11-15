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
  voice_choice: string;
  last_call_at: string | null;
  flags: Record<string, unknown>[];
  summary: string | null;
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
  mood: string | null;
  sleep_quality: string | null;
  summary: string | null;
  flags: Record<string, unknown>[];
};

export type NewCallLog = Omit<CallLog, 'id'> & { id?: string };

