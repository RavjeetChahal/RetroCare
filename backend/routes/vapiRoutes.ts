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

type RawToolCallPayload = {
  id?: string;
  name?: string;
  toolName?: string;
  parameters?: unknown;
  args?: unknown;
  result?: unknown;
  function?: {
    name?: string;
    arguments?: unknown;
    result?: unknown;
  };
};

type NormalizedToolCallPayload = {
  id?: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
};

function coalesce<T>(...values: Array<T | null | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function parseToolArguments(args: unknown): Record<string, unknown> {
  if (!args) {
    return {};
  }

  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error: any) {
      logger.warn('⚠️ [TOOL PAYLOAD] Failed to parse tool arguments JSON string', {
        error: error.message,
        rawArgs: args,
      });
    }
    return {};
  }

  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }

  return {};
}

function normalizeToolCallPayload(raw: RawToolCallPayload, index: number): NormalizedToolCallPayload | null {
  if (!raw) {
    return null;
  }

  const name = raw.name || raw.toolName || raw.function?.name;
  if (!name) {
    logger.warn('⚠️ [TOOL PAYLOAD] Tool call missing name', { index, raw });
    return null;
  }

  const parameters = parseToolArguments(
    coalesce(raw.parameters, raw.args, raw.function?.arguments)
  );

  const result = coalesce(raw.result, raw.function?.result);

  return {
    id: raw.id,
    name,
    parameters,
    result,
  };
}

function normalizeToolCallList(rawCalls?: unknown): NormalizedToolCallPayload[] {
  if (!Array.isArray(rawCalls)) {
    return [];
  }

  const normalized: NormalizedToolCallPayload[] = [];
  rawCalls.forEach((raw, index) => {
    const normalizedCall = normalizeToolCallPayload(raw as RawToolCallPayload, index);
    if (normalizedCall) {
      normalized.push(normalizedCall);
    }
  });
  return normalized;
}

