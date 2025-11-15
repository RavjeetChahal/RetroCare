import { createClient } from '@supabase/supabase-js';
import type { Patient, CallLog } from '../backend/supabase/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Dashboard will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Get caregiver ID from Clerk user ID
 */
export async function getCaregiverByClerkId(clerkId: string) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabaseClient
    .from('caregivers')
    .select('id')
    .eq('clerk_id', clerkId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Fetch all patients for a caregiver
 */
export async function fetchPatientsForCaregiver(caregiverId: string): Promise<Patient[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as Patient[]) ?? [];
}

/**
 * Fetch call logs for a patient
 */
export async function fetchCallLogsForPatient(patientId: string): Promise<CallLog[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabaseClient
    .from('call_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as CallLog[]) ?? [];
}

/**
 * Fetch call logs for multiple patients within a date range
 */
export async function fetchCallLogsForPatients(
  patientIds: string[],
  startDate: Date,
  endDate: Date,
): Promise<CallLog[]> {
  if (!supabaseClient || patientIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('call_logs')
    .select('*')
    .in('patient_id', patientIds)
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as CallLog[]) ?? [];
}

/**
 * Fetch today's call logs for all patients
 */
export async function fetchTodaysCallLogs(patientIds: string[]): Promise<CallLog[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return fetchCallLogsForPatients(patientIds, today, tomorrow);
}

