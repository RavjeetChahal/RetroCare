import { getSupabaseClient } from './client';
import { logger } from '../utils/logger';

export interface VoiceAnomalyLog {
  id: string;
  patient_id: string;
  call_log_id: string | null;
  timestamp: string;
  anomaly_score: number;
  raw_similarity: number | null;
  normalized_score: number | null;
  snr: number;
  baseline_embedding_url: string | null;
  current_embedding_url: string | null;
  alert_sent: boolean;
  alert_type: 'warning' | 'emergency' | null;
  notes: string | null;
  created_at: string;
}

export interface NewAnomalyLog {
  patient_id: string;
  call_log_id?: string;
  anomaly_score: number;
  raw_similarity?: number;
  normalized_score?: number;
  snr: number;
  baseline_embedding_url?: string;
  current_embedding_url?: string;
  alert_type?: 'warning' | 'emergency' | null;
  notes?: string;
}

const TABLE = 'voice_anomaly_logs';

/**
 * Create a new anomaly log entry
 */
export async function createAnomalyLog(input: NewAnomalyLog): Promise<VoiceAnomalyLog> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    raw_similarity: input.raw_similarity ?? null,
    normalized_score: input.normalized_score ?? null,
    baseline_embedding_url: input.baseline_embedding_url ?? null,
    current_embedding_url: input.current_embedding_url ?? null,
    alert_type: input.alert_type ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    logger.error('Failed to create anomaly log', error);
    throw error;
  }

  return data as VoiceAnomalyLog;
}

/**
 * Get all anomaly logs for a patient, ordered by timestamp (newest first)
 */
export async function getAnomalyLogsForPatient(patientId: string): Promise<VoiceAnomalyLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: false });

  if (error) {
    logger.error('Failed to fetch anomaly logs for patient', error);
    throw error;
  }

  return (data as VoiceAnomalyLog[]) ?? [];
}

/**
 * Get recent anomaly logs for multiple patients
 */
export async function getRecentAnomalyLogs(
  patientIds: string[],
  days: number = 7
): Promise<VoiceAnomalyLog[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('patient_id', patientIds)
    .gte('timestamp', cutoffDate.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    logger.error('Failed to fetch recent anomaly logs', error);
    throw error;
  }

  return (data as VoiceAnomalyLog[]) ?? [];
}

/**
 * Update an anomaly log entry
 */
export async function updateAnomalyLog(
  id: string,
  updates: Partial<NewAnomalyLog>
): Promise<VoiceAnomalyLog> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update anomaly log', error);
    throw error;
  }

  return data as VoiceAnomalyLog;
}

/**
 * Get anomaly logs with alert type filter
 */
export async function getAnomalyLogsByAlertType(
  patientIds: string[],
  alertType: 'warning' | 'emergency',
  days: number = 7
): Promise<VoiceAnomalyLog[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .in('patient_id', patientIds)
    .eq('alert_type', alertType)
    .gte('timestamp', cutoffDate.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    logger.error('Failed to fetch anomaly logs by alert type', error);
    throw error;
  }

  return (data as VoiceAnomalyLog[]) ?? [];
}

