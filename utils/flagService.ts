import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Flag service will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export type FlagType = 'fall' | 'med_missed' | 'other';
export type FlagSeverity = 'red' | 'yellow';

export interface Flag {
  id: string;
  patient_id: string;
  type: FlagType;
  severity: FlagSeverity;
  timestamp: string;
  created_at: string;
}

/**
 * Fetch today's flags for a patient
 */
export async function fetchTodaysFlags(patientId: string): Promise<Flag[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabaseClient
    .from('flags')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as Flag[]) ?? [];
}

/**
 * Get flag display information
 */
export function getFlagDisplay(flag: Flag): { label: string; emoji: string; color: string; bgColor: string } {
  switch (flag.type) {
    case 'fall':
      return {
        label: 'Fall Risk',
        emoji: '⚠️',
        color: '#ef4444', // red
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'med_missed':
      return {
        label: 'Medication Missed',
        emoji: '💊',
        color: '#eab308', // yellow
        bgColor: 'rgba(234, 179, 8, 0.15)',
      };
    default:
      return {
        label: 'Other Flag',
        emoji: '🚩',
        color: flag.severity === 'red' ? '#ef4444' : '#eab308',
        bgColor: flag.severity === 'red' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
      };
  }
}

