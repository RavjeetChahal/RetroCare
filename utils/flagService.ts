import { getSupabaseClient } from './supabaseClient';

export type FlagType = 'fall' | 'med_missed' | 'other';
export type FlagSeverity = 'red' | 'yellow';

export interface Flag {
  id: string;
  patient_id: string;
  type: FlagType;
  severity: FlagSeverity;
  timestamp: string;
  created_at: string;
}

/**
 * Fetch today's flags for a patient
 */
export async function fetchTodaysFlags(patientId: string): Promise<Flag[]> {
  const supabaseClient = getSupabaseClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabaseClient
    .from('flags')
    .select('*')
    .eq('patient_id', patientId)
    .gte('timestamp', today.toISOString())
    .lt('timestamp', tomorrow.toISOString())
    // Order by urgency: red severity first, then yellow, then by timestamp (most recent first)
    .order('severity', { ascending: true }) // red='red' comes before yellow='yellow' alphabetically, but we want red first
    .order('timestamp', { ascending: false });
  
  if (error) {
    throw error;
  }
  
  // Sort manually: red severity first, then yellow, then by timestamp descending
  const sorted = (data as Flag[] ?? []).sort((a, b) => {
    // First sort by severity: red > yellow
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (a.severity !== 'red' && b.severity === 'red') return 1;
    // Then by timestamp (most recent first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  // Remove duplicates (same type, severity, and timestamp within 1 minute)
  const uniqueFlags: Flag[] = [];
  const seen = new Set<string>();
  
  for (const flag of sorted) {
    const key = `${flag.type}-${flag.severity}-${new Date(flag.timestamp).toISOString().slice(0, 16)}`; // Round to minute
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFlags.push(flag);
    }
  }
  
  return uniqueFlags;
}

/**
 * Get flag display information
 */
export function getFlagDisplay(flag: Flag): { label: string; emoji: string; color: string; bgColor: string } {
  switch (flag.type) {
    case 'fall':
      return {
        label: 'Fall Risk',
        emoji: '⚠️',
        color: '#ef4444', // red
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'med_missed':
      return {
        label: 'Medication Missed',
        emoji: '💊',
        color: '#eab308', // yellow
        bgColor: 'rgba(234, 179, 8, 0.15)',
      };
    default:
      return {
        label: 'Other Flag',
        emoji: '🚩',
        color: flag.severity === 'red' ? '#ef4444' : '#eab308',
        bgColor: flag.severity === 'red' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
      };
  }
}

