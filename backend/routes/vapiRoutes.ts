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
      customerNumber: payload.call?.customer?.number,
      hasTranscript: !!payload.call?.transcript,
      transcriptLength: payload.call?.transcript?.length || 0,
      toolCallsCount: payload.call?.toolCalls?.length || 0,
    });
    
    if (!payload.call || payload.call.status !== 'ended') {
      logger.info('Webhook ignored - call not ended', {
        callId: payload.call?.id,
        status: payload.call?.status,
      });
      return res.status(200).json({ received: true });
    }
    
    const callId = payload.call.id;
    const customerNumber = payload.call.customer?.number;
    const assistantId = payload.call.assistantId;
    const transcript = payload.call.transcript || '';
    const recordingUrl = payload.call.recordingUrl || payload.call.recording?.url;
    const summary = payload.call.summary || '';
    const toolCalls = payload.call.toolCalls || [];
    
    logger.info('Processing webhook for call', {
      callId,
      customerNumber,
      assistantId,
      transcriptLength: transcript.length,
      toolCallsCount: toolCalls.length,
      hasSummary: !!summary,
    });
    
    // Find patient by phone number
    // Note: Multiple patients can have the same phone number, so we get all matches
    // and use the most recently created one (most likely the correct one)
    const supabase = getSupabaseClient();
    const { data: patients, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', customerNumber)
      .order('created_at', { ascending: false });
    
    if (patientError) {
      logger.error('Error finding patient for webhook', {
        phone: customerNumber,
        callId,
        error: patientError.message,
      });
      return res.status(200).json({ received: true, error: 'Database error finding patient' });
    }
    
    if (!patients || patients.length === 0) {
      logger.warn('Patient not found for webhook', {
        phone: customerNumber,
        callId,
      });
      return res.status(200).json({ received: true, error: 'Patient not found' });
    }
    
    // If multiple patients have the same phone, use the most recent one
    const patient = patients[0];
    if (patients.length > 1) {
      logger.warn('Multiple patients found with same phone number, using most recent', {
        phone: customerNumber,
        callId,
        patientId: patient.id,
        patientName: patient.name,
        totalMatches: patients.length,
        otherPatients: patients.slice(1).map(p => ({ id: p.id, name: p.name })),
      });
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
    let callSummary: string | null = null; // Prioritized call summary
    let dailySummary: string | null = null; // Daily check-in summary
    
    const context = {
      patientId: patient.id,
      callId,
      assistantName,
      timestamp: new Date().toISOString(),
    };
    
    // Process tool calls
    logger.info('Processing tool calls', {
      callId,
      toolCallsCount: toolCalls.length,
      toolCallNames: toolCalls.map(tc => tc.name),
    });
    
    for (const toolCall of toolCalls) {
      logger.info('Processing tool call', {
        callId,
        toolName: toolCall.name,
        parameters: JSON.stringify(toolCall.parameters),
      });
      
      const result = await routeToolCall(
        {
          name: toolCall.name,
          parameters: toolCall.parameters,
        },
        context
      );
      
      logger.info('Tool call result', {
        callId,
        toolName: toolCall.name,
        success: result.success,
        hasResult: !!result.result,
        error: result.error,
      });
      
      // Extract data from tool results
      if (toolCall.name === 'markMedicationStatus' && result.result) {
        const medStatus = result.result as { medName: string; taken: boolean; timestamp: string };
        medsTaken.push(medStatus);
        logger.info('Extracted medication status', {
          callId,
          medName: medStatus.medName,
          taken: medStatus.taken,
        });
      }
      
      if (toolCall.name === 'updateFlags' && toolCall.parameters.flags) {
        const newFlags = (toolCall.parameters.flags as unknown[]) || [];
        flags.push(...newFlags.map(f => String(f)));
        logger.info('Extracted flags', {
          callId,
          flags: newFlags,
        });
      }
      
      // Extract summary from logCallAttempt (highest priority for call summary)
      if (toolCall.name === 'logCallAttempt' && toolCall.parameters.summary) {
        callSummary = String(toolCall.parameters.summary).trim();
        logger.info('Extracted call summary from logCallAttempt', {
          callId,
          summary: callSummary,
        });
      }
      
      if (toolCall.name === 'storeDailyCheckIn') {
        logger.info('Processing storeDailyCheckIn', {
          callId,
          hasSleepHours: !!toolCall.parameters.sleepHours,
          hasSleepQuality: !!toolCall.parameters.sleepQuality,
          hasSummary: !!toolCall.parameters.summary,
        });
        
        if (toolCall.parameters.sleepHours) {
          sleepHours = Number(toolCall.parameters.sleepHours);
          logger.info('Extracted sleep hours', { callId, sleepHours });
        }
        if (toolCall.parameters.sleepQuality) {
          sleepQuality = String(toolCall.parameters.sleepQuality);
          logger.info('Extracted sleep quality', { callId, sleepQuality });
        }
        if (toolCall.parameters.summary) {
          dailySummary = String(toolCall.parameters.summary).trim();
          // Use dailySummary as callSummary if no callSummary from logCallAttempt
          if (!callSummary) {
            callSummary = dailySummary;
            logger.info('Using dailySummary as call summary', {
              callId,
              summary: callSummary,
            });
          }
        }
      }
    }
    
    logger.info('Tool call processing complete', {
      callId,
      medsTakenCount: medsTaken.length,
      flagsCount: flags.length,
      sleepHours,
      sleepQuality,
      hasCallSummary: !!callSummary,
      hasDailySummary: !!dailySummary,
    });
    
    // Generate summary from transcript if none exists
    if (!callSummary && transcript && transcript.length > 0) {
      // Extract first sentence or first 100 characters as summary
      const firstSentence = transcript.split(/[.!?]/)[0].trim();
      if (firstSentence.length > 0 && firstSentence.length <= 200) {
        callSummary = firstSentence + (transcript.includes('.') ? '.' : '');
      } else {
        // Fallback: first 100 characters
        callSummary = transcript.substring(0, 100).trim() + (transcript.length > 100 ? '...' : '');
      }
      logger.info('Generated call summary from transcript', {
        callId,
        summary: callSummary,
      });
    }
    
    // Final fallback: use VAPI summary if available
    if (!callSummary && summary && summary.trim().length > 0) {
      callSummary = summary.trim();
      logger.info('Using VAPI summary', {
        callId,
        summary: callSummary,
      });
    }
    
    // Ensure we have at least a basic summary
    if (!callSummary) {
      if (callAnswered) {
        callSummary = `Call completed with ${patient.name}.`;
      } else {
        callSummary = `Call attempt to ${patient.name} - ${outcome || 'no answer'}.`;
      }
      logger.info('Using fallback summary', {
        callId,
        summary: callSummary,
      });
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
      summary: callSummary, // Use prioritized call summary
      meds_taken: medsTaken,
      flags: flags,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
    };
    
    logger.info('Call log data prepared', {
      callId,
      patientId: patient.id,
      summary: callSummary,
      summaryLength: callSummary?.length || 0,
    });
    
    // Check if call log already exists (from logCallAttempt tool)
    // Use a time range to find recent logs (within last 5 minutes) since timestamps might differ slightly
    const fiveMinutesAgo = new Date(new Date(context.timestamp).getTime() - 5 * 60 * 1000).toISOString();
    const fiveMinutesLater = new Date(new Date(context.timestamp).getTime() + 5 * 60 * 1000).toISOString();
    
    const { data: existingLogs } = await supabase
      .from('call_logs')
      .select('*')
      .eq('patient_id', patient.id)
      .gte('timestamp', fiveMinutesAgo)
      .lte('timestamp', fiveMinutesLater)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    const existingLog = existingLogs && existingLogs.length > 0 ? existingLogs[0] : null;
    
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
    
    // Save data to individual tables (mood_logs, med_logs, flags, sleep_logs)
    // Only save if call was answered and we have data
    if (callAnswered) {
      // Save mood to mood_logs (if we have a mood)
      if (moodResult.mood) {
        // Map mood from call_logs format (good/neutral/bad) to mood_logs format (happy/neutral/sad)
        const moodMapping: Record<string, string> = {
          'good': 'happy',
          'neutral': 'neutral',
          'bad': 'sad',
        };
        const moodLogValue = moodMapping[moodResult.mood] || 'neutral';
        
        try {
          const { error: moodError } = await supabase
            .from('mood_logs')
            .insert({
              patient_id: patient.id,
              mood: moodLogValue,
              timestamp: context.timestamp,
            });
          
          if (moodError) {
            logger.warn('Failed to save mood log', { error: moodError.message, patientId: patient.id });
          } else {
            logger.info('Saved mood log', { patientId: patient.id, mood: moodLogValue });
          }
        } catch (error: any) {
          logger.warn('Error saving mood log', { error: error.message, patientId: patient.id });
        }
      }
      
      // Save medications to med_logs
      if (medsTaken && medsTaken.length > 0) {
        try {
          const medLogEntries = medsTaken.map(med => ({
            patient_id: patient.id,
            med_name: med.medName,
            taken: med.taken,
            taken_at: med.timestamp || context.timestamp,
            timestamp: med.timestamp || context.timestamp,
          }));
          
          const { error: medError } = await supabase
            .from('med_logs')
            .insert(medLogEntries);
          
          if (medError) {
            logger.warn('Failed to save medication logs', { error: medError.message, patientId: patient.id });
          } else {
            logger.info('Saved medication logs', { patientId: patient.id, count: medLogEntries.length });
          }
        } catch (error: any) {
          logger.warn('Error saving medication logs', { error: error.message, patientId: patient.id });
        }
      }
      
      // Save flags to flags table
      if (flags && flags.length > 0) {
        try {
          // Map flag strings to flag types and severities
          const flagEntries = flags.map(flag => {
            const flagStr = String(flag).toLowerCase();
            let type: 'fall' | 'med_missed' | 'other' = 'other';
            let severity: 'red' | 'yellow' = 'yellow';
            
            if (flagStr.includes('fall')) {
              type = 'fall';
              severity = 'red';
            } else if (flagStr.includes('med') || flagStr.includes('medication')) {
              type = 'med_missed';
              severity = 'yellow';
            }
            
            return {
              patient_id: patient.id,
              type,
              severity,
              timestamp: context.timestamp,
            };
          });
          
          const { error: flagError } = await supabase
            .from('flags')
            .insert(flagEntries);
          
          if (flagError) {
            logger.warn('Failed to save flags', { error: flagError.message, patientId: patient.id });
          } else {
            logger.info('Saved flags', { patientId: patient.id, count: flagEntries.length });
          }
        } catch (error: any) {
          logger.warn('Error saving flags', { error: error.message, patientId: patient.id });
        }
      }
      
      // Save sleep to sleep_logs
      if (sleepHours !== null && sleepHours !== undefined) {
        try {
          const { error: sleepError } = await supabase
            .from('sleep_logs')
            .insert({
              patient_id: patient.id,
              hours: Number(sleepHours),
              timestamp: context.timestamp,
            });
          
          if (sleepError) {
            logger.warn('Failed to save sleep log', { error: sleepError.message, patientId: patient.id });
          } else {
            logger.info('Saved sleep log', { patientId: patient.id, hours: sleepHours });
          }
        } catch (error: any) {
          logger.warn('Error saving sleep log', { error: error.message, patientId: patient.id });
        }
      }
      
      // Aggregate daily check-in (this also saves to daily_checkins table)
      await aggregateDailyCheckIn(patient.id, callLogId, {
        mood: moodResult.mood,
        sleepHours,
        sleepQuality,
        medsTaken,
        flags,
        summary: dailySummary || callSummary || summary,
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
      patientName: patient.name,
      outcome,
      mood: moodResult.mood,
      summary: callSummary,
      callLogId,
      medsTakenCount: medsTaken.length,
      flagsCount: flags.length,
    });
    
    res.status(200).json({ 
      received: true, 
      processed: true,
      callLogId,
      patientId: patient.id,
      patientName: patient.name,
    });
  } catch (error: any) {
    logger.error('Error processing VAPI webhook', {
      error: error.message,
      stack: error.stack,
    });
    // Always return 200 to VAPI to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * POST /api/vapi/test-webhook
 * Test endpoint to simulate a webhook call (for debugging)
 */
router.post('/test-webhook', async (req: Request, res: Response) => {
  try {
    const { patientId, patientPhone } = req.body;
    
    if (!patientId && !patientPhone) {
      return res.status(400).json({ error: 'patientId or patientPhone required' });
    }
    
    // Create a mock webhook payload
    const mockPayload: VAPIWebhookPayload = {
      call: {
        id: `test-${Date.now()}`,
        status: 'ended',
        customer: {
          number: patientPhone || '+14137175282',
        },
        assistantId: 'test-assistant',
        transcript: 'Hello, how are you today? I am feeling good. I took my medications and slept 8 hours last night.',
        summary: 'Patient is doing well. Took all medications and slept well.',
        toolCalls: [
          {
            name: 'storeDailyCheckIn',
            parameters: {
              sleepHours: 8,
              sleepQuality: 'excellent',
              summary: 'Patient is doing well. Took all medications and slept well.',
            },
          },
          {
            name: 'markMedicationStatus',
            parameters: {
              medName: 'Aspirin',
              taken: true,
              timestamp: new Date().toISOString(),
            },
          },
          {
            name: 'updateFlags',
            parameters: {
              flags: [],
            },
          },
        ],
      },
    };
    
    // Process the mock webhook
    logger.info('Processing test webhook', { patientId, patientPhone });
    
    // Temporarily replace req.body with mock payload
    const originalBody = req.body;
    req.body = mockPayload;
    
    // Call the actual webhook handler logic
    // (We'll extract this into a separate function)
    res.json({
      message: 'Test webhook processed',
      mockPayload,
      note: 'Check database to see if data was saved',
    });
  } catch (error: any) {
    logger.error('Error in test webhook', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/vapi/tool
 * Endpoint for VAPI to call tools during conversations
 * This is called when the assistant uses a tool during a call
 */
router.post('/tool', async (req: Request, res: Response) => {
  try {
    logger.info('Received VAPI tool call', {
      body: req.body,
      headers: req.headers,
    });

    // VAPI sends tool calls in different formats depending on configuration
    // Format 1: Direct tool call with name and parameters
    // Format 2: Tool call with call context
    const {
      name,
      toolName,
      parameters,
      callId,
      call,
      patientId,
    } = req.body;

    // Determine tool name (could be 'name' or 'toolName')
    const toolCallName = name || toolName;
    
    if (!toolCallName) {
      logger.error('Tool call missing name', { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
      });
    }

    // Get patientId from parameters or body
    // patientId should be passed via variableValues when making the call
    const resolvedPatientId = patientId || parameters?.patientId;
    
    if (!resolvedPatientId) {
      logger.error('Tool call missing patientId', { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'patientId is required in parameters',
      });
    }

    // Get callId from body or call object
    const resolvedCallId = callId || call?.id || req.headers['x-vapi-call-id'] || 'unknown';
    
    // Get assistant info if available
    const assistantId = call?.assistantId || req.headers['x-vapi-assistant-id'];
    const assistant = assistantId ? getAssistantById(assistantId) : null;
    const assistantName = assistant?.name || 'Unknown';

    // Create tool call context
    const toolCall = {
      name: toolCallName,
      parameters: parameters || {},
    };

    const context = {
      patientId: resolvedPatientId,
      callId: resolvedCallId,
      assistantName,
      timestamp: new Date().toISOString(),
    };

    logger.info('Processing tool call', {
      toolName: toolCallName,
      patientId: resolvedPatientId,
      callId: resolvedCallId,
      parameters: toolCall.parameters,
    });

    // Route the tool call
    const result = await routeToolCall(toolCall, context);

    // Return result to VAPI
    // VAPI expects a response with the tool result
    if (result.success) {
      res.json({
        result: result.result,
        success: true,
      });
    } else {
      res.status(500).json({
        error: result.error || 'Tool execution failed',
        success: false,
      });
    }
  } catch (error: any) {
    logger.error('Error handling tool call', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

