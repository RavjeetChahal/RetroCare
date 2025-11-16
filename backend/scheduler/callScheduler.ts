import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../supabase/client';
import { makeCallWithRetry } from '../vapi';
import { updatePatient } from '../supabase/patients';
import { createCallLog } from '../supabase/callLogs';
import type { Patient } from '../supabase/types';
import { shouldCallNow } from './timeUtils';
import { getAssistantByName, getAssistantId } from '../assistants';

// Time utilities moved to timeUtils.ts

/**
 * Get all patients that need calls right now
 */
async function getPatientsDueForCalls(): Promise<Patient[]> {
  const supabase = getSupabaseClient();
  const { data: patients, error } = await supabase
    .from('patients')
    .select('*')
    .not('call_schedule', 'eq', '[]');

  if (error) {
    logger.error('Failed to fetch patients for scheduling', error);
    return [];
  }

  const now = new Date();
  const duePatients: Patient[] = [];

  for (const patient of (patients as Patient[]) || []) {
    if (!patient.call_schedule || !Array.isArray(patient.call_schedule)) {
      continue;
    }

    // Check if current hour matches schedule (hourly scheduling)
    if (shouldCallNow(patient.call_schedule, patient.timezone)) {
      // Check if we already called in this hour
      const lastCallAt = patient.last_call_at
        ? new Date(patient.last_call_at)
        : null;
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Only call if we haven't called in the last hour
      if (!lastCallAt || lastCallAt < oneHourAgo) {
        duePatients.push(patient);
      }
    }
  }

  return duePatients;
}

/**
 * Make a call to a patient and handle the result
 */
async function makeScheduledCall(patient: Patient): Promise<void> {
  logger.info('Making scheduled call', { patientId: patient.id, patientName: patient.name });

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const webhookUrl = process.env.VAPI_WEBHOOK_URL || `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/vapi/call-ended`;
  
  // Get assistant ID from assigned_assistant name or fallback to voice_choice
  let assistantId: string | undefined;
  let assistant = null;
  
  if (patient.assigned_assistant) {
    assistant = getAssistantByName(patient.assigned_assistant);
    assistantId = assistant?.assistantId;
  } else if (patient.voice_choice) {
    // Fallback: voice_choice should be assistant ID
    assistant = getAssistantById(patient.voice_choice);
    assistantId = patient.voice_choice;
  } else {
    assistantId = process.env.VAPI_ASSISTANT_ID;
  }

  if (!phoneNumberId) {
    logger.error('VAPI_PHONE_NUMBER_ID not configured');
    return;
  }

  try {
    if (!assistantId) {
      logger.error('No assistant ID available for patient', { patientId: patient.id });
      return;
    }
    
    // Prepare patient context for assistant
    const patientMeds = Array.isArray(patient.meds) 
      ? patient.meds.map((m: any) => typeof m === 'string' ? m : m.name || m.medName || String(m)).filter(Boolean)
      : [];
    const patientConditions = Array.isArray(patient.conditions)
      ? patient.conditions.map((c: any) => typeof c === 'string' ? c : c.name || String(c)).filter(Boolean)
      : [];
    
    // Build call request with webhook for call-ended events
    const callRequest = {
      phoneNumberId,
      assistantId,
      customer: {
        number: patient.phone,
      },
      webhook: {
        url: webhookUrl,
      },
      assistantOverrides: {
        variableValues: {
          patientName: patient.name,
          patientAge: String(patient.age || ''),
          medications: patientMeds.join(', '),
          medicationsList: JSON.stringify(patientMeds),
          conditions: patientConditions.join(', '),
          conditionsList: JSON.stringify(patientConditions),
          patientId: patient.id,
        },
      },
    };

    // Make call with retry (2 attempts, 5 minutes apart)
    const result = await makeCallWithRetry(callRequest, 5 * 60 * 1000);

    // Update patient's last_call_at
    await updatePatient(patient.id, {
      last_call_at: new Date().toISOString(),
    });

    if (!result.success) {
      // Both attempts failed - log and notify caregiver
      logger.warn('Call failed after retries', {
        patientId: patient.id,
        error: result.error,
      });
      
      // Use logCallAttempt tool to record the failure
      const { routeToolCall } = await import('../vapi/tools');
      await routeToolCall(
        {
          name: 'logCallAttempt',
          parameters: {
            outcome: 'no_answer',
            summary: `Call failed after 2 attempts: ${result.error}`,
          },
        },
        {
          patientId: patient.id,
          callId: result.callId || 'unknown',
          assistantName: assistant?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        }
      );
      
      // Update flags
      const { routeToolCall: routeTool } = await import('../vapi/tools');
      await routeTool(
        {
          name: 'updateFlags',
          parameters: {
            flags: ['did_not_answer_twice'],
          },
        },
        {
          patientId: patient.id,
          callId: result.callId || 'unknown',
          assistantName: assistant?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        }
      );
      
      // Notify caregiver with low priority
      await routeTool(
        {
          name: 'notifyCaregiver',
          parameters: {
            message: `${patient.name} did not answer the scheduled call after 2 attempts.`,
            priority: 'low',
          },
        },
        {
          patientId: patient.id,
          callId: result.callId || 'unknown',
          assistantName: assistant?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        }
      );
    } else {
      // Call succeeded - webhook will handle the rest
      logger.info('Scheduled call initiated successfully', {
        patientId: patient.id,
        callId: result.callId,
      });
    }
  } catch (error: any) {
    logger.error('Error making scheduled call', {
      patientId: patient.id,
      error: error.message,
    });
  }
}

/**
 * Run the scheduled call check
 */
export async function runScheduledCalls(): Promise<void> {
  logger.info('Running scheduled call check...');

  try {
    const duePatients = await getPatientsDueForCalls();
    logger.info(`Found ${duePatients.length} patients due for calls`);

    // Make calls in parallel (with reasonable concurrency)
    const callPromises = duePatients.map((patient) => makeScheduledCall(patient));
    await Promise.allSettled(callPromises);

    logger.info('Scheduled call check completed');
  } catch (error: any) {
    logger.error('Error in scheduled call check', error);
  }
}

/**
 * Start the cron scheduler
 * Runs every hour at the top of the hour (e.g., 09:00, 10:00, 11:00)
 */
export function startScheduler(): void {
  // Run every hour at minute 0 (e.g., 09:00, 10:00, 11:00)
  cron.schedule('0 * * * *', async () => {
    await runScheduledCalls();
  });

  logger.info('Call scheduler started (runs every hour at :00)');
}

