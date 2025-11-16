import { getSupabaseClient } from './supabaseClient';

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
  const supabaseClient = getSupabaseClient();

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
  const supabaseClient = getSupabaseClient();

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