function extractToolCallsFromPayload(payload: any, callData?: any): NormalizedToolCallPayload[] {
  const toolCallSources = [
    callData?.toolCalls,
    payload?.toolCalls,
    payload?.message?.toolCalls,
    payload?.message?.toolCallList,
    payload?.message?.toolWithToolCallList?.map((entry: any) => entry?.toolCall).filter(Boolean),
  ];

  const aggregated: NormalizedToolCallPayload[] = [];
  toolCallSources.forEach((source) => {
    const normalized = normalizeToolCallList(source);
    aggregated.push(...normalized);
  });

  const seen = new Set<string>();
  const deduped: NormalizedToolCallPayload[] = [];

  aggregated.forEach((toolCall) => {
    const key = toolCall.id || `${toolCall.name}-${deduped.length}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(toolCall);
  });

  return deduped;
}

function extractCallPayload(payload: any): any | undefined {
  const possibleCalls = [
    payload?.call,
    payload?.message?.call,
    payload?.message?.callData,
    payload?.message?.call_report,
    payload?.message?.callReport,
    payload?.message?.callEndedReport,
    payload?.message?.call_ended,
  ];

  return possibleCalls.find((c) => c);
}

function headerValueToString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolvePatientIdFromSources(...sources: Array<Record<string, unknown> | undefined>): string | undefined {
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const data = source as Record<string, unknown> & { [key: string]: unknown };
    const candidate = coalesce(
      data.patientId as string | undefined,
      data.patient_id as string | undefined,
      data.patientID as string | undefined,
      (data.patient as { id?: string } | undefined)?.id,
    );
    if (candidate) {
      return String(candidate);
    }
  }
  return undefined;
}

/**
 * POST /api/vapi/call-ended
 * Webhook endpoint for VAPI call-ended events
 */
router.post('/call-ended', async (req: Request, res: Response) => {
  const webhookStartTime = Date.now();
  try {
    const payload: VAPIWebhookPayload = req.body;
    const messagePayload = (req.body && (req.body as any).message) || payload.message || {};
    const callData = extractCallPayload(req.body);
    const normalizedToolCalls = extractToolCallsFromPayload(req.body, callData);
    
    const callStatus = callData?.status;
    const normalizedStatus = callStatus ? String(callStatus).toLowerCase() : undefined;
    const messageType = messagePayload?.type ? String(messagePayload.type).toLowerCase() : undefined;
    const isEndedStatus = !normalizedStatus || ['ended', 'completed', 'finished'].includes(normalizedStatus);
    const isCallEvent = messageType ? messageType.includes('call') : false;
    
    logger.info('📞 [WEBHOOK] Received VAPI call-ended webhook', {
      timestamp: new Date().toISOString(),
      callId: callData?.id,
      status: callData?.status,
      customerNumber: callData?.customer?.number || messagePayload?.customer?.number || messagePayload?.phoneNumber?.number,
      assistantId: callData?.assistantId || messagePayload?.assistantId || messagePayload?.assistant?.id,
      hasTranscript: !!callData?.transcript,
      transcriptLength: callData?.transcript?.length || 0,
      toolCallsCount: normalizedToolCalls.length,
      hasSummary: !!callData?.summary,
      summaryLength: callData?.summary?.length || 0,
      hasRecordingUrl: !!(callData?.recordingUrl || callData?.recording?.url),
      payloadKeys: Object.keys(payload || {}),
      callKeys: callData ? Object.keys(callData) : [],
    });
    
    if (!callData) {
      logger.info('⚠️ [WEBHOOK] Webhook ignored - call payload missing', {
        hasCall: false,
        payloadKeys: Object.keys(payload || {}),
        messageKeys: Object.keys(messagePayload || {}),
      });
      return res.status(200).json({ received: true, error: 'Missing call payload' });
    }
    
    if (!isEndedStatus && !isCallEvent) {
      logger.info('⚠️ [WEBHOOK] Webhook ignored - call not ended yet', {
        callId: callData?.id,
        status: callData?.status,
        messageType,
      });
      return res.status(200).json({ received: true, note: 'Call not marked as ended yet' });
    }
    
    const callId = callData.id || messagePayload?.callId || (req.headers['x-vapi-call-id'] as string) || 'unknown';
    const customerNumber = callData.customer?.number || messagePayload?.customer?.number || messagePayload?.phoneNumber?.number;
    const assistantId = callData.assistantId || messagePayload?.assistantId || messagePayload?.assistant?.id;
    const transcript = callData.transcript || '';
    const recordingUrl = callData.recordingUrl || callData.recording?.url;
    const summary = callData.summary || '';
    const toolCalls = normalizedToolCalls;
    
    logger.info('📞 [WEBHOOK] Processing call-ended webhook', {
      callId,
      customerNumber,
      assistantId,
      transcriptLength: transcript.length,
      transcriptPreview: transcript.substring(0, 200),
      toolCallsCount: toolCalls.length,
      toolCallNames: toolCalls.map(tc => tc.name),
      hasSummary: !!summary,
      summaryPreview: summary.substring(0, 200),
      hasRecordingUrl: !!recordingUrl,
    });
    
    // Find patient by phone number
    // Note: Multiple patients can have the same phone number, so we get all matches
    // and use the most recently created one (most likely the correct one)
    logger.info('🔍 [WEBHOOK] Looking up patient by phone number', {
      callId,
      customerNumber,
    });
    
    const supabase = getSupabaseClient();
    const { data: patients, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', customerNumber)
      .order('created_at', { ascending: false });
    
    logger.info('🔍 [WEBHOOK] Patient lookup result', {
      callId,
      customerNumber,
      patientCount: patients?.length || 0,
      hasError: !!patientError,
      error: patientError?.message,
      patientIds: patients?.map(p => p.id) || [],
      patientNames: patients?.map(p => p.name) || [],
    });
    
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
    logger.info('🔧 [WEBHOOK] Processing tool calls from webhook', {
      callId,
      patientId: patient.id,
      patientName: patient.name,
      toolCallsCount: toolCalls.length,
      toolCallNames: toolCalls.map(tc => tc.name),
      toolCallsDetails: toolCalls.map(tc => ({
        name: tc.name,
        parameterKeys: Object.keys(tc.parameters || {}),
        hasResult: !!tc.result,
      })),
    });
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const toolCallStartTime = Date.now();
      
      logger.info(`🔧 [WEBHOOK] Processing tool call ${i + 1}/${toolCalls.length}`, {
        callId,
        patientId: patient.id,
        toolName: toolCall.name,
        parameters: JSON.stringify(toolCall.parameters, null, 2),
        parameterCount: Object.keys(toolCall.parameters || {}).length,
        hasExistingResult: !!toolCall.result,
        existingResult: toolCall.result ? JSON.stringify(toolCall.result).substring(0, 200) : null,
      });
      
      const result = await routeToolCall(
        {
          name: toolCall.name,
          parameters: toolCall.parameters,
        },
        context
      );
      
      const toolCallDuration = Date.now() - toolCallStartTime;
      
      logger.info(`🔧 [WEBHOOK] Tool call ${i + 1}/${toolCalls.length} completed`, {
        callId,
        patientId: patient.id,
        toolName: toolCall.name,
        success: result.success,
        hasResult: !!result.result,
        resultPreview: result.result ? JSON.stringify(result.result).substring(0, 200) : null,
        error: result.error,
        durationMs: toolCallDuration,
      });
      
      // Extract data from tool results
      if (toolCall.name === 'markMedicationStatus' && result.result) {
        const medStatus = result.result as { medName: string; taken: boolean; timestamp: string };
        medsTaken.push(medStatus);
        logger.info('💊 [WEBHOOK] Extracted medication status from tool call', {
          callId,
          patientId: patient.id,
          medName: medStatus.medName,
          taken: medStatus.taken,
          timestamp: medStatus.timestamp,
          totalMedsCollected: medsTaken.length,
        });
      }
      
      if (toolCall.name === 'updateFlags' && toolCall.parameters.flags) {
        const newFlags = (toolCall.parameters.flags as unknown[]) || [];
        flags.push(...newFlags.map(f => String(f)));
        logger.info('🚩 [WEBHOOK] Extracted flags from tool call', {
          callId,
          patientId: patient.id,
          flags: newFlags,
          totalFlagsCollected: flags.length,
        });
      }
      
      // Extract summary from logCallAttempt (highest priority for call summary)
      if (toolCall.name === 'logCallAttempt' && toolCall.parameters.summary) {
        callSummary = String(toolCall.parameters.summary).trim();
        logger.info('📝 [WEBHOOK] Extracted call summary from logCallAttempt', {
          callId,
          patientId: patient.id,
          summary: callSummary,
          summaryLength: callSummary.length,
        });
      }
      
      if (toolCall.name === 'storeDailyCheckIn') {
        logger.info('📋 [WEBHOOK] Processing storeDailyCheckIn tool call', {
          callId,
          patientId: patient.id,
          hasSleepHours: !!toolCall.parameters.sleepHours,
          hasSleep_hours: !!toolCall.parameters.sleep_hours,
          hasSleepQuality: !!toolCall.parameters.sleepQuality,
          hasSleep_quality: !!toolCall.parameters.sleep_quality,
          hasSummary: !!toolCall.parameters.summary,
          hasMood: !!toolCall.parameters.mood,
          hasFlags: !!toolCall.parameters.flags,
          allParameterKeys: Object.keys(toolCall.parameters || {}),
        });
        
        if (toolCall.parameters.sleepHours || toolCall.parameters.sleep_hours) {
          sleepHours = Number(toolCall.parameters.sleepHours || toolCall.parameters.sleep_hours);
          logger.info('😴 [WEBHOOK] Extracted sleep hours', { 
            callId, 
            patientId: patient.id,
            sleepHours,
            source: toolCall.parameters.sleepHours ? 'sleepHours' : 'sleep_hours',
          });
        }
        if (toolCall.parameters.sleepQuality || toolCall.parameters.sleep_quality) {
          sleepQuality = String(toolCall.parameters.sleepQuality || toolCall.parameters.sleep_quality);
          logger.info('😴 [WEBHOOK] Extracted sleep quality', { 
            callId, 
            patientId: patient.id,
            sleepQuality,
            source: toolCall.parameters.sleepQuality ? 'sleepQuality' : 'sleep_quality',
          });
        }
        if (toolCall.parameters.summary) {
          dailySummary = String(toolCall.parameters.summary).trim();
          // Use dailySummary as callSummary if no callSummary from logCallAttempt
          if (!callSummary) {
            callSummary = dailySummary;
            logger.info('📝 [WEBHOOK] Using dailySummary as call summary', {
              callId,
              patientId: patient.id,
              summary: callSummary,
              summaryLength: callSummary.length,
            });
          }
        }
      }
    }
    
    logger.info('📊 [WEBHOOK] Tool call processing summary', {
      callId,
      patientId: patient.id,
      totalToolCalls: toolCalls.length,
      medsTakenCount: medsTaken.length,
      medsTaken: medsTaken.map(m => `${m.medName}: ${m.taken ? 'taken' : 'not taken'}`),
      flagsCount: flags.length,
      flags: flags,
      sleepHours,
      sleepQuality,
      hasCallSummary: !!callSummary,
      callSummaryPreview: callSummary?.substring(0, 200),
      hasDailySummary: !!dailySummary,
      dailySummaryPreview: dailySummary?.substring(0, 200),
    });
    
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
    
    logger.info('💾 [WEBHOOK] Call log data prepared', {
      callId,
      patientId: patient.id,
      patientName: patient.name,
      summary: callSummary,
      summaryLength: callSummary?.length || 0,
      medsTakenCount: medsTaken.length,
      flagsCount: flags.length,
      sleepHours,
      sleepQuality,
      mood: moodResult.mood,
      outcome,
      hasTranscript: !!transcript,
      transcriptLength: transcript.length,
    });
    
    // Check if call log already exists (from logCallAttempt tool)
    // Use a time range to find recent logs (within last 5 minutes) since timestamps might differ slightly
    const fiveMinutesAgo = new Date(new Date(context.timestamp).getTime() - 5 * 60 * 1000).toISOString();
    const fiveMinutesLater = new Date(new Date(context.timestamp).getTime() + 5 * 60 * 1000).toISOString();
    
    logger.info('🔍 [WEBHOOK] Checking for existing call log', {
      callId,
      patientId: patient.id,
      timestamp: context.timestamp,
      searchRange: {
        from: fiveMinutesAgo,
        to: fiveMinutesLater,
      },
    });
    
    const { data: existingLogs, error: existingLogsError } = await supabase
      .from('call_logs')
      .select('*')
      .eq('patient_id', patient.id)
      .gte('timestamp', fiveMinutesAgo)
      .lte('timestamp', fiveMinutesLater)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    logger.info('🔍 [WEBHOOK] Existing call log lookup result', {
      callId,
      patientId: patient.id,
      existingLogsCount: existingLogs?.length || 0,
      hasError: !!existingLogsError,
      error: existingLogsError?.message,
      existingLogIds: existingLogs?.map(l => l.id) || [],
    });
    
    const existingLog = existingLogs && existingLogs.length > 0 ? existingLogs[0] : null;
    
    let callLogId: string;
    
    if (existingLog) {
      logger.info('🔄 [WEBHOOK] Updating existing call log', {
        callId,
        patientId: patient.id,
        existingLogId: existingLog.id,
        existingSummary: existingLog.summary,
        newSummary: callSummary,
      });
      
      // Update existing log
      logger.info('💾 [WEBHOOK] Attempting to update call_logs', {
        callId,
        patientId: patient.id,
        existingLogId: existingLog.id,
        dataToUpdate: JSON.stringify(callLogData, null, 2),
      });
      
      const { data: updated, error: updateError } = await supabase
        .from('call_logs')
        .update(callLogData)
        .eq('id', existingLog.id)
        .select()
        .single();
      
      if (updateError) {
        logger.error('❌ [WEBHOOK] Failed to update call log', {
          callId,
          patientId: patient.id,
          existingLogId: existingLog.id,
          error: updateError.message,
          errorCode: updateError.code,
          errorDetails: updateError.details,
          errorHint: updateError.hint,
        });
        throw updateError;
      }
      
      callLogId = updated.id;
      logger.info('✅ [WEBHOOK] Successfully updated call log', {
        callId,
        callLogId,
        patientId: patient.id,
        updatedSummary: updated.summary,
        updatedMedsCount: Array.isArray(updated.meds_taken) ? updated.meds_taken.length : 0,
        updatedFlagsCount: Array.isArray(updated.flags) ? updated.flags.length : 0,
      });
    } else {
      // Create new log
      logger.info('💾 [WEBHOOK] Attempting to create new call_logs entry', {
        callId,
        patientId: patient.id,
        dataToInsert: JSON.stringify(callLogData, null, 2),
      });
      
      const { data: newLog, error: insertError } = await supabase
        .from('call_logs')
        .insert(callLogData)
        .select()
        .single();
      
      if (insertError) {
        logger.error('❌ [WEBHOOK] Failed to create call log', {
          callId,
          patientId: patient.id,
          error: insertError.message,
          errorCode: insertError.code,
          errorDetails: insertError.details,
          errorHint: insertError.hint,
          dataAttempted: JSON.stringify(callLogData, null, 2),
        });
        throw insertError;
      }
      
      callLogId = newLog.id;
      logger.info('✅ [WEBHOOK] Successfully created call log', {
        callId,
        callLogId,
        patientId: patient.id,
        createdSummary: newLog.summary,
        createdMedsCount: Array.isArray(newLog.meds_taken) ? newLog.meds_taken.length : 0,
        createdFlagsCount: Array.isArray(newLog.flags) ? newLog.flags.length : 0,
      });
    }
    
    // Update patient's last_call_at
    logger.info('💾 [WEBHOOK] Updating patient last_call_at', {
      callId,
      patientId: patient.id,
      timestamp: context.timestamp,
    });
    
    const { error: patientUpdateError } = await supabase
      .from('patients')
      .update({ last_call_at: context.timestamp })
      .eq('id', patient.id);
    
    if (patientUpdateError) {
      logger.warn('⚠️ [WEBHOOK] Failed to update patient last_call_at', {
        callId,
        patientId: patient.id,
        error: patientUpdateError.message,
      });
    } else {
      logger.info('✅ [WEBHOOK] Updated patient last_call_at', {
        callId,
        patientId: patient.id,
      });
    }
    
    // Save data to individual tables (mood_logs, med_logs, flags, sleep_logs)
    // Only save if call was answered and we have data
    if (callAnswered) {
      logger.info('💾 [WEBHOOK] Starting individual table saves', {
        callId,
        patientId: patient.id,
        callLogId,
        hasMood: !!moodResult.mood,
        medsTakenCount: medsTaken.length,
        flagsCount: flags.length,
        hasSleepHours: sleepHours !== null && sleepHours !== undefined,
      });
      
      // Save mood to mood_logs (if we have a mood)
      if (moodResult.mood) {
        // Map mood from call_logs format (good/neutral/bad) to mood_logs format (happy/neutral/sad)
        const moodMapping: Record<string, string> = {
          'good': 'happy',
          'neutral': 'neutral',
          'bad': 'sad',
        };
        const moodLogValue = moodMapping[moodResult.mood] || 'neutral';
        
        logger.info('💾 [WEBHOOK] Saving mood to mood_logs', {
          callId,
          patientId: patient.id,
          callLogId,
          originalMood: moodResult.mood,
          mappedMood: moodLogValue,
        });
        
        try {
          const { data: moodData, error: moodError } = await supabase
            .from('mood_logs')
            .insert({
              patient_id: patient.id,
              mood: moodLogValue,
              timestamp: context.timestamp,
            })
            .select()
            .single();
          
          if (moodError) {
            logger.error('❌ [WEBHOOK] Failed to save mood log', { 
              callId,
              patientId: patient.id,
              error: moodError.message,
              errorCode: moodError.code,
              errorDetails: moodError.details,
              moodValue: moodLogValue,
            });
          } else {
            logger.info('✅ [WEBHOOK] Successfully saved mood log', { 
              callId,
              patientId: patient.id,
              moodLogId: moodData?.id,
              mood: moodLogValue,
            });
          }
        } catch (error: any) {
          logger.error('❌ [WEBHOOK] Exception saving mood log', { 
            callId,
            patientId: patient.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }
      
      // Save medications to med_logs
      if (medsTaken && medsTaken.length > 0) {
        logger.info('💾 [WEBHOOK] Saving medications to med_logs', {
          callId,
          patientId: patient.id,
          callLogId,
          medsCount: medsTaken.length,
          meds: medsTaken.map(m => `${m.medName}: ${m.taken ? 'taken' : 'not taken'}`),
        });
        
        try {
          const medLogEntries = medsTaken.map(med => ({
            patient_id: patient.id,
            med_name: med.medName,
            taken: med.taken,
            taken_at: med.timestamp || context.timestamp,
            timestamp: med.timestamp || context.timestamp,
          }));
          
          logger.info('💾 [WEBHOOK] Prepared med_log entries', {
            callId,
            patientId: patient.id,
            entries: JSON.stringify(medLogEntries, null, 2),
          });
          
          const { data: medData, error: medError } = await supabase
            .from('med_logs')
            .insert(medLogEntries)
            .select();
          
          if (medError) {
            logger.error('❌ [WEBHOOK] Failed to save medication logs', { 
              callId,
              patientId: patient.id,
              error: medError.message,
              errorCode: medError.code,
              errorDetails: medError.details,
              entriesAttempted: JSON.stringify(medLogEntries, null, 2),
            });
          } else {
            logger.info('✅ [WEBHOOK] Successfully saved medication logs', { 
              callId,
              patientId: patient.id,
              savedCount: medData?.length || 0,
              savedIds: medData?.map(m => m.id) || [],
            });
          }
        } catch (error: any) {
          logger.error('❌ [WEBHOOK] Exception saving medication logs', { 
            callId,
            patientId: patient.id,
            error: error.message,
            stack: error.stack,
          });
        }
      } else {
        logger.info('⏭️ [WEBHOOK] Skipping med_logs save - no medications collected', {
          callId,
          patientId: patient.id,
          medsTakenCount: medsTaken.length,
        });
      }
      
      // Save flags to flags table
      if (flags && flags.length > 0) {
        logger.info('💾 [WEBHOOK] Saving flags to flags table', {
          callId,
          patientId: patient.id,
          callLogId,
          flagsCount: flags.length,
          rawFlags: flags,
        });
        
        try {
          // Map flag strings to flag types and severities
          const flagEntries = flags.map(flag => {
            const flagStr = String(flag).toLowerCase();
            let type: 'fall' | 'med_missed' | 'other' = 'other';
            let severity: 'red' | 'yellow' = 'yellow';
            
            if (flagStr.includes('fall') || flagStr.includes('slip')) {
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
          
          logger.info('💾 [WEBHOOK] Prepared flag entries', {
            callId,
            patientId: patient.id,
            entries: JSON.stringify(flagEntries, null, 2),
          });
          
          const { data: flagData, error: flagError } = await supabase
            .from('flags')
            .insert(flagEntries)
            .select();
          
          if (flagError) {
            logger.error('❌ [WEBHOOK] Failed to save flags', { 
              callId,
              patientId: patient.id,
              error: flagError.message,
              errorCode: flagError.code,
              errorDetails: flagError.details,
              entriesAttempted: JSON.stringify(flagEntries, null, 2),
            });
          } else {
            logger.info('✅ [WEBHOOK] Successfully saved flags', { 
              callId,
              patientId: patient.id,
              savedCount: flagData?.length || 0,
              savedIds: flagData?.map(f => f.id) || [],
              savedFlags: flagData?.map(f => `${f.type} (${f.severity})`) || [],
            });
          }
        } catch (error: any) {
          logger.error('❌ [WEBHOOK] Exception saving flags', { 
            callId,
            patientId: patient.id,
            error: error.message,
            stack: error.stack,
          });
        }
      } else {
        logger.info('⏭️ [WEBHOOK] Skipping flags save - no flags collected', {
          callId,
          patientId: patient.id,
          flagsCount: flags.length,
        });
      }
      
      // Save sleep to sleep_logs
      if (sleepHours !== null && sleepHours !== undefined) {
        logger.info('💾 [WEBHOOK] Saving sleep to sleep_logs', {
          callId,
          patientId: patient.id,
          callLogId,
          sleepHours,
          sleepQuality,
        });
        
        try {
          const { data: sleepData, error: sleepError } = await supabase
            .from('sleep_logs')
            .insert({
              patient_id: patient.id,
              hours: Number(sleepHours),
              timestamp: context.timestamp,
            })
            .select()
            .single();
          
          if (sleepError) {
            logger.error('❌ [WEBHOOK] Failed to save sleep log', { 
              callId,
              patientId: patient.id,
              error: sleepError.message,
              errorCode: sleepError.code,
              errorDetails: sleepError.details,
              sleepHours,
            });
          } else {
            logger.info('✅ [WEBHOOK] Successfully saved sleep log', { 
              callId,
              patientId: patient.id,
              sleepLogId: sleepData?.id,
              hours: sleepHours,
            });
          }
        } catch (error: any) {
          logger.error('❌ [WEBHOOK] Exception saving sleep log', { 
            callId,
            patientId: patient.id,
            error: error.message,
            stack: error.stack,
          });
        }
      } else {
        logger.info('⏭️ [WEBHOOK] Skipping sleep_logs save - no sleep hours collected', {
          callId,
          patientId: patient.id,
          sleepHours,
        });
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
    
    const webhookDuration = Date.now() - webhookStartTime;
    
    logger.info('✅ [WEBHOOK] VAPI webhook processed successfully - FINAL SUMMARY', {
      callId,
      patientId: patient.id,
      patientName: patient.name,
      callLogId,
      outcome,
      callAnswered,
      mood: moodResult.mood,
      transcriptLength: transcript.length,
      summary: callSummary,
      summaryLength: callSummary?.length || 0,
      toolCallsProcessed: toolCalls.length,
      toolCallNames: toolCalls.map(tc => tc.name),
      medsTakenCount: medsTaken.length,
      medsTaken: medsTaken.map(m => `${m.medName}: ${m.taken ? 'taken' : 'not taken'}`),
      flagsCount: flags.length,
      flags: flags,
      sleepHours,
      sleepQuality,
      hasRecordingUrl: !!recordingUrl,
      totalDurationMs: webhookDuration,
      timestamp: new Date().toISOString(),
    });
    
    res.status(200).json({ 
      received: true, 
      processed: true,
      callLogId,
      patientId: patient.id,
      patientName: patient.name,
      summary: callSummary,
      medsTakenCount: medsTaken.length,
      flagsCount: flags.length,
      sleepHours,
      sleepQuality,
    });
  } catch (error: any) {
    const webhookDuration = Date.now() - webhookStartTime;
    logger.error('❌ [WEBHOOK] Error processing VAPI webhook', {
      error: error.message,
      stack: error.stack,
      durationMs: webhookDuration,
      timestamp: new Date().toISOString(),
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
  const requestStartTime = Date.now();
  try {
    logger.info('🔧 [TOOL ENDPOINT] Received VAPI tool call request', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      bodyKeys: Object.keys(req.body || {}),
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-vapi-call-id': req.headers['x-vapi-call-id'],
        'x-vapi-assistant-id': req.headers['x-vapi-assistant-id'],
      },
      rawBody: JSON.stringify(req.body, null, 2),
    });

    const messagePayload = (req.body && (req.body as any).message) || {};
    const callPayload = (req.body && (req.body as any).call) || messagePayload.call;
    const normalizedToolCalls = extractToolCallsFromPayload(req.body, callPayload);

    if (normalizedToolCalls.length > 0) {
      logger.info('🔧 [TOOL ENDPOINT] Handling batched tool call payload', {
        toolCallsCount: normalizedToolCalls.length,
        toolCallIds: normalizedToolCalls.map((call) => call.id),
        toolCallNames: normalizedToolCalls.map((call) => call.name),
      });

      const resolvedCallId =
        coalesce(
          callPayload?.id as string | undefined,
          req.body?.callId as string | undefined,
          messagePayload?.callId as string | undefined,
          headerValueToString(req.headers['x-vapi-call-id']),
        ) || 'unknown';

      const assistantId = coalesce(
        callPayload?.assistantId as string | undefined,
        messagePayload?.assistantId as string | undefined,
        messagePayload?.assistant?.id as string | undefined,
        headerValueToString(req.headers['x-vapi-assistant-id']),
      );

      const assistant = assistantId ? getAssistantById(assistantId) : null;
      const assistantName = assistant?.name || messagePayload?.assistant?.name || 'Unknown';

      const assistantVariables = messagePayload?.assistant?.variableValues as Record<string, unknown> | undefined;
      const defaultPatientId = resolvePatientIdFromSources(
        assistantVariables,
        callPayload as Record<string, unknown> | undefined,
        req.body as Record<string, unknown> | undefined,
      );

      const batchedResults: Array<{ toolCallId: string; success: boolean; result?: unknown; error?: string }> = [];

      for (let i = 0; i < normalizedToolCalls.length; i++) {
        const toolCallEntry = normalizedToolCalls[i];
        const parameters = toolCallEntry.parameters || {};
        const resolvedPatientId = resolvePatientIdFromSources(
          parameters as Record<string, unknown>,
          assistantVariables,
          callPayload as Record<string, unknown> | undefined,
          defaultPatientId ? ({ patientId: defaultPatientId } as Record<string, unknown>) : undefined,
        );

        if (!resolvedPatientId) {
          logger.error('❌ [TOOL ENDPOINT] Tool call missing patientId (batched payload)', {
            toolCallId: toolCallEntry.id,
            toolName: toolCallEntry.name,
            parameterKeys: Object.keys(parameters || {}),
            assistantId,
          });
          return res.status(400).json({
            success: false,
            error: 'patientId is required in parameters',
            toolCallId: toolCallEntry.id,
            toolName: toolCallEntry.name,
          });
        }

        const perCallId =
          coalesce(
            parameters['callId'] as string | undefined,
            parameters['call_id'] as string | undefined,
            resolvedCallId,
          ) || 'unknown';

        const context = {
          patientId: resolvedPatientId,
          callId: perCallId,
          assistantName,
          timestamp: new Date().toISOString(),
        };

        logger.info('🔧 [TOOL ENDPOINT] Processing tool call (batched payload)', {
          toolCallId: toolCallEntry.id,
          toolName: toolCallEntry.name,
          patientId: resolvedPatientId,
          callId: perCallId,
          assistantName,
          parameterKeys: Object.keys(parameters || {}),
        });

        const routeStartTime = Date.now();
        const result = await routeToolCall(
          {
            name: toolCallEntry.name,
            parameters,
          },
          context,
        );
        const routeDuration = Date.now() - routeStartTime;

        logger.info('🔧 [TOOL ENDPOINT] Tool call routed (batched)', {
          toolCallId: toolCallEntry.id,
          toolName: toolCallEntry.name,
          patientId: resolvedPatientId,
          callId: perCallId,
          success: result.success,
          hasResult: !!result.result,
          hasError: !!result.error,
          error: result.error,
          routeDurationMs: routeDuration,
        });

        batchedResults.push({
          toolCallId: toolCallEntry.id || `${toolCallEntry.name}-${i}`,
          success: result.success,
          result: result.result,
          error: result.error,
        });
      }

      const success = batchedResults.every((entry) => entry.success);

      logger.info('✅ [TOOL ENDPOINT] Batched tool calls processed', {
        totalToolCalls: batchedResults.length,
        success,
      });

      return res.json({
        success,
        results: batchedResults,
      });
    }

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

    logger.info('🔧 [TOOL ENDPOINT] Parsed request body', {
      hasName: !!name,
      hasToolName: !!toolName,
      hasParameters: !!parameters,
      hasCallId: !!callId,
      hasCall: !!call,
      hasPatientId: !!patientId,
      parametersKeys: parameters ? Object.keys(parameters) : [],
      callKeys: call ? Object.keys(call) : [],
    });

    // Determine tool name (could be 'name' or 'toolName')
    const toolCallName = name || toolName;
    
    if (!toolCallName) {
      logger.error('❌ [TOOL ENDPOINT] Tool call missing name', { 
        body: req.body,
        availableKeys: Object.keys(req.body || {}),
      });
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
      });
    }

    logger.info('🔧 [TOOL ENDPOINT] Tool name identified', {
      toolName: toolCallName,
      source: name ? 'name' : 'toolName',
    });

    // Get patientId from parameters or body
    // patientId should be passed via variableValues when making the call
    const resolvedPatientId = patientId || parameters?.patientId;
    
    logger.info('🔧 [TOOL ENDPOINT] Patient ID resolution', {
      patientIdFromBody: patientId || 'NOT PROVIDED',
      patientIdFromParameters: parameters?.patientId || 'NOT PROVIDED',
      resolvedPatientId: resolvedPatientId || 'NOT RESOLVED',
      allParameterKeys: parameters ? Object.keys(parameters) : [],
    });
    
    if (!resolvedPatientId) {
      logger.error('❌ [TOOL ENDPOINT] Tool call missing patientId', { 
        body: req.body,
        parameters: parameters,
        availableKeys: Object.keys(req.body || {}),
      });
      return res.status(400).json({
        success: false,
        error: 'patientId is required in parameters',
      });
    }

    // Get callId from body or call object
    const resolvedCallId = callId || call?.id || req.headers['x-vapi-call-id'] || 'unknown';
    
    logger.info('🔧 [TOOL ENDPOINT] Call ID resolution', {
      callIdFromBody: callId || 'NOT PROVIDED',
      callIdFromCall: call?.id || 'NOT PROVIDED',
      callIdFromHeader: req.headers['x-vapi-call-id'] || 'NOT PROVIDED',
      resolvedCallId,
    });
    
    // Get assistant info if available
    const assistantId = call?.assistantId || req.headers['x-vapi-assistant-id'];
    const assistant = assistantId ? getAssistantById(assistantId) : null;
    const assistantName = assistant?.name || 'Unknown';

    logger.info('🔧 [TOOL ENDPOINT] Assistant info', {
      assistantId: assistantId || 'NOT PROVIDED',
      assistantName,
      assistantFound: !!assistant,
    });

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

    logger.info('🔧 [TOOL ENDPOINT] Processing tool call', {
      toolName: toolCallName,
      patientId: resolvedPatientId,
      callId: resolvedCallId,
      assistantName,
      parameters: JSON.stringify(toolCall.parameters, null, 2),
      parameterCount: Object.keys(toolCall.parameters).length,
    });

    // Route the tool call
    const routeStartTime = Date.now();
    const result = await routeToolCall(toolCall, context);
    const routeDuration = Date.now() - routeStartTime;

    logger.info('🔧 [TOOL ENDPOINT] Tool call routed', {
      toolName: toolCallName,
      patientId: resolvedPatientId,
      callId: resolvedCallId,
      success: result.success,
      hasResult: !!result.result,
      hasError: !!result.error,
      error: result.error,
      resultPreview: result.result ? JSON.stringify(result.result).substring(0, 200) : null,
      routeDurationMs: routeDuration,
      totalDurationMs: Date.now() - requestStartTime,
    });

    // Return result to VAPI
    // VAPI expects a response with the tool result
    if (result.success) {
      logger.info('✅ [TOOL ENDPOINT] Tool call succeeded', {
        toolName: toolCallName,
        patientId: resolvedPatientId,
        callId: resolvedCallId,
      });
      res.json({
        result: result.result,
        success: true,
      });
    } else {
      logger.error('❌ [TOOL ENDPOINT] Tool call failed', {
        toolName: toolCallName,
        patientId: resolvedPatientId,
        callId: resolvedCallId,
        error: result.error,
      });
      res.status(500).json({
        error: result.error || 'Tool execution failed',
        success: false,
      });
    }
  } catch (error: any) {
    logger.error('❌ [TOOL ENDPOINT] Error handling tool call', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      durationMs: Date.now() - requestStartTime,
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

