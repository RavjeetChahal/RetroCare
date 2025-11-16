/**
 * VAPI Tool: markMedicationStatus
 * 
 * Records medication adherence status
 * CRITICAL: This tool now DIRECTLY saves to med_logs table
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
      logger.error('❌ [MARK_MED] Missing required parameters', {
        patientId: context.patientId,
        hasMedName: !!medName,
        hasTaken: typeof taken === 'boolean',
        parameters,
      });
      return { success: false, error: 'medName and taken (boolean) are required' };
    }
    
    const medNameStr = String(medName).trim();
    const takenBool = Boolean(taken);
    const timestampStr = timestamp ? String(timestamp) : context.timestamp;
    
    const medStatus = {
      medName: medNameStr,
      taken: takenBool,
      timestamp: timestampStr,
    };
    
    logger.info('💊 [MARK_MED] Medication status received', {
      patientId: context.patientId,
      callId: context.callId,
      medName: medNameStr,
      taken: takenBool,
      timestamp: timestampStr,
    });
    
    // CRITICAL FIX: Save directly to med_logs table
    // This ensures medications are tracked even if webhook processing fails
    const supabase = getSupabaseClient();
    
    // Check if log already exists for today
    const today = new Date(timestampStr);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: existing, error: selectError } = await supabase
      .from('med_logs')
      .select('id')
      .eq('patient_id', context.patientId)
      .eq('med_name', medNameStr)
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .maybeSingle();
    
    if (selectError) {
      logger.error('❌ [MARK_MED] Error checking for existing med log', {
        patientId: context.patientId,
        medName: medNameStr,
        error: selectError.message,
      });
    }
    
    const medLogEntry = {
      patient_id: context.patientId,
      med_name: medNameStr,
      taken: takenBool,
      taken_at: takenBool ? timestampStr : null,
      timestamp: timestampStr,
    };
    
    if (existing) {
      // Update existing log
      const { data: updated, error: updateError } = await supabase
        .from('med_logs')
        .update(medLogEntry)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (updateError) {
        logger.error('❌ [MARK_MED] Failed to update medication log', {
          patientId: context.patientId,
          callId: context.callId,
          medName: medNameStr,
          error: updateError.message,
          errorCode: updateError.code,
        });
        return { success: false, error: updateError.message };
      } else {
        logger.info('✅ [MARK_MED] Updated medication log in database', {
          patientId: context.patientId,
          callId: context.callId,
          medName: medNameStr,
          taken: takenBool,
          medLogId: updated.id,
        });
      }
    } else {
      // Insert new log
      const { data: inserted, error: insertError } = await supabase
        .from('med_logs')
        .insert(medLogEntry)
        .select()
        .single();
      
      if (insertError) {
        logger.error('❌ [MARK_MED] Failed to insert medication log', {
          patientId: context.patientId,
          callId: context.callId,
          medName: medNameStr,
          error: insertError.message,
          errorCode: insertError.code,
          errorDetails: insertError.details,
          entry: JSON.stringify(medLogEntry, null, 2),
        });
        return { success: false, error: insertError.message };
      } else {
        logger.info('✅ [MARK_MED] Inserted medication log into database', {
          patientId: context.patientId,
          callId: context.callId,
          medName: medNameStr,
          taken: takenBool,
          medLogId: inserted.id,
        });
      }
    }
    
    // Return the status for the webhook to also process (for call_logs.meds_taken)
    return { success: true, result: medStatus };
  } catch (error: any) {
    logger.error('❌ [MARK_MED] Exception in markMedicationStatus', {
      error: error.message,
      stack: error.stack,
      patientId: context.patientId,
      callId: context.callId,
    });
    return { success: false, error: error.message };
  }
}

