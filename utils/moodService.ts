import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Mood service will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export type Mood = 'happy' | 'neutral' | 'sad';

export interface MoodLog {
  id: string;
  patient_id: string;
  mood: Mood;
  timestamp: string;
  created_at: string;
}

/**
 * Fetch today's mood for a patient
 */
export async function fetchTodaysMood(patientId: string): Promise<MoodLog | null> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabaseClient
    .from('mood_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as MoodLog | null;
}

/**
 * Update or create today's mood for a patient
 */
export async function updateTodaysMood(patientId: string, mood: Mood): Promise<MoodLog> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if mood already exists for today
  const { data: existing } = await supabaseClient
    .from('mood_logs')
    .select('id')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .maybeSingle();

  if (existing) {
    // Update existing mood
    const { data, error } = await supabaseClient
      .from('mood_logs')
      .update({ mood, timestamp: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as MoodLog;
  } else {
    // Create new mood entry
    const { data, error } = await supabaseClient
      .from('mood_logs')
      .insert({
        patient_id: patientId,
        mood,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as MoodLog;
  }
}

