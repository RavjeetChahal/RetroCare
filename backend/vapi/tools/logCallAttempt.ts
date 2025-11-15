/**
 * VAPI Tool: logCallAttempt
 * 
 * Logs a call attempt (answered, no answer, etc.)
 */

import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../supabase/client';
import type { ToolContext } from './index';
import type { CallLog } from '../../supabase/types';

export async function logCallAttempt(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const { outcome, transcript, summary } = parameters;
    
    const supabase = getSupabaseClient();
    
    // Find or create call log entry
    const { data: existingLog } = await supabase
      .from('call_logs')
      .select('*')
      .eq('patient_id', context.patientId)
      .eq('timestamp', context.timestamp)
      .single();
    
    const callLogData: Partial<CallLog> = {
      patient_id: context.patientId,
      timestamp: context.timestamp,
      assistant_name: context.assistantName,
      outcome: (outcome as CallLog['outcome']) || 'answered',
      transcript: transcript as string || null,
      summary: summary as string || null,
    };
    
    if (existingLog) {
      // Update existing log
      const { error } = await supabase
        .from('call_logs')
        .update(callLogData)
        .eq('id', existingLog.id);
      
      if (error) throw error;
    } else {
      // Create new log
      const { error } = await supabase
        .from('call_logs')
        .insert(callLogData);
      
      if (error) throw error;
    }
    
    logger.info('Call attempt logged', {
      patientId: context.patientId,
      outcome,
      callId: context.callId,
    });
    
    return { success: true, result: { message: 'Call attempt logged' } };
  } catch (error: any) {
    logger.error('Error logging call attempt', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

