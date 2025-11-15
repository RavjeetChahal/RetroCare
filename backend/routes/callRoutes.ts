import { Router, Request, Response } from 'express';
import { logger } from '../../utils';
import { getSupabaseClient } from '../supabase/client';
import { makeCallWithRetry } from '../vapi';
import { updatePatient } from '../supabase/patients';
import { createCallLog, listCallLogsForPatient } from '../supabase/callLogs';
import type { Patient } from '../supabase/types';

const router = Router();

/**
 * POST /api/call-now
 * Make an immediate call to a patient
 */
router.post('/call-now', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    // Get patient from database
    const supabase = getSupabaseClient();
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      logger.error('Patient not found', patientError);
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get VAPI configuration
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    if (!phoneNumberId) {
      return res.status(500).json({ error: 'VAPI phone number not configured' });
    }

    // Build call request
    const callRequest = {
      phoneNumberId,
      customer: {
        number: (patient as Patient).phone,
      },
      ...(assistantId && { assistantId }),
      ...(!assistantId && {
        assistantOverrides: {
          voice: {
            provider: 'elevenlabs',
            voiceId: (patient as Patient).voice_choice,
          },
          firstMessage: `Hello ${(patient as Patient).name}, this is RetroCare calling to check in on you.`,
        },
      }),
    };

    // Make call with retry
    const result = await makeCallWithRetry(callRequest);

    // Update patient's last_call_at
    await updatePatient(patientId, {
      last_call_at: new Date().toISOString(),
    });

    if (!result.success) {
      // Set low-priority flag if both attempts failed
      const currentFlags = Array.isArray((patient as Patient).flags)
        ? (patient as Patient).flags
        : [];
      const updatedFlags = Array.from(new Set([...currentFlags, 'low-priority']));

      await updatePatient(patientId, {
        flags: updatedFlags,
      });

      logger.warn('Call failed after retries', { patientId });
    } else {
      // Create call log entry
      await createCallLog({
        patient_id: patientId,
        timestamp: new Date().toISOString(),
        summary: result.callId
          ? `Manual call completed. Call ID: ${result.callId}`
          : 'Manual call completed',
      });
    }

    res.json({
      success: result.success,
      callId: result.callId,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Error in call-now endpoint', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/generate-preview
 * Generate a voice preview using ElevenLabs
 */
router.post('/generate-preview', async (req: Request, res: Response) => {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId || !text) {
      return res.status(400).json({ error: 'voiceId and text are required' });
    }

    const { generateVoicePreview, arrayBufferToBase64 } = await import('../elevenlabs');

    const audioBuffer = await generateVoicePreview(voiceId, text);
    const base64 = arrayBufferToBase64(audioBuffer);

    res.json({
      audio: base64,
      format: 'mp3',
    });
  } catch (error: any) {
    logger.error('Error in generate-preview endpoint', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/call-logs/:patientId
 * Get call logs for a patient
 */
router.get('/call-logs/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const callLogs = await listCallLogsForPatient(patientId);

    res.json({ callLogs });
  } catch (error: any) {
    logger.error('Error in call-logs endpoint', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

