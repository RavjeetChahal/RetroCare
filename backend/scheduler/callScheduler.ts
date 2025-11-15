import * as cron from 'node-cron';
import { logger } from '../../utils';
import { getSupabaseClient } from '../supabase/client';
import { makeCallWithRetry } from '../vapi';
import { updatePatient } from '../supabase/patients';
import { createCallLog } from '../supabase/callLogs';
import type { Patient } from '../supabase/types';

/**
 * Parse time slot (e.g., "09:00" or "09:00-10:00") and return hour and minute
 */
function parseTimeSlot(timeSlot: string): { hour: number; minute: number } | null {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

/**
 * Check if a time slot matches the current time (within a 1-minute window)
 */
function isTimeSlotNow(timeSlot: string, timezone: string): boolean {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return false;

  const now = new Date();
  const tzTime = new Date(
    now.toLocaleString('en-US', {
      timeZone: timezone,
    }),
  );

  return (
    tzTime.getHours() === parsed.hour &&
    tzTime.getMinutes() === parsed.minute
  );
}

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

    // Check if any time slot matches now
    for (const timeSlot of patient.call_schedule) {
      if (isTimeSlotNow(timeSlot, patient.timezone)) {
        // Check if we already called today
        const lastCallAt = patient.last_call_at
          ? new Date(patient.last_call_at)
          : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!lastCallAt || lastCallAt < today) {
          duePatients.push(patient);
          break;
        }
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

  // TODO: Configure VAPI phone number ID and assistant ID from environment
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!phoneNumberId) {
    logger.error('VAPI_PHONE_NUMBER_ID not configured');
    return;
  }

  try {
    // Build call request
    const callRequest = {
      phoneNumberId,
      customer: {
        number: patient.phone,
      },
      ...(assistantId && { assistantId }),
      ...(!assistantId && {
        assistantOverrides: {
          voice: {
            provider: 'elevenlabs',
            voiceId: patient.voice_choice,
          },
          firstMessage: `Hello ${patient.name}, this is RetroCare calling to check in on you.`,
        },
      }),
    };

    // Make call with retry
    const result = await makeCallWithRetry(callRequest);

    // Update patient's last_call_at
    await updatePatient(patient.id, {
      last_call_at: new Date().toISOString(),
    });

    if (!result.success) {
      // Set low-priority flag if both attempts failed
      const currentFlags = Array.isArray(patient.flags) ? patient.flags : [];
      const updatedFlags = Array.from(
        new Set([...currentFlags, 'low-priority']),
      );

      await updatePatient(patient.id, {
        flags: updatedFlags,
      });

      logger.warn('Call failed after retries, set low-priority flag', {
        patientId: patient.id,
      });
    } else {
      // Create call log entry
      await createCallLog({
        patient_id: patient.id,
        timestamp: new Date().toISOString(),
        summary: result.callId
          ? `Call completed successfully. Call ID: ${result.callId}`
          : 'Call completed',
      });

      logger.info('Scheduled call completed', {
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
 */
export function startScheduler(): void {
  // Run every minute to check for scheduled calls
  cron.schedule('* * * * *', async () => {
    await runScheduledCalls();
  });

  logger.info('Call scheduler started (runs every minute)');
}

