import { getSupabaseClient } from './supabaseClient';

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
  const supabaseClient = getSupabaseClient();

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
  const supabaseClient = getSupabaseClient();

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
 * Combines patient's medication list with today's logs from both med_logs and call_logs
 */
export async function fetchTodaysMedicationStatus(patientId: string): Promise<MedicationStatus[]> {
  const supabaseClient = getSupabaseClient();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [medications, todaysLogs, todaysCallLogs] = await Promise.all([
    fetchPatientMedications(patientId),
    fetchTodaysMedLogs(patientId),
    // Also fetch call logs to get meds_taken from calls
    // IMPORTANT: Fetch ALL call logs for today, even if meds_taken is empty array
    // Empty arrays are valid and indicate medications were checked but not taken
    supabaseClient
      .from('call_logs')
      .select('meds_taken, timestamp')
      .eq('patient_id', patientId)
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .order('timestamp', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching call logs for medications:', error);
          return [];
        }
        // Return all logs, including those with empty meds_taken arrays
        // Empty array means medications were checked but none were taken
        return (data || []).map(log => ({
          meds_taken: log.meds_taken || [],
          timestamp: log.timestamp,
        }));
      }),
  ]);

  // Create a map of medication name (normalized to lowercase) to status entry
  // Priority: most recent timestamp wins
  const statusMap = new Map<string, { taken: boolean; takenAt: string | null }>();

  // First, add entries from med_logs table
  todaysLogs.forEach((log) => {
    const normalizedName = log.med_name.trim().toLowerCase();
    const existing = statusMap.get(normalizedName);
    if (!existing || 
        (log.taken_at && (!existing.takenAt || 
         new Date(log.taken_at) > new Date(existing.takenAt)))) {
      statusMap.set(normalizedName, {
        taken: log.taken,
        takenAt: log.taken_at,
      });
    }
  });

  // Then, add/update entries from call_logs.meds_taken
  // Priority: "taken" status always wins over "not taken", and more recent timestamps win
  // Process call logs in reverse chronological order (most recent first)
  todaysCallLogs.forEach((callLog: any) => {
    if (Array.isArray(callLog.meds_taken)) {
      callLog.meds_taken.forEach((med: any) => {
        // Handle different possible structures
        const medName = med.medName || med.med_name || med.name || String(med);
        const medTaken = med.taken !== undefined ? Boolean(med.taken) : false;
        const medTimestamp = med.timestamp || callLog.timestamp;
        
        if (!medName || typeof medName !== 'string') {
          console.warn('[medService] Invalid medication entry in call log:', med);
          return;
        }
        
        const normalizedMedName = medName.trim().toLowerCase();
        const existing = statusMap.get(normalizedMedName);
        
        console.log('[medService] Processing medication from call log', {
          medName,
          normalizedMedName,
          medTaken,
          medTimestamp,
          callLogTimestamp: callLog.timestamp,
          hasExisting: !!existing,
          existingTaken: existing?.taken,
        });
        
        // Update logic: taken status always wins, then use most recent timestamp
        if (!existing) {
          // No existing status - use this one
          statusMap.set(normalizedMedName, {
            taken: medTaken,
            takenAt: medTaken ? (medTimestamp || callLog.timestamp) : null,
          });
          console.log('[medService] Set new medication status', {
            medName: normalizedMedName,
            taken: medTaken,
            takenAt: medTaken ? (medTimestamp || callLog.timestamp) : null,
          });
        } else if (medTaken && !existing.taken) {
          // Taken status always wins over not taken
          statusMap.set(normalizedMedName, {
            taken: true,
            takenAt: medTimestamp || callLog.timestamp,
          });
          console.log('[medService] Updated to taken (taken always wins)', {
            medName: normalizedMedName,
            takenAt: medTimestamp || callLog.timestamp,
          });
        } else if (medTaken && existing.taken) {
          // Both are taken - use more recent timestamp
          const existingTime = existing.takenAt ? new Date(existing.takenAt).getTime() : 0;
          const newTime = medTimestamp ? new Date(medTimestamp).getTime() : new Date(callLog.timestamp).getTime();
          if (newTime >= existingTime) {
            statusMap.set(normalizedMedName, {
              taken: true,
              takenAt: medTimestamp || callLog.timestamp,
            });
            console.log('[medService] Updated taken status with more recent timestamp', {
              medName: normalizedMedName,
              takenAt: medTimestamp || callLog.timestamp,
            });
          }
        } else if (!medTaken && existing.taken) {
          // New status is not taken, existing is taken - only update if this is more recent
          const existingTime = existing.takenAt ? new Date(existing.takenAt).getTime() : 0;
          const newTime = medTimestamp ? new Date(medTimestamp).getTime() : new Date(callLog.timestamp).getTime();
          if (newTime > existingTime) {
            statusMap.set(normalizedMedName, {
              taken: false,
              takenAt: null,
            });
            console.log('[medService] Updated to not taken (more recent)', {
              medName: normalizedMedName,
            });
          }
        } else if (!medTaken && !existing.taken) {
          // Both are not taken - use more recent timestamp (though takenAt will be null)
          const existingTime = existing.takenAt ? new Date(existing.takenAt).getTime() : 0;
          const newTime = medTimestamp ? new Date(medTimestamp).getTime() : new Date(callLog.timestamp).getTime();
          if (newTime > existingTime) {
            statusMap.set(normalizedMedName, {
              taken: false,
              takenAt: null,
            });
          }
        }
      });
    } else {
      console.log('[medService] Call log has non-array meds_taken', {
        meds_taken: callLog.meds_taken,
        timestamp: callLog.timestamp,
      });
    }
  });

  // Return status for each medication
  // Match case-insensitively using normalized names
  // Also try fuzzy matching for partial matches (e.g., "Advil" matches "advil", "Advil 200mg", etc.)
  return medications.map((medName) => {
    const normalizedMedName = medName.trim();
    const normalizedKey = normalizedMedName.toLowerCase();
    
    // Try exact match first
    let status = statusMap.get(normalizedKey);
    
    // If no exact match, try fuzzy matching (check if medication name contains patient med name or vice versa)
    if (!status) {
      for (const [statusKey, statusValue] of statusMap.entries()) {
        // Check if either name contains the other (case-insensitive)
        const patientMedLower = normalizedKey;
        const statusMedLower = statusKey;
        
        if (patientMedLower.includes(statusMedLower) || statusMedLower.includes(patientMedLower)) {
          // Found a match - use it
          status = statusValue;
          console.log(`[medService] Fuzzy matched medication: "${medName}" -> "${statusKey}"`);
          break;
        }
      }
    }
    
    // Log if medication was found or not
    if (status) {
      console.log(`[medService] Medication status found for "${medName}": taken=${status.taken}, takenAt=${status.takenAt}`);
    } else {
      console.log(`[medService] No medication status found for "${medName}" (checked: ${normalizedKey})`);
      console.log(`[medService] Available status keys:`, Array.from(statusMap.keys()));
    }
    
    return {
      medName: normalizedMedName, // Return original case for display
      taken: status?.taken ?? false,
      takenAt: status?.takenAt ?? null,
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
  const supabaseClient = getSupabaseClient();

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
