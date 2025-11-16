import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables missing. Medication service will not work.');
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface MedLog {
  id: string;
  patient_id: string;
  med_name: string;
  taken: boolean;
  taken_at: string | null;
  timestamp: string;
  created_at: string;
}

export interface MedicationStatus {
  medName: string;
  taken: boolean;
  takenAt: string | null; // ISO timestamp
}

/**
 * Fetch today's medication logs for a patient
 */
export async function fetchTodaysMedLogs(patientId: string): Promise<MedLog[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabaseClient
    .from('med_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .order('taken_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data as MedLog[]) ?? [];
}

/**
 * Get patient's medication list from patients table
 */
export async function fetchPatientMedications(patientId: string): Promise<string[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select('meds')
    .eq('id', patientId)
    .single();

  if (error) {
    throw error;
  }

  // meds is stored as jsonb array, could be array of strings or objects
  const meds = data?.meds || [];
  
  // Handle both string arrays and object arrays
  if (Array.isArray(meds)) {
    return meds.map((med: any) => {
      if (typeof med === 'string') return med;
      if (med && typeof med === 'object' && med.name) return med.name;
      return String(med);
    }).filter(Boolean);
  }

  return [];
}

/**
 * Get today's medication status for all patient medications
 * Combines patient's medication list with today's logs
 */
export async function fetchTodaysMedicationStatus(patientId: string): Promise<MedicationStatus[]> {
  const [medications, todaysLogs] = await Promise.all([
    fetchPatientMedications(patientId),
    fetchTodaysMedLogs(patientId),
  ]);

  // Create a map of medication name to log entry
  const logMap = new Map<string, MedLog>();
  todaysLogs.forEach((log) => {
    // Use the most recent log for each medication
    if (!logMap.has(log.med_name) || 
        (log.taken_at && (!logMap.get(log.med_name)?.taken_at || 
         new Date(log.taken_at) > new Date(logMap.get(log.med_name)!.taken_at!)))) {
      logMap.set(log.med_name, log);
    }
  });

  // Return status for each medication
  return medications.map((medName) => {
    const log = logMap.get(medName);
    return {
      medName,
      taken: log?.taken ?? false,
      takenAt: log?.taken_at ?? null,
    };
  });
}

/**
 * Mark a medication as taken or not taken
 */
export async function updateMedicationStatus(
  patientId: string,
  medName: string,
  taken: boolean
): Promise<MedLog> {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if log already exists for today
  const { data: existing } = await supabaseClient
    .from('med_logs')
    .select('id')
    .eq('patient_id', patientId)
    .eq('med_name', medName)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    .maybeSingle();

  const updateData = {
    taken,
    taken_at: taken ? new Date().toISOString() : null,
    timestamp: new Date().toISOString(),
  };

  if (existing) {
    // Update existing log
    const { data, error } = await supabaseClient
      .from('med_logs')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as MedLog;
  } else {
    // Create new log entry
    const { data, error } = await supabaseClient
      .from('med_logs')
      .insert({
        patient_id: patientId,
        med_name: medName,
        ...updateData,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as MedLog;
  }
}
