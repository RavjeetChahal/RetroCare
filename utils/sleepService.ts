import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Sleep service will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface SleepLog {
  id: string;
  patient_id: string;
  hours: number;
  timestamp: string;
  created_at: string;
}

export interface SleepData {
  hours: number | null;
  quality: string | null; // From call_logs or daily_checkins
  timestamp: string | null;
}

/**
 * Fetch today's sleep data for a patient
 * This combines data from sleep_logs and call_logs/daily_checkins
 */
export async function fetchTodaysSleep(patientId: string): Promise<SleepData> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // First, try to get sleep from sleep_logs
  const { data: sleepLogs, error: sleepError } = await supabaseClient
    .from('sleep_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sleepError && sleepError.code !== 'PGRST116') {
    console.warn('Error fetching sleep logs:', sleepError);
  }

  // Also check daily_checkins for sleep quality
  const { data: dailyCheckIn, error: checkInError } = await supabaseClient
    .from('daily_checkins')
    .select('sleep_hours, sleep_quality, date')
    .eq('patient_id', patientId)
    .eq('date', today.toISOString().split('T')[0])
    .maybeSingle();

  if (checkInError && checkInError.code !== 'PGRST116') {
    console.warn('Error fetching daily check-in:', checkInError);
  }

  // Prioritize sleep_logs hours, but use daily_checkins for quality
  const hours = sleepLogs?.hours ?? dailyCheckIn?.sleep_hours ?? null;
  const quality = dailyCheckIn?.sleep_quality ?? null;
  const timestamp = sleepLogs?.timestamp ?? dailyCheckIn?.date ?? null;

  return {
    hours: hours !== null && hours !== undefined ? Number(hours) : null,
    quality,
    timestamp,
  };
}

/**
 * Get sleep quality display information
 */
export function getSleepQualityDisplay(quality: string | null): { label: string; emoji: string; color: string } {
  if (!quality) {
    return {
      label: 'Not Reported',
      emoji: '😴',
      color: '#64748b', // gray
    };
  }

  switch (quality.toLowerCase()) {
    case 'excellent':
      return {
        label: 'Excellent',
        emoji: '😊',
        color: '#10b981', // green
      };
    case 'good':
      return {
        label: 'Good',
        emoji: '🙂',
        color: '#22c55e', // light green
      };
    case 'fair':
      return {
        label: 'Fair',
        emoji: '😐',
        color: '#eab308', // yellow
      };
    case 'poor':
      return {
        label: 'Poor',
        emoji: '😔',
        color: '#ef4444', // red
      };
    default:
      return {
        label: quality,
        emoji: '😴',
        color: '#64748b',
      };
  }
}

