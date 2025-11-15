import { getSupabaseClient } from './client';
import type { CallLog, NewPatient, Patient } from './types';
import { logger } from '../../utils';

const TABLE = 'patients';

export async function createPatient(input: NewPatient): Promise<Patient> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    meds: input.meds ?? [],
    conditions: input.conditions ?? [],
    call_schedule: input.call_schedule ?? [],
    flags: input.flags ?? [],
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) {
    logger.error('Failed to create patient', error);
    throw error;
  }
  return data as Patient;
}

export async function updatePatient(id: string, updates: Partial<NewPatient>): Promise<Patient> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).update(updates).eq('id', id).select().single();
  if (error) {
    logger.error('Failed to update patient', error);
    throw error;
  }
  return data as Patient;
}

export async function deletePatient(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    logger.error('Failed to delete patient', error);
    throw error;
  }
}

export async function listPatientsByCaregiver(caregiverId: string): Promise<Patient[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select('*').eq('caregiver_id', caregiverId);
  if (error) {
    logger.error('Failed to fetch patients for caregiver', error);
    throw error;
  }
  return (data as Patient[]) ?? [];
}

export async function getPatientWithLogs(patientId: string): Promise<{
  patient: Patient | null;
  callLogs: CallLog[];
}> {
  const supabase = getSupabaseClient();
  const [{ data: patient, error: patientError }, { data: logs, error: logError }] = await Promise.all([
    supabase.from(TABLE).select('*').eq('id', patientId).single(),
    supabase.from('call_logs').select('*').eq('patient_id', patientId).order('timestamp', { ascending: false }),
  ]);

  if (patientError) {
    logger.error('Failed to fetch patient', patientError);
    throw patientError;
  }

  if (logError) {
    logger.error('Failed to fetch call logs', logError);
    throw logError;
  }

  return {
    patient: (patient as Patient) ?? null,
    callLogs: (logs as CallLog[]) ?? [],
  };
}

