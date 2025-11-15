/**
 * Health Flags Database Operations
 */

import { getSupabaseClient } from './client';
import type { HealthFlag } from './types';

export async function createHealthFlag(
  patientId: string,
  flag: string,
  source: 'assistant' | 'anomaly' | 'caregiver' | 'system',
  notes?: string
): Promise<HealthFlag> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('health_flags')
    .insert({
      patient_id: patientId,
      flag,
      source,
      notes: notes || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getHealthFlagsForPatient(
  patientId: string,
  resolved?: boolean
): Promise<HealthFlag[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('health_flags')
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: false });
  
  if (resolved !== undefined) {
    query = query.eq('resolved', resolved);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function resolveHealthFlag(flagId: string, notes?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('health_flags')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq('id', flagId);
  
  if (error) throw error;
}

