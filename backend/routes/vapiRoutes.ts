/**
 * VAPI Webhook Routes
 * 
 * Handles call-ended webhooks from VAPI and routes tool calls
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../supabase/client';
import { routeToolCall } from '../vapi/tools';
import { computeMoodFromTranscript } from '../sentiment';
import { getAssistantById } from '../assistants';
import { aggregateDailyCheckIn } from '../daily/aggregator';
import { checkVoiceAnomaly } from '../anomaly/anomalyService';
import type { CallLog } from '../supabase/types';

const router = Router();

/**
 * VAPI webhook payload structure
 */
interface VAPIWebhookPayload {
  call?: {
    id: string;
    status: string;
    customer?: {
      number: string;
    };
    assistantId?: string;
    transcript?: string;
    recordingUrl?: string;
    recording?: {
      url?: string;
    };
    summary?: string;
    toolCalls?: Array<{
      name: string;
      parameters: Record<string, unknown>;
      result?: unknown;
    }>;
  };
  message?: {
    type: string;
    content?: string;
  };
}

/**
 * POST /api/vapi/call-ended
 * Webhook endpoint for VAPI call-ended events
 */
router.post('/call-ended', async (req: Request, res: Response) => {
  try {
    const payload: VAPIWebhookPayload = req.body;
    
    logger.info('Received VAPI webhook', {
      callId: payload.call?.id,
      status: payload.call?.status,
    });
    
    if (!payload.call || payload.call.status !== 'ended') {
      return res.status(200).json({ received: true });
    }
    
    const callId = payload.call.id;
    const customerNumber = payload.call.customer?.number;
    const assistantId = payload.call.assistantId;
    const transcript = payload.call.transcript || '';
    const recordingUrl = payload.call.recordingUrl || payload.call.recording?.url;
    const summary = payload.call.summary || '';
    const toolCalls = payload.call.toolCalls || [];
    
    // Find patient by phone number
    const supabase = getSupabaseClient();
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', customerNumber)
      .single();
    
    if (patientError || !patient) {
      logger.warn('Patient not found for webhook', {
        phone: customerNumber,
        callId,
      });
      return res.status(200).json({ received: true, error: 'Patient not found' });
    }
    
    // Get assistant name
    const assistant = assistantId ? getAssistantById(assistantId) : null;
    const assistantName = assistant?.name || 'Unknown';
    
    // Determine call outcome
    const callAnswered = transcript.length > 0;
    const outcome: CallLog['outcome'] = callAnswered
      ? 'answered'
      : 'no_answer';
    
    // Compute mood from transcript
    const moodResult = computeMoodFromTranscript(transcript, callAnswered);
    
    // Collect data from tool calls
    let medsTaken: Array<{ medName: string; taken: boolean; timestamp: string }> = [];
    let flags: string[] = [];
    let sleepHours: number | null = null;
    let sleepQuality: string | null = null;
    let dailySummary: string | null = null;
    
    const context = {
      patientId: patient.id,
      callId,
      assistantName,
      timestamp: new Date().toISOString(),
    };
    
    // Process tool calls
    for (const toolCall of toolCalls) {
      const result = await routeToolCall(
        {
          name: toolCall.name,
          parameters: toolCall.parameters,
        },
        context
      );
      
      // Extract data from tool results
      if (toolCall.name === 'markMedicationStatus' && result.result) {
        const medStatus = result.result as { medName: string; taken: boolean; timestamp: string };
        medsTaken.push(medStatus);
      }
      
      if (toolCall.name === 'updateFlags' && toolCall.parameters.flags) {
        const newFlags = (toolCall.parameters.flags as unknown[]) || [];
        flags.push(...newFlags.map(f => String(f)));
      }
      
      if (toolCall.name === 'storeDailyCheckIn') {
        if (toolCall.parameters.sleepHours) {
          sleepHours = Number(toolCall.parameters.sleepHours);
        }
        if (toolCall.parameters.sleepQuality) {
          sleepQuality = String(toolCall.parameters.sleepQuality);
        }
        if (toolCall.parameters.summary) {
          dailySummary = String(toolCall.parameters.summary);
        }
      }
    }
    
    // Create or update call log
    const callLogData: Partial<CallLog> = {
      patient_id: patient.id,
      timestamp: context.timestamp,
      assistant_name: assistantName,
      outcome,
      transcript: transcript || null,
      mood: moodResult.mood,
      sentiment_score: moodResult.score,
      summary: summary || dailySummary || null,
      meds_taken: medsTaken,
      flags: flags,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
    };
    
    // Check if call log already exists (from logCallAttempt tool)
    const { data: existingLog } = await supabase
      .from('call_logs')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('timestamp', context.timestamp)
      .single();
    
    let callLogId: string;
    
    if (existingLog) {
      // Update existing log
      const { data: updated, error: updateError } = await supabase
        .from('call_logs')
        .update(callLogData)
        .eq('id', existingLog.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      callLogId = updated.id;
    } else {
      // Create new log
      const { data: newLog, error: insertError } = await supabase
        .from('call_logs')
        .insert(callLogData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      callLogId = newLog.id;
    }
    
    // Update patient's last_call_at
    await supabase
      .from('patients')
      .update({ last_call_at: context.timestamp })
      .eq('id', patient.id);
    
    // If call was answered, aggregate daily check-in
    if (callAnswered) {
      await aggregateDailyCheckIn(patient.id, callLogId, {
        mood: moodResult.mood,
        sleepHours,
        sleepQuality,
        medsTaken,
        flags,
        summary: dailySummary || summary,
      });
    }
    
    // Check for voice anomaly if recording is available
    if (recordingUrl && callAnswered) {
      try {
        const anomalyResult = await checkVoiceAnomaly(
          patient.id,
          callLogId,
          recordingUrl
        );
        
        if (anomalyResult.success && anomalyResult.anomalyScore !== null) {
          // Update call log with anomaly score
          await supabase
            .from('call_logs')
            .update({ anomaly_score: anomalyResult.anomalyScore })
            .eq('id', callLogId);
          
          // Update daily check-in with anomaly data
          if (anomalyResult.anomalyScore > 0.40) {
            const severity = anomalyResult.anomalyScore > 0.70 ? 'critical' :
                           anomalyResult.anomalyScore > 0.55 ? 'high' :
                           anomalyResult.anomalyScore > 0.45 ? 'medium' : 'low';
            
            const today = new Date().toISOString().split('T')[0];
            await supabase
              .from('daily_checkins')
              .update({
                anomaly_score: anomalyResult.anomalyScore,
                anomaly_severity: severity,
              })
              .eq('patient_id', patient.id)
              .eq('date', today);
            
            // Notify caregiver if anomaly is severe
            if (anomalyResult.anomalyScore > 0.70) {
              // Emergency notification
              await routeToolCall(
                {
                  name: 'notifyCaregiver',
                  parameters: {
                    message: `Voice anomaly detected for ${patient.name}. Anomaly score: ${anomalyResult.anomalyScore.toFixed(2)}`,
                    priority: 'emergency',
                  },
                },
                context
              );
            }
          }
        }
      } catch (error: any) {
        logger.error('Error checking voice anomaly', {
          error: error.message,
          patientId: patient.id,
          callId,
        });
        // Don't fail the webhook if anomaly check fails
      }
    }
    
    logger.info('VAPI webhook processed successfully', {
      callId,
      patientId: patient.id,
      outcome,
      mood: moodResult.mood,
    });
    
    res.status(200).json({ received: true, processed: true });
  } catch (error: any) {
    logger.error('Error processing VAPI webhook', {
      error: error.message,
      stack: error.stack,
    });
    // Always return 200 to VAPI to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;

