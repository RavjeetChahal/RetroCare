import { createClient } from '@supabase/supabase-js';
import type { CallLog } from '../backend/supabase/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Call service will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export type CallStatus = 'picked_up' | 'missed' | 'neutral';

export interface CallListItem {
  id: string;
  patient_id: string;
  timestamp: string;
  summary: string | null;
  status: CallStatus;
  outcome: CallLog['outcome'];
}

/**
 * Map call_logs outcome to UI status
 * picked_up = answered (green phone)
 * missed = no_answer, busy, failed (red phone_down)
 * neutral = voicemail (yellow phone)
 */
function mapOutcomeToStatus(outcome: CallLog['outcome']): CallStatus {
  if (outcome === 'answered') {
    return 'picked_up';
  }
  if (outcome === 'voicemail') {
    return 'neutral';
  }
  // no_answer, busy, failed, or null
  return 'missed';
}

/**
 * Fetch today's calls for a patient
 */
export async function fetchTodaysCalls(patientId: string): Promise<CallListItem[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabaseClient
    .from('call_logs')
    .select('id, patient_id, timestamp, summary, outcome')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  // Map to CallListItem with status
  return (data as CallLog[]).map((call) => ({
    id: call.id,
    patient_id: call.patient_id,
    timestamp: call.timestamp,
    summary: call.summary,
    status: mapOutcomeToStatus(call.outcome),
    outcome: call.outcome,
  }));
}

