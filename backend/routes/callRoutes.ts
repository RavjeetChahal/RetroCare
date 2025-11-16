import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../supabase/client';
import { makeCallWithRetry, getAssistant } from '../vapi';
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
    const defaultAssistantId = process.env.VAPI_ASSISTANT_ID;
    
    // Use patient's voice_choice as assistantId (now stores VAPI assistant ID)
    const patientAssistantId = (patient as Patient).voice_choice || defaultAssistantId;

    if (!phoneNumberId) {
      return res.status(500).json({ error: 'VAPI phone number not configured' });
    }

    // Prepare patient context for assistant
    const patientMeds = Array.isArray((patient as Patient).meds) 
      ? (patient as Patient).meds.map((m: any) => typeof m === 'string' ? m : m.name || m.medName || String(m)).filter(Boolean)
      : [];
    const patientConditions = Array.isArray((patient as Patient).conditions)
      ? (patient as Patient).conditions.map((c: any) => typeof c === 'string' ? c : c.name || String(c)).filter(Boolean)
      : [];
    
    // Build call request - use patient's selected assistant with context
    const callRequest = {
      phoneNumberId,
      customer: {
        number: (patient as Patient).phone,
      },
      ...(patientAssistantId && { 
        assistantId: patientAssistantId,
        assistantOverrides: {
          variableValues: {
            patientName: (patient as Patient).name,
            patientAge: String((patient as Patient).age || ''),
            medications: patientMeds.join(', '),
            medicationsList: JSON.stringify(patientMeds),
            conditions: patientConditions.join(', '),
            conditionsList: JSON.stringify(patientConditions),
            patientId: patientId,
          },
        },
      }),
      ...(!patientAssistantId && {
        assistantOverrides: {
          voice: {
            provider: 'elevenlabs',
            voiceId: (patient as Patient).voice_choice, // Fallback to voice ID if assistant ID not available
          },
          firstMessage: `Hello ${(patient as Patient).name}, this is RetroCare calling to check in on you.`,
          variableValues: {
            patientName: (patient as Patient).name,
            patientAge: String((patient as Patient).age || ''),
            medications: patientMeds.join(', '),
            medicationsList: JSON.stringify(patientMeds),
            conditions: patientConditions.join(', '),
            conditionsList: JSON.stringify(patientConditions),
            patientId: patientId,
          },
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
      const callLog = await createCallLog({
        patient_id: patientId,
        timestamp: new Date().toISOString(),
        summary: result.callId
          ? `Manual call completed. Call ID: ${result.callId}`
          : 'Manual call completed',
      });

      // Check for voice anomaly if audio recording is available
      if (result.callId) {
        try {
          const { getCallStatus } = await import('../vapi');
          const callStatus = await getCallStatus(result.callId);
          
          // VAPI may provide recording URL in transcript or recording fields
          // Check common field names for audio recording URL
          const audioUrl = 
            (callStatus as any).recordingUrl ||
            (callStatus as any).recording?.url ||
            (callStatus as any).transcript?.audioUrl ||
            null;
          
          if (audioUrl) {
            // Trigger anomaly check asynchronously (don't block response)
            const { checkVoiceAnomaly } = await import('../anomaly/anomalyService');
            checkVoiceAnomaly(patientId, callLog.id, audioUrl)
              .then((anomalyResult) => {
                if (anomalyResult.success && anomalyResult.alertType) {
                  logger.info('Voice anomaly detected', {
                    patientId,
                    score: anomalyResult.anomalyScore,
                    alertType: anomalyResult.alertType,
                  });
                }
              })
              .catch((err) => {
                logger.error('Anomaly check failed (non-blocking)', {
                  patientId,
                  error: err.message,
                });
              });
          } else {
            logger.debug('No audio recording URL available for anomaly check', {
              patientId,
              callId: result.callId,
            });
          }
        } catch (error: any) {
          logger.warn('Could not check anomaly - VAPI status unavailable', {
            patientId,
            error: error.message,
          });
        }
      }
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
 * Generate a voice preview using VAPI assistant (fetches voice config from VAPI, then uses ElevenLabs)
 */
router.post('/generate-preview', async (req: Request, res: Response) => {
  try {
    const { assistantId, text } = req.body;

    if (!assistantId || !text) {
      return res.status(400).json({ error: 'assistantId and text are required' });
    }

    // Get the ElevenLabs voice ID for this assistant
    // These are the actual voice IDs from your ElevenLabs account
    const { getPreviewVoiceId } = await import('../utils/voiceMapping');
    const previewVoiceId = getPreviewVoiceId(assistantId);
    
    logger.info('Using preview voice', { 
      assistantId,
      previewVoiceId,
      note: 'Using actual ElevenLabs voice ID for preview'
    });

    // Use ElevenLabs to generate the preview with the actual voice ID
    const { generateVoicePreview, arrayBufferToBase64 } = await import('../elevenlabs');

    const audioBuffer = await generateVoicePreview(previewVoiceId, text);
    const base64 = arrayBufferToBase64(audioBuffer);

    res.json({
      audio: base64,
      format: 'mp3',
    });
  } catch (error: any) {
    logger.error('Error in generate-preview endpoint', {
      message: error.message,
      assistantId: req.body.assistantId,
      error: error.response?.data || error.message,
    });
    
    // Provide user-friendly error messages
    // Check for missing API key first (before other errors)
    if (error.message?.includes('ELEVENLABS_API_KEY') && error.message?.includes('not set')) {
      return res.status(500).json({ 
        error: 'Voice preview service is not configured. Please check backend/.env file.' 
      });
    }
    
    // Pass through quota and permission errors with full details
    if (error.message?.includes('quota') || error.message?.includes('permission')) {
      return res.status(500).json({ 
        error: error.message 
      });
    }
    
    // Pass through 401 authentication errors with details
    if (error.response?.status === 401 || error.message?.includes('authentication failed')) {
      return res.status(500).json({ 
        error: error.message || 'ElevenLabs API authentication failed. Please check your API key in backend/.env' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to generate voice preview' 
    });
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

/**
 * GET /api/sync-voice-ids
 * Fetch voice IDs from VAPI assistants and return the mapping
 */
router.get('/sync-voice-ids', async (req: Request, res: Response) => {
  try {
    const ASSISTANT_IDS = {
      Kenji: 'b127b52b-bdb5-4c88-b55d-b3b2e62051ab',
      Priya: 'd480cd37-26ca-4fb9-a146-c64b547e3de1',
      Lucy: '67bdddf5-1556-4417-82f9-580593b80153',
      Clyde: '6662cc0e-d6c6-45ec-a580-fe4465b80aeb',
      Julia: '6f576490-1309-4a49-8764-6cabb1264b74',
    };

    const voiceMap: Record<string, string> = {};
    const results: Array<{ name: string; assistantId: string; voiceId?: string; error?: string }> = [];

    for (const [name, assistantId] of Object.entries(ASSISTANT_IDS)) {
      try {
        const assistant = await getAssistant(assistantId);
        
        if (assistant.voice?.provider === 'elevenlabs' && assistant.voice?.voiceId) {
          voiceMap[assistantId] = assistant.voice.voiceId;
          results.push({
            name,
            assistantId,
            voiceId: assistant.voice.voiceId,
          });
        } else {
          results.push({
            name,
            assistantId,
            error: 'No ElevenLabs voice found in assistant',
          });
        }
      } catch (error: any) {
        results.push({
          name,
          assistantId,
          error: error.message,
        });
      }
    }

    res.json({
      voiceMap,
      results,
    });
  } catch (error: any) {
    logger.error('Error in sync-voice-ids endpoint', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

