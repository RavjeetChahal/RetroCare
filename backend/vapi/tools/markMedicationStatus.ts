/**
 * VAPI Tool: markMedicationStatus
 * 
 * Records medication adherence status
 */

import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../supabase/client';
import type { ToolContext } from './index';

export async function markMedicationStatus(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const { medName, taken, timestamp } = parameters;
    
    if (!medName || typeof taken !== 'boolean') {
      return { success: false, error: 'medName and taken (boolean) are required' };
    }
    
    const medStatus = {
      medName: String(medName),
      taken: Boolean(taken),
      timestamp: timestamp ? String(timestamp) : context.timestamp,
    };
    
    // This will be merged into call_logs.meds_taken by the webhook handler
    // We return the status for the webhook to process
    
    logger.info('Medication status marked', {
      patientId: context.patientId,
      medName,
      taken,
    });
    
    return { success: true, result: medStatus };
  } catch (error: any) {
    logger.error('Error marking medication status', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

