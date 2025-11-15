import { getSupabaseClient } from './client';
import type { CallLog, NewCallLog } from './types';
import { logger } from '../utils/logger';

const TABLE = 'call_logs';

export async function createCallLog(input: NewCallLog): Promise<CallLog> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    flags: input.flags ?? [],
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) {
    logger.error('Failed to create call log', error);
    throw error;
  }

  return data as CallLog;
}

export async function listCallLogsForPatient(patientId: string): Promise<CallLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: false });

  if (error) {
    logger.error('Failed to fetch call logs', error);
    throw error;
  }

  return (data as CallLog[]) ?? [];
}

export async function deleteCallLog(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    logger.error('Failed to delete call log', error);
    throw error;
  }
}

