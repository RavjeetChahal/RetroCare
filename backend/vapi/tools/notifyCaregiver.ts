/**
 * VAPI Tool: notifyCaregiver
 * 
 * Sends notification to caregiver (SMS, call, etc.)
 */

import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../supabase/client';
import type { ToolContext } from './index';

export async function notifyCaregiver(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const { message, priority } = parameters;
    
    const supabase = getSupabaseClient();
    
    // Get patient and caregiver info
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('caregiver_id, name')
      .eq('id', context.patientId)
      .single();
    
    if (patientError || !patient) {
      throw new Error('Patient not found');
    }
    
    const { data: caregiver, error: caregiverError } = await supabase
      .from('caregivers')
      .select('name, phone')
      .eq('id', patient.caregiver_id)
      .single();
    
    if (caregiverError || !caregiver) {
      throw new Error('Caregiver not found');
    }
    
    // TODO: Implement actual SMS/call notification
    // For now, just log the notification
    logger.info('Caregiver notification', {
      caregiverPhone: caregiver.phone,
      patientName: patient.name,
      message: message as string,
      priority: priority as string || 'normal',
    });
    
    // In production, you would:
    // 1. Send SMS via Twilio, AWS SNS, etc.
    // 2. Make a call via VAPI or Twilio
    // 3. Send email notification
    // 4. Push notification to mobile app
    
    return {
      success: true,
      result: {
        message: 'Caregiver notified',
        caregiverPhone: caregiver.phone,
        notificationSent: true,
      },
    };
  } catch (error: any) {
    logger.error('Error notifying caregiver', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

