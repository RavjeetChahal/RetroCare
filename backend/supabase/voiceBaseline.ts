/**
 * Patient Voice Baseline Database Operations
 */

import { getSupabaseClient } from './client';
import type { PatientVoiceBaseline } from './types';

export async function getVoiceBaseline(patientId: string): Promise<PatientVoiceBaseline | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('patient_voice_baseline')
    .select('*')
    .eq('patient_id', patientId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }
  
  return data || null;
}

export async function saveVoiceBaseline(
  patientId: string,
  embedding: number[] | null,
  embeddingUrl: string | null
): Promise<PatientVoiceBaseline> {
  const supabase = getSupabaseClient();
  
  // Check if baseline exists
  const existing = await getVoiceBaseline(patientId);
  
  if (existing) {
    // Update existing baseline
    const { data, error } = await supabase
      .from('patient_voice_baseline')
      .update({
        embedding: embedding ? JSON.stringify(embedding) : null,
        embedding_url: embeddingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('patient_id', patientId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Create new baseline
    const { data, error } = await supabase
      .from('patient_voice_baseline')
      .insert({
        patient_id: patientId,
        embedding: embedding ? JSON.stringify(embedding) : null,
        embedding_url: embeddingUrl,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

