/**
 * Daily Check-Ins Database Operations
 */

import { getSupabaseClient } from './client';
import type { DailyCheckIn } from './types';

export async function getDailyCheckIn(
  patientId: string,
  date: string
): Promise<DailyCheckIn | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('patient_id', patientId)
    .eq('date', date)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }
  
  return data || null;
}

export async function getDailyCheckInsForPatient(
  patientId: string,
  limit: number = 30
): Promise<DailyCheckIn[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function upsertDailyCheckIn(checkIn: Partial<DailyCheckIn>): Promise<DailyCheckIn> {
  const supabase = getSupabaseClient();
  
  if (!checkIn.patient_id || !checkIn.date) {
    throw new Error('patient_id and date are required');
  }
  
  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert(
      {
        ...checkIn,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'patient_id,date',
      }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

