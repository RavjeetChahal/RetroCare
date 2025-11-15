/**
 * VAPI Tool: updateFlags
 * 
 * Updates health flags for a patient
 */

import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../supabase/client';
import type { ToolContext } from './index';

export async function updateFlags(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const { flags } = parameters;
    
    if (!Array.isArray(flags)) {
      return { success: false, error: 'Flags must be an array' };
    }
    
    const supabase = getSupabaseClient();
    
    // Insert each flag into health_flags table
    const flagInserts = flags.map((flag: unknown) => ({
      patient_id: context.patientId,
      flag: String(flag),
      source: 'assistant' as const,
      timestamp: context.timestamp,
    }));
    
    if (flagInserts.length > 0) {
      const { error } = await supabase
        .from('health_flags')
        .insert(flagInserts);
      
      if (error) throw error;
    }
    
    // Also update patient's flags array (for backward compatibility)
    const { data: patient } = await supabase
      .from('patients')
      .select('flags')
      .eq('id', context.patientId)
      .single();
    
    if (patient) {
      const currentFlags = Array.isArray(patient.flags) ? patient.flags : [];
      const newFlags = Array.from(new Set([...currentFlags, ...flags]));
      
      await supabase
        .from('patients')
        .update({ flags: newFlags })
        .eq('id', context.patientId);
    }
    
    logger.info('Updated flags', {
      patientId: context.patientId,
      flags: flags.length,
    });
    
    return { success: true, result: { flagsUpdated: flags.length } };
  } catch (error: any) {
    logger.error('Error updating flags', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

