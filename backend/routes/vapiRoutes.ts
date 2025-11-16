/**
 * VAPI Webhook Routes
 * 
 * Handles call-ended webhooks from VAPI and routes tool calls
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../supabase/client';
import { routeToolCall } from '../vapi/tools';
// Mood inference is now done by VAPI during the call via storeDailyCheckIn tool
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
    endedReason?: string;
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

const GRACEFUL_CALL_ENDINGS = new Set([
  'completed',
  'assistant_hangup',
  'assistant-hangup',
  'assistant hangup',
  'assistant_goodbye',
  'assistant-goodbye',
  'user_hangup',
  'user-hangup',
  'user hangup',
  'customer_hangup',
  'customer-hangup',
  'customer hangup',
  'customer_disconnected',
  'customer disconnected',
  'patient_hangup',
  'patient-hangup',
  'patient hangup',
  'user_disconnected',
  'user disconnected',
  'user_end',
  'user-ended',
  'customer_end',
  'customer-ended',
  'hangup',
  'cancelled',
  'canceled',
  'call_completed',
  'call-completed',
  'call completed',
]);

const SILENCE_CALL_ENDINGS = new Set([
  'silence_timeout',
  'silence-timeout',
  'silence timeout',
  'silence hangup',
  'silence_hangup',
  'silence',
  'silence disconnect',
  'silence_disconnect',
  'auto_disconnect_silence',
  'auto-disconnect-silence',
  'no_response',
  'no-response',
  'no_response_timeout',
  'no-response-timeout',
  'timeout_silence',
  'silence_timeout_user',
  'silence_timeout_assistant',
  'silence_timeout_auto',
  'silence_timeout_hangup',
]);

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

function resolveCallEndReason(callData?: Record<string, unknown>, messagePayload?: Record<string, unknown>): string | undefined {
  return coalesce(
    callData?.endedReason as string | undefined,
    callData?.endReason as string | undefined,
    callData?.ended_reason as string | undefined,
    callData?.hangupReason as string | undefined,
    callData?.hangup_reason as string | undefined,
    messagePayload?.endedReason as string | undefined,
    messagePayload?.endReason as string | undefined,
    messagePayload?.hangupReason as string | undefined,
    messagePayload?.hangup_reason as string | undefined,
  );
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
    const callEndedReason = resolveCallEndReason(callData, messagePayload);
    const normalizedReason = callEndedReason ? String(callEndedReason).toLowerCase() : undefined;
    const messageType = messagePayload?.type ? String(messagePayload.type).toLowerCase() : undefined;
    const isEndedStatus = !normalizedStatus || normalizedStatus === 'ended' || GRACEFUL_CALL_ENDINGS.has(normalizedStatus);
    const isCallEvent = messageType ? messageType.includes('call') : false;
    
    logger.info('📞 [WEBHOOK] Received VAPI call-ended webhook', {
      timestamp: new Date().toISOString(),
      callId: callData?.id,
      status: callData?.status,
      endedReason: callEndedReason,
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
        endedReason: callEndedReason,
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
    const callTimestampIso = new Date().toISOString();
    const callEndedGracefully = (normalizedStatus && GRACEFUL_CALL_ENDINGS.has(normalizedStatus)) || (normalizedReason && GRACEFUL_CALL_ENDINGS.has(normalizedReason));
    const callEndedDueToSilence = normalizedReason && SILENCE_CALL_ENDINGS.has(normalizedReason);
    let callAnswered = transcript.length > 0 || toolCalls.length > 0 || summary.trim().length > 0 || callEndedGracefully || !!callEndedDueToSilence;
    let medsTaken: Array<{ medName: string; taken: boolean; timestamp: string }> = [];
    let flags: string[] = [];
    let sleepHours: number | null = null;
    let sleepQuality: string | null = null;
    let callSummary: string | null = null; // Prioritized call summary
    let dailySummary: string | null = null; // Daily check-in summary
    
    logger.info('📞 [WEBHOOK] Processing call-ended webhook', {
      callId,
      customerNumber,
      assistantId,
      status: callStatus,
      endedReason: callEndedReason,
      callAnswered,
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
    
    // Look up recent daily check-in data (if any) to backfill call info
    const lookbackWindowMinutes = 15;
    const lookbackWindowStart = new Date(
      new Date(callTimestampIso).getTime() - lookbackWindowMinutes * 60 * 1000
    ).toISOString();
    
    let recentCheckIn:
      | {
          id: string;
          summary: string | null;
          sleep_hours: number | null;
          sleep_quality: string | null;
          mood: 'good' | 'neutral' | 'bad' | null;
          flags: unknown[] | null;
          updated_at: string;
        }
      | null = null;
    
    const { data: recentCheckIns, error: recentCheckInError } = await supabase
      .from('daily_checkins')
      .select('id,summary,sleep_hours,sleep_quality,mood,flags,updated_at')
      .eq('patient_id', patient.id)
      .gte('updated_at', lookbackWindowStart)
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (recentCheckInError) {
      logger.warn('⚠️ [WEBHOOK] Failed to fetch recent daily check-in', {
        callId,
        patientId: patient.id,
        error: recentCheckInError.message,
      });
    } else if (recentCheckIns && recentCheckIns.length > 0) {
      recentCheckIn = recentCheckIns[0];
      logger.info('📋 [WEBHOOK] Recent daily check-in detected', {
        callId,
        patientId: patient.id,
        checkInId: recentCheckIn.id,
        updatedAt: recentCheckIn.updated_at,
      });
      
      if (!callAnswered) {
        callAnswered = true;
        logger.info('📋 [WEBHOOK] Marking call as answered based on check-in activity', {
          callId,
          patientId: patient.id,
          checkInId: recentCheckIn.id,
        });
      }
      
      if (!dailySummary && recentCheckIn.summary) {
        dailySummary = recentCheckIn.summary;
      }
      if (!callSummary && recentCheckIn.summary) {
        callSummary = recentCheckIn.summary;
      }
      if ((sleepHours === null || sleepHours === undefined) && typeof recentCheckIn.sleep_hours === 'number') {
        sleepHours = Number(recentCheckIn.sleep_hours);
      }
      if (!sleepQuality && recentCheckIn.sleep_quality) {
        sleepQuality = recentCheckIn.sleep_quality;
      }
      if (!flags.length && Array.isArray(recentCheckIn.flags)) {
        flags = (recentCheckIn.flags as unknown[]).map(flag =>
          typeof flag === 'string' ? flag : JSON.stringify(flag)
        );
      }
    }
    
    const checkInMood = (recentCheckIn?.mood as 'good' | 'neutral' | 'bad' | null) || null;
    
    // Determine call outcome
    const outcome: CallLog['outcome'] = callAnswered
      ? 'answered'
      : 'no_answer';
    
    // Mood will be inferred by VAPI during the call and passed via storeDailyCheckIn tool
    // We'll extract it from tool calls below
    let resolvedMood: 'good' | 'neutral' | 'bad' | null = checkInMood;
    let resolvedSentimentScore = 0.5; // Default neutral score
    
    const context = {
      patientId: patient.id,
      callId,
      assistantName,
      timestamp: callTimestampIso,
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
      if (toolCall.name === 'markMedicationStatus') {
        // Try to get from result first, then from parameters
        let medStatus: { medName: string; taken: boolean; timestamp: string } | null = null;
        
        if (result.result && typeof result.result === 'object') {
          const resultData = result.result as any;
          if (resultData.medName && typeof resultData.taken === 'boolean') {
            medStatus = {
              medName: String(resultData.medName).trim(),
              taken: Boolean(resultData.taken),
              timestamp: resultData.timestamp || context.timestamp,
            };
          }
        }
        
        // Fallback to parameters if result doesn't have the data
        if (!medStatus && toolCall.parameters.medName && typeof toolCall.parameters.taken === 'boolean') {
          medStatus = {
            medName: String(toolCall.parameters.medName).trim(),
            taken: Boolean(toolCall.parameters.taken),
            timestamp: (toolCall.parameters.timestamp as string) || context.timestamp,
          };
        }
        
        if (medStatus) {
          // Check if we already have this medication
          const existingIndex = medsTaken.findIndex(m => m.medName.toLowerCase() === medStatus!.medName.toLowerCase());
          if (existingIndex >= 0) {
            // Update existing entry if this one is more recent or if it's "taken"
            if (medStatus.taken || !medsTaken[existingIndex].taken) {
              medsTaken[existingIndex] = medStatus;
            }
          } else {
            medsTaken.push(medStatus);
          }
          
          logger.info('💊 [WEBHOOK] Extracted medication status from tool call', {
            callId,
            patientId: patient.id,
            medName: medStatus.medName,
            taken: medStatus.taken,
            timestamp: medStatus.timestamp,
            totalMedsCollected: medsTaken.length,
            source: result.result ? 'result' : 'parameters',
          });
        } else {
          logger.warn('⚠️ [WEBHOOK] markMedicationStatus tool call missing required data', {
            callId,
            patientId: patient.id,
            hasResult: !!result.result,
            resultKeys: result.result ? Object.keys(result.result) : [],
            parameterKeys: Object.keys(toolCall.parameters || {}),
          });
        }
      }
      
      if (toolCall.name === 'updateFlags' && toolCall.parameters.flags) {
        const newFlags = (toolCall.parameters.flags as unknown[]) || [];
        const flagStrings = newFlags.map(f => String(f)).filter(Boolean);
        // Only add flags that aren't already in the array
        flagStrings.forEach(flag => {
          if (!flags.includes(flag)) {
            flags.push(flag);
          }
        });
        logger.info('🚩 [WEBHOOK] Extracted flags from tool call', {
          callId,
          patientId: patient.id,
          flags: newFlags,
          totalFlagsCollected: flags.length,
        });
      }
      
      // Also extract flags from storeDailyCheckIn if present
      if (toolCall.name === 'storeDailyCheckIn' && toolCall.parameters.flags) {
        const newFlags = (toolCall.parameters.flags as unknown[]) || [];
        const flagStrings = newFlags.map(f => String(f)).filter(Boolean);
        flagStrings.forEach(flag => {
          if (!flags.includes(flag)) {
            flags.push(flag);
          }
        });
        logger.info('🚩 [WEBHOOK] Extracted flags from storeDailyCheckIn', {
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
          hasMeds: !!toolCall.parameters.meds || !!toolCall.parameters.meds_taken,
          allParameterKeys: Object.keys(toolCall.parameters || {}),
        });
        
        // Extract mood from VAPI's inference (highest priority)
        if (toolCall.parameters.mood) {
          const moodValue = String(toolCall.parameters.mood).toLowerCase();
          if (moodValue === 'good' || moodValue === 'neutral' || moodValue === 'bad') {
            resolvedMood = moodValue as 'good' | 'neutral' | 'bad';
            // Set sentiment score based on mood
            resolvedSentimentScore = moodValue === 'good' ? 0.8 : moodValue === 'bad' ? 0.2 : 0.5;
            logger.info('😊 [WEBHOOK] Extracted mood from VAPI tool call', { 
              callId, 
              patientId: patient.id,
              mood: resolvedMood,
            });
          }
        }
        
        // Extract medications from storeDailyCheckIn if present
        const medsParam = toolCall.parameters.meds || toolCall.parameters.meds_taken;
        if (medsParam && Array.isArray(medsParam)) {
          medsParam.forEach((med: any) => {
            if (med && typeof med === 'object' && med.medName) {
              const medStatus = {
                medName: String(med.medName).trim(),
                taken: Boolean(med.taken),
                timestamp: med.timestamp || context.timestamp,
              };
              // Check if we already have this medication
              const existingIndex = medsTaken.findIndex(m => m.medName === medStatus.medName);
              if (existingIndex >= 0) {
                // Update existing entry if this one is more recent or if it's "taken"
                if (medStatus.taken || !medsTaken[existingIndex].taken) {
                  medsTaken[existingIndex] = medStatus;
                }
              } else {
                medsTaken.push(medStatus);
              }
            }
          });
          logger.info('💊 [WEBHOOK] Extracted medications from storeDailyCheckIn', {
            callId,
            patientId: patient.id,
            medsCount: medsParam.length,
            totalMedsCollected: medsTaken.length,
          });
        }
        
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
    
    // Always deduplicate flags
    flags = Array.from(new Set(flags));
    
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
    
    // CRITICAL: Extract medications from summary/transcript AFTER summary is finalized
    // This is a fallback when VAPI assistant mentions medications but doesn't call markMedicationStatus
    if (callAnswered && patient.meds && Array.isArray(patient.meds) && patient.meds.length > 0) {
      const patientMedNames = patient.meds.map((m: any) => {
        if (typeof m === 'string') return m.toLowerCase();
        if (m && typeof m === 'object' && m.name) return m.name.toLowerCase();
        return String(m).toLowerCase();
      }).filter(Boolean);
      
      // Use finalized summary, VAPI summary, or transcript - in that order
      const textToSearch = (callSummary || summary || transcript || '').toLowerCase();
      
      logger.info('🔍 [WEBHOOK] Attempting medication extraction from text', {
        callId,
        patientId: patient.id,
        patientMeds: patientMedNames,
        hasCallSummary: !!callSummary,
        hasSummary: !!summary,
        hasTranscript: !!transcript,
        textLength: textToSearch.length,
        textPreview: textToSearch.substring(0, 300),
        callSummaryText: callSummary || 'NONE',
        summaryText: summary || 'NONE',
      });
      
      // Check if any patient medications are mentioned in the text
      for (const medName of patientMedNames) {
        // Look for patterns indicating medication was taken
        // Escape special regex characters in medication name
        const escapedMedName = medName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
          // "has taken" variations (most common in summaries)
          new RegExp(`\\bhas\\s+taken\\s+his\\s+${escapedMedName}\\b`, 'i'), // "has taken his Advil"
          new RegExp(`\\bhas\\s+taken\\s+her\\s+${escapedMedName}\\b`, 'i'), // "has taken her Advil"
          new RegExp(`\\bhas\\s+taken\\s+the\\s+${escapedMedName}\\b`, 'i'), // "has taken the Advil"
          new RegExp(`\\bhas\\s+taken\\s+${escapedMedName}\\b`, 'i'), // "has taken Advil"
          new RegExp(`\\bhas\\s+taken\\s+${escapedMedName}\\s+today\\b`, 'i'), // "has taken Advil today"
          new RegExp(`\\bhas\\s+taken\\s+his\\s+${escapedMedName}\\s+today\\b`, 'i'), // "has taken his Advil today"
          
          // "had taken" variations
          new RegExp(`\\bhad\\s+taken\\s+${escapedMedName}\\b`, 'i'), // "had taken Advil"
          new RegExp(`\\bhad\\s+taken\\s+his\\s+${escapedMedName}\\b`, 'i'), // "had taken his Advil"
          new RegExp(`\\bhad\\s+taken\\s+her\\s+${escapedMedName}\\b`, 'i'), // "had taken her Advil"
          new RegExp(`\\bhad\\s+taken\\s+the\\s+${escapedMedName}\\b`, 'i'), // "had taken the Advil"
          
          // "took" variations
          new RegExp(`\\btook\\s+${escapedMedName}\\b`, 'i'), // "took Advil"
          new RegExp(`\\btook\\s+his\\s+${escapedMedName}\\b`, 'i'), // "took his Advil"
          new RegExp(`\\btook\\s+her\\s+${escapedMedName}\\b`, 'i'), // "took her Advil"
          new RegExp(`\\btook\\s+the\\s+${escapedMedName}\\b`, 'i'), // "took the Advil"
          new RegExp(`\\btook\\s+${escapedMedName}\\s+for\\b`, 'i'), // "took Advil for"
          new RegExp(`\\btook\\s+${escapedMedName}\\s+today\\b`, 'i'), // "took Advil today"
          
          // "taken" variations
          new RegExp(`\\btaken\\s+${escapedMedName}\\b`, 'i'), // "taken Advil"
          new RegExp(`\\btaken\\s+his\\s+${escapedMedName}\\b`, 'i'), // "taken his Advil"
          new RegExp(`\\btaken\\s+her\\s+${escapedMedName}\\b`, 'i'), // "taken her Advil"
          new RegExp(`\\btaken\\s+the\\s+${escapedMedName}\\b`, 'i'), // "taken the Advil"
          new RegExp(`\\b${escapedMedName}\\s+taken\\b`, 'i'), // "Advil taken"
          
          // Other common patterns
          new RegExp(`\\b${escapedMedName}\\s+for\\b`, 'i'), // "Advil for migraine"
          new RegExp(`\\busing\\s+${escapedMedName}\\b`, 'i'), // "using Advil"
          new RegExp(`\\btaking\\s+${escapedMedName}\\b`, 'i'), // "taking Advil"
          new RegExp(`\\btook\\s+${escapedMedName}\\s+this\\s+morning\\b`, 'i'), // "took Advil this morning"
          new RegExp(`\\btook\\s+${escapedMedName}\\s+this\\s+afternoon\\b`, 'i'), // "took Advil this afternoon"
        ];
        
        // Test each pattern and log which ones match
        let foundPattern: RegExp | undefined;
        for (const pattern of patterns) {
          if (pattern.test(textToSearch)) {
            foundPattern = pattern;
            logger.info('💊 [WEBHOOK] ✅ Pattern matched for medication', {
              callId,
              patientId: patient.id,
              medName,
              pattern: pattern.toString(),
              matchIndex: textToSearch.search(pattern),
              textSnippet: textToSearch.substring(Math.max(0, textToSearch.search(pattern) - 50), textToSearch.search(pattern) + 100),
            });
            break; // Use first match
          }
        }
        
        if (foundPattern) {
          // Extract the original medication name (preserve case)
          const originalMedName = patient.meds.find((m: any) => {
            const normalized = typeof m === 'string' ? m.toLowerCase() : (m?.name || String(m)).toLowerCase();
            return normalized === medName;
          });
          
          const medNameToStore = typeof originalMedName === 'string' 
            ? originalMedName 
            : (originalMedName?.name || String(originalMedName) || medName);
          
          // Check if we already have this medication
          const existingIndex = medsTaken.findIndex(m => m.medName.toLowerCase() === medNameToStore.toLowerCase());
          if (existingIndex >= 0) {
            // Update to taken if not already taken
            if (!medsTaken[existingIndex].taken) {
              medsTaken[existingIndex].taken = true;
              medsTaken[existingIndex].timestamp = context.timestamp;
            }
          } else {
            medsTaken.push({
              medName: medNameToStore,
              taken: true,
              timestamp: context.timestamp,
            });
          }
          
          logger.info('💊 [WEBHOOK] ✅ Extracted medication from text', {
            callId,
            patientId: patient.id,
            medName: medNameToStore,
            source: 'summary/transcript',
            matchedPattern: foundPattern.toString(),
            textSnippet: textToSearch.substring(Math.max(0, textToSearch.search(foundPattern) - 50), textToSearch.search(foundPattern) + 100),
            medsTakenBefore: medsTaken.length,
            medsTakenAfter: medsTaken.length,
          });
        } else {
          // Also check for negative patterns (not taken)
          const negativePatterns = [
            new RegExp(`\\bdidn'?t\\s+take\\s+${escapedMedName}\\b`, 'i'),
            new RegExp(`\\bdid\\s+not\\s+take\\s+${escapedMedName}\\b`, 'i'),
            new RegExp(`\\bhaven'?t\\s+taken\\s+${escapedMedName}\\b`, 'i'),
            new RegExp(`\\bhave\\s+not\\s+taken\\s+${escapedMedName}\\b`, 'i'),
            new RegExp(`\\bnot\\s+taken\\s+${escapedMedName}\\b`, 'i'),
            new RegExp(`\\b${escapedMedName}\\s+not\\s+taken\\b`, 'i'),
          ];
          
          const foundNegative = negativePatterns.find(pattern => pattern.test(textToSearch));
          
          if (foundNegative) {
            const originalMedName = patient.meds.find((m: any) => {
              const normalized = typeof m === 'string' ? m.toLowerCase() : (m?.name || String(m)).toLowerCase();
              return normalized === medName;
            });
            
            const medNameToStore = typeof originalMedName === 'string' 
              ? originalMedName 
              : (originalMedName?.name || String(originalMedName) || medName);
            
            const existingIndex = medsTaken.findIndex(m => m.medName.toLowerCase() === medNameToStore.toLowerCase());
            if (existingIndex >= 0) {
              medsTaken[existingIndex].taken = false;
              medsTaken[existingIndex].timestamp = context.timestamp;
            } else {
              medsTaken.push({
                medName: medNameToStore,
                taken: false,
                timestamp: context.timestamp,
              });
            }
            
            logger.info('💊 [WEBHOOK] ✅ Extracted medication NOT taken from text', {
              callId,
              patientId: patient.id,
              medName: medNameToStore,
              source: 'summary/transcript',
            });
          } else {
            // Log when no pattern matches for debugging
            logger.info('💊 [WEBHOOK] No pattern matched for medication', {
              callId,
              patientId: patient.id,
              medName,
              textToSearch: textToSearch.substring(0, 500), // First 500 chars for debugging
              patientMedNames,
            });
          }
        }
      }
      
      // If no medications found via tools OR extraction, initialize all patient meds as "not taken"
      if (medsTaken.length === 0) {
        logger.warn('⚠️ [WEBHOOK] No medications collected via tools or extraction', {
          callId,
          patientId: patient.id,
          patientName: patient.name,
          toolCallsCount: toolCalls.length,
          toolCallNames: toolCalls.map(tc => tc.name),
          transcriptLength: transcript.length,
          summaryPreview: callSummary?.substring(0, 200),
          patientMeds: patientMedNames,
        });
        
        // Initialize all patient medications as "not taken" so they show up on dashboard
        // This ensures the caregiver can see all medications even if not mentioned in call
        for (const medName of patientMedNames) {
          const originalMedName = patient.meds.find((m: any) => {
            const normalized = typeof m === 'string' ? m.toLowerCase() : (m?.name || String(m)).toLowerCase();
            return normalized === medName;
          });
          
          const medNameToStore = typeof originalMedName === 'string' 
            ? originalMedName 
            : (originalMedName?.name || String(originalMedName) || medName);
          
          medsTaken.push({
            medName: medNameToStore,
            taken: false,
            timestamp: context.timestamp,
          });
        }
        
        logger.info('💊 [WEBHOOK] Initialized all patient medications as not taken', {
          callId,
          patientId: patient.id,
          medsCount: medsTaken.length,
        });
      }
    }
    
    // CRITICAL: Extract flags from summary/transcript for concerning events
    // This automatically creates flags for medical emergencies, falls, injuries, etc.
    if (callAnswered && (callSummary || summary || transcript)) {
      const textToSearch = (callSummary || summary || transcript || '').toLowerCase();
      
      logger.info('🚩 [WEBHOOK] Attempting flag extraction from text', {
        callId,
        patientId: patient.id,
        hasCallSummary: !!callSummary,
        hasSummary: !!summary,
        hasTranscript: !!transcript,
        textLength: textToSearch.length,
        textPreview: textToSearch.substring(0, 300),
      });
      
      // Define concerning event patterns with their flag types and severities
      const concerningEvents = [
        // Falls and injuries (RED severity)
        { patterns: [/\bfall\b/i, /\bfell\b/i, /\bslipped?\b/i, /\bslip\b/i, /\btripped?\b/i, /\baccident\b/i], type: 'fall', severity: 'red', flagText: 'Fall or slip incident' },
        { patterns: [/\binjured?\b/i, /\binjury\b/i, /\bhurt\b/i, /\bdamaged?\b/i], type: 'other', severity: 'red', flagText: 'Injury reported' },
        
        // Bleeding (RED severity)
        { patterns: [/\bbloody\s+nose\b/i, /\bnosebleed\b/i, /\bbleeding\b/i, /\bblood\b/i], type: 'other', severity: 'red', flagText: 'Bleeding reported' },
        
        // Severe pain (RED severity)
        { patterns: [/\bsevere\s+pain\b/i, /\bexcruciating\s+pain\b/i, /\bunbearable\s+pain\b/i, /\bintense\s+pain\b/i], type: 'other', severity: 'red', flagText: 'Severe pain reported' },
        { patterns: [/\breally\s+bad\s+migraine\b/i, /\bsevere\s+migraine\b/i, /\bdebilitating\s+migraine\b/i], type: 'other', severity: 'red', flagText: 'Severe migraine' },
        
        // Chest pain / heart issues (RED severity)
        { patterns: [/\bchest\s+pain\b/i, /\bheart\s+pain\b/i, /\bheart\s+attack\b/i, /\bcardiac\b/i], type: 'other', severity: 'red', flagText: 'Chest or heart pain' },
        
        // Difficulty breathing (RED severity)
        { patterns: [/\bdifficulty\s+breathing\b/i, /\bcan'?t\s+breathe\b/i, /\bshortness\s+of\s+breath\b/i, /\bbreathing\s+problems\b/i], type: 'other', severity: 'red', flagText: 'Breathing difficulties' },
        
        // Dizziness / fainting (RED severity)
        { patterns: [/\bdizzy\b/i, /\bdizziness\b/i, /\bfainted?\b/i, /\bfainting\b/i, /\bpassed\s+out\b/i], type: 'other', severity: 'red', flagText: 'Dizziness or fainting' },
        
        // Confusion / disorientation (RED severity)
        { patterns: [/\bconfused\b/i, /\bconfusion\b/i, /\bdisoriented\b/i, /\bdisorientation\b/i, /\bcan'?t\s+remember\b/i], type: 'other', severity: 'red', flagText: 'Confusion or disorientation' },
        
        // Medication issues (YELLOW severity)
        { patterns: [/\bdidn'?t\s+take\s+med/i, /\bmissed\s+med/i, /\bforgot\s+med/i, /\bmedication\s+missed\b/i], type: 'med_missed', severity: 'yellow', flagText: 'Medication missed' },
        
        // Moderate pain (YELLOW severity)
        { patterns: [/\bmoderate\s+pain\b/i, /\bconstant\s+pain\b/i, /\bpersistent\s+pain\b/i], type: 'other', severity: 'yellow', flagText: 'Moderate pain reported' },
        
        // Nausea / vomiting (YELLOW severity)
        { patterns: [/\bnausea\b/i, /\bvomiting\b/i, /\bthrew\s+up\b/i, /\bthrowing\s+up\b/i], type: 'other', severity: 'yellow', flagText: 'Nausea or vomiting' },
        
        // Poor sleep (YELLOW severity - only if very poor)
        { patterns: [/\bno\s+sleep\b/i, /\binsomnia\b/i, /\bcan'?t\s+sleep\b/i, /\bslept\s+less\s+than\s+2\s+hours\b/i], type: 'other', severity: 'yellow', flagText: 'Severe sleep issues' },
      ];
      
      // Check for each concerning event
      for (const event of concerningEvents) {
        const foundPattern = event.patterns.find(pattern => pattern.test(textToSearch));
        
        if (foundPattern) {
          // Create flag string
          const flagString = `${event.type}:${event.severity}:${event.flagText}`;
          
          // Check if flag already exists (avoid duplicates)
          const flagExists = flags.some(f => {
            const fStr = String(f).toLowerCase();
            return fStr.includes(event.type) && fStr.includes(event.severity) && fStr.includes(event.flagText.toLowerCase());
          });
          
          if (!flagExists) {
            flags.push(flagString);
            logger.info('🚩 [WEBHOOK] ✅ Extracted flag from text', {
              callId,
              patientId: patient.id,
              flagType: event.type,
              flagSeverity: event.severity,
              flagText: event.flagText,
              matchedPattern: foundPattern.toString(),
              textSnippet: textToSearch.substring(Math.max(0, textToSearch.search(foundPattern) - 50), textToSearch.search(foundPattern) + 100),
            });
          } else {
            logger.info('🚩 [WEBHOOK] Flag already exists, skipping', {
              callId,
              patientId: patient.id,
              flagType: event.type,
              flagSeverity: event.severity,
              flagText: event.flagText,
            });
          }
        }
      }
    }
    
    // Final summary of all collected data
    logger.info('📊 [WEBHOOK] Final data summary before saving', {
      callId,
      patientId: patient.id,
      patientName: patient.name,
      totalToolCalls: toolCalls.length,
      toolCallNames: toolCalls.map(tc => tc.name),
      medsTakenCount: medsTaken.length,
      medsTaken: medsTaken.length > 0 
        ? medsTaken.map(m => `${m.medName}: ${m.taken ? 'taken' : 'not taken'}`)
        : 'NONE',
      medsTakenDetail: medsTaken.length > 0 ? JSON.stringify(medsTaken, null, 2) : 'NONE',
      flagsCount: flags.length,
      flags: flags.length > 0 ? flags : 'NONE',
      sleepHours: sleepHours ?? 'NONE',
      sleepQuality: sleepQuality || 'NONE',
      mood: resolvedMood || 'NONE',
      hasCallSummary: !!callSummary,
      callSummaryPreview: callSummary?.substring(0, 200),
      hasDailySummary: !!dailySummary,
      dailySummaryPreview: dailySummary?.substring(0, 200),
    });
    
    // Create or update call log
    const callLogData: Partial<CallLog> = {
      patient_id: patient.id,
      timestamp: context.timestamp,
      assistant_name: assistantName,
      outcome,
      transcript: transcript || null,
      mood: resolvedMood,
      sentiment_score: resolvedSentimentScore,
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
      mood: resolvedMood,
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
      hasMood: !!resolvedMood,
        medsTakenCount: medsTaken.length,
        flagsCount: flags.length,
        hasSleepHours: sleepHours !== null && sleepHours !== undefined,
      });
      
      // Save mood to mood_logs (if we have a mood)
      if (resolvedMood) {
        // Map mood from call_logs format (good/neutral/bad) to mood_logs format (happy/neutral/sad)
        const moodMapping: Record<string, string> = {
          'good': 'happy',
          'neutral': 'neutral',
          'bad': 'sad',
        };
        const moodLogValue = moodMapping[resolvedMood] || 'neutral';
        
        logger.info('💾 [WEBHOOK] Saving mood to mood_logs', {
          callId,
          patientId: patient.id,
          callLogId,
          originalMood: resolvedMood,
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
      // IMPORTANT: Save medications even if taken=false, so we track all medication statuses
      if (medsTaken && medsTaken.length > 0) {
        logger.info('💾 [WEBHOOK] Saving medications to med_logs', {
          callId,
          patientId: patient.id,
          callLogId,
          medsCount: medsTaken.length,
          meds: medsTaken.map(m => `${m.medName}: ${m.taken ? 'taken' : 'not taken'}`),
          medsDetail: JSON.stringify(medsTaken, null, 2),
        });
        
        try {
          // For each medication, upsert (update if exists for today, otherwise insert)
          const today = new Date(context.timestamp);
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          for (const med of medsTaken) {
            // Check if log already exists for today
            const { data: existing } = await supabase
              .from('med_logs')
              .select('id')
              .eq('patient_id', patient.id)
              .eq('med_name', med.medName)
              .gte('timestamp', today.toISOString())
              .lt('timestamp', tomorrow.toISOString())
              .maybeSingle();
            
            const medLogEntry = {
              patient_id: patient.id,
              med_name: med.medName.trim(),
              taken: med.taken,
              taken_at: med.taken ? (med.timestamp || context.timestamp) : null,
              timestamp: med.timestamp || context.timestamp,
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
                logger.error('❌ [WEBHOOK] Failed to update medication log', {
                  callId,
                  patientId: patient.id,
                  medName: med.medName,
                  error: updateError.message,
                  errorCode: updateError.code,
                });
              } else {
                logger.info('✅ [WEBHOOK] Updated medication log', {
                  callId,
                  patientId: patient.id,
                  medName: med.medName,
                  taken: med.taken,
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
                logger.error('❌ [WEBHOOK] Failed to insert medication log', {
                  callId,
                  patientId: patient.id,
                  medName: med.medName,
                  error: insertError.message,
                  errorCode: insertError.code,
                  errorDetails: insertError.details,
                  entry: JSON.stringify(medLogEntry, null, 2),
                });
              } else {
                logger.info('✅ [WEBHOOK] Inserted medication log', {
                  callId,
                  patientId: patient.id,
                  medName: med.medName,
                  taken: med.taken,
                  medLogId: inserted.id,
                });
              }
            }
          }
          
          logger.info('✅ [WEBHOOK] Completed saving medication logs', {
            callId,
            patientId: patient.id,
            totalMeds: medsTaken.length,
          });
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
          medsTakenArray: JSON.stringify(medsTaken),
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
          // Support both formats:
          // 1. New format: "type:severity:description" (e.g., "fall:red:Fall or slip incident")
          // 2. Old format: plain text (e.g., "fall" or "medication missed")
          const flagEntries = flags.map(flag => {
            const flagStr = String(flag);
            let type: 'fall' | 'med_missed' | 'other' = 'other';
            let severity: 'red' | 'yellow' = 'yellow';
            
            // Check if flag is in new format: "type:severity:description"
            if (flagStr.includes(':')) {
              const parts = flagStr.split(':');
              if (parts.length >= 2) {
                const flagType = parts[0].toLowerCase().trim();
                const flagSeverity = parts[1].toLowerCase().trim();
                
                // Parse type
                if (flagType === 'fall') {
                  type = 'fall';
                } else if (flagType === 'med_missed') {
                  type = 'med_missed';
                } else {
                  type = 'other';
                }
                
                // Parse severity
                if (flagSeverity === 'red') {
                  severity = 'red';
                } else {
                  severity = 'yellow';
                }
              }
            } else {
              // Old format: parse from text content
              const flagStrLower = flagStr.toLowerCase();
              if (flagStrLower.includes('fall') || flagStrLower.includes('slip')) {
                type = 'fall';
                severity = 'red';
              } else if (flagStrLower.includes('med') || flagStrLower.includes('medication')) {
                type = 'med_missed';
                severity = 'yellow';
              } else {
                // Default to 'other' with yellow severity for unknown flags
                type = 'other';
                severity = 'yellow';
              }
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
        mood: resolvedMood,
        sleepHours,
        sleepQuality,
        medsTaken,
        flags,
        summary: dailySummary || callSummary || summary,
      });
    }
    
    // Check for voice anomaly if recording is available
    // If recording URL not in webhook, try fetching from VAPI API
    let finalRecordingUrl = recordingUrl;
    if (!finalRecordingUrl && callAnswered && callId && callId !== 'unknown') {
      try {
        logger.info('Recording URL not in webhook, fetching from VAPI API', { callId });
        const { getCallStatus } = await import('../vapi/client');
        const callStatus = await getCallStatus(callId);
        
        // Try multiple possible field names for recording URL
        finalRecordingUrl = 
          (callStatus as any).recordingUrl ||
          (callStatus as any).recording?.url ||
          (callStatus as any).transcript?.audioUrl ||
          null;
        
        if (finalRecordingUrl) {
          logger.info('Recording URL fetched from VAPI API', { callId, recordingUrl: finalRecordingUrl });
        } else {
          logger.warn('Recording URL not available from VAPI API', { callId });
        }
      } catch (error: any) {
        logger.warn('Failed to fetch recording URL from VAPI API', {
          error: error.message,
          callId,
        });
      }
    }
    
    if (finalRecordingUrl && callAnswered) {
      try {
        logger.info('Starting voice anomaly check', {
          patientId: patient.id,
          callLogId,
          recordingUrl: finalRecordingUrl,
        });
        
        const anomalyResult = await checkVoiceAnomaly(
          patient.id,
          callLogId,
          finalRecordingUrl
        );
        
        if (anomalyResult.success && anomalyResult.anomalyScore !== null) {
          // Update call log with anomaly score
          await supabase
            .from('call_logs')
            .update({ anomaly_score: anomalyResult.anomalyScore })
            .eq('id', callLogId);
          
          logger.info('Voice anomaly check completed', {
            patientId: patient.id,
            callLogId,
            anomalyScore: anomalyResult.anomalyScore,
            alertType: anomalyResult.alertType,
          });
          
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
          stack: error.stack,
        });
        // Don't fail the webhook if anomaly check fails
      }
    } else if (callAnswered && !finalRecordingUrl) {
      logger.warn('Voice anomaly check skipped - no recording URL available', {
        patientId: patient.id,
        callId,
        callAnswered,
      });
    }
    
    const webhookDuration = Date.now() - webhookStartTime;
    
    logger.info('✅ [WEBHOOK] VAPI webhook processed successfully - FINAL SUMMARY', {
      callId,
      patientId: patient.id,
      patientName: patient.name,
      callLogId,
      outcome,
      callAnswered,
      mood: resolvedMood,
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

