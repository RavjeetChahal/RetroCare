/**
 * Medications Database Operations
 */

import { getSupabaseClient } from './client';
import type { Medication } from './types';

export async function createMedication(
  patientId: string,
  medName: string,
  schedule: string
): Promise<Medication> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('medications')
    .insert({
      patient_id: patientId,
      med_name: medName,
      schedule,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getMedicationsForPatient(patientId: string): Promise<Medication[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function deleteMedication(medicationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('medications')
    .delete()
    .eq('id', medicationId);
  
  if (error) throw error;
}

