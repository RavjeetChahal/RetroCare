import { extractEmbedding, compareEmbeddings } from './pythonClient';
import { getSupabaseClient } from '../supabase/client';
import { createAnomalyLog } from '../supabase/anomalyLogs';
import { getVoiceBaseline, saveVoiceBaseline } from '../supabase/voiceBaseline';
import { logger } from '../utils/logger';
import type { Patient } from '../supabase/types';

export interface AnomalyCheckResult {
  success: boolean;
  anomalyScore: number;
  rawSimilarity: number;
  normalizedScore: number;
  snr: number;
  alertType: 'warning' | 'emergency' | null;
  logId?: string;
  error?: string;
}

/**
 * Determine alert type based on anomaly score
 */
function determineAlertType(score: number): 'warning' | 'emergency' | null {
  if (score > 0.40) {
    return 'emergency';
  }
  if (score > 0.25) {
    return 'warning';
  }
  return null;
}

/**
 * Check if patient is healthy (no sick/illness flags)
 */
async function isPatientHealthy(patientId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  // Check patient flags for any health-related issues
  const { data: patient } = await supabase
    .from('patients')
    .select('flags')
    .eq('id', patientId)
    .single();
  
  if (!patient) {
    logger.warn('Patient not found when checking health status', { patientId });
    return false;
  }
  
  const flags = Array.isArray(patient.flags) ? patient.flags : [];
  const flagStrings = flags.map(f => String(f).toLowerCase());
  
  // Check for health-related flags that indicate sickness
  const sickIndicators = [
    'sick', 'illness', 'ill', 'unwell', 'not feeling well', 
    'feeling bad', 'pain', 'hurt', 'fever', 'cough',
    'cold', 'flu', 'infection', 'symptoms'
  ];
  
  const hasSickFlag = flagStrings.some(flag => 
    sickIndicators.some(indicator => flag.includes(indicator))
  );
  
  if (hasSickFlag) {
    logger.info('Patient has sick flags, not storing baseline', { 
      patientId, 
      flags: flagStrings 
    });
    return false;
  }
  
  // Also check health_flags table for unresolved health issues
  const { data: healthFlags } = await supabase
    .from('health_flags')
    .select('flag')
    .eq('patient_id', patientId)
    .eq('resolved', false);
  
  if (healthFlags && healthFlags.length > 0) {
    const healthFlagStrings = healthFlags.map(hf => String(hf.flag).toLowerCase());
    const hasSickHealthFlag = healthFlagStrings.some(flag =>
      sickIndicators.some(indicator => flag.includes(indicator))
    );
    
    if (hasSickHealthFlag) {
      logger.info('Patient has unresolved health flags, not storing baseline', {
        patientId,
        healthFlags: healthFlagStrings
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Get or create baseline embedding for a patient
 * 
 * Strategy: Use first successful call as baseline if:
 * - No baseline exists
 * - Patient is healthy (no sick flags)
 */
async function getOrCreateBaseline(patientId: string): Promise<number[] | null> {
  const supabase = getSupabaseClient();
  
  // Check if baseline already exists in patient_voice_baseline table
  const existingBaseline = await getVoiceBaseline(patientId);
  
  if (existingBaseline?.embedding) {
    // Parse the embedding from JSON string
    try {
      const embedding = typeof existingBaseline.embedding === 'string' 
        ? JSON.parse(existingBaseline.embedding)
        : existingBaseline.embedding;
      
      if (Array.isArray(embedding) && embedding.length > 0) {
        logger.info('Baseline embedding found', { 
          patientId, 
          embeddingLength: embedding.length 
        });
        return embedding;
      }
    } catch (error) {
      logger.error('Failed to parse baseline embedding', { 
        patientId, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Check if we have any previous call logs (to determine if this is first call)
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('id')
    .eq('patient_id', patientId)
    .eq('outcome', 'answered')
    .limit(1);
  
  const isFirstCall = !callLogs || callLogs.length === 0;
  
  if (!isFirstCall) {
    logger.info('Not first call, baseline should already exist', { patientId });
    return null;
  }
  
  // This is the first call - check if patient is healthy before storing baseline
  const isHealthy = await isPatientHealthy(patientId);
  
  if (!isHealthy) {
    logger.info('First call but patient is not healthy, skipping baseline storage', { 
      patientId 
    });
    return null;
  }
  
  // No baseline exists and patient is healthy - will be created from this call
  logger.info('First call and patient is healthy - will create baseline', { patientId });
  return null;
}

/**
 * Store embedding vector in database
 * For baseline: stores in patient_voice_baseline table
 * For current calls: stores URL reference (can be extended to store full embedding if needed)
 */
async function storeEmbedding(
  embedding: number[], 
  patientId: string, 
  isBaseline: boolean
): Promise<string | null> {
  try {
    if (isBaseline) {
      // Store baseline embedding directly in patient_voice_baseline table
      await saveVoiceBaseline(patientId, embedding, null);
      logger.info('Baseline embedding stored', { 
        patientId, 
        embeddingLength: embedding.length 
      });
      return 'stored_in_db'; // Return identifier that it's stored in DB
    } else {
      // For current call embeddings, we could store them too if needed
      // For now, just return null as we don't need to store every call's embedding
      logger.debug('Current call embedding not stored (only baseline stored)', { 
        patientId 
      });
      return null;
    }
  } catch (error: any) {
    logger.error('Failed to store embedding', {
      patientId,
      isBaseline,
      error: error.message,
    });
    return null;
  }
}

/**
 * Check voice anomaly for a patient after a call
 * 
 * @param patientId - Patient ID
 * @param callLogId - Call log ID (optional)
 * @param audioUrl - URL to audio recording from VAPI
 */
export async function checkVoiceAnomaly(
  patientId: string,
  callLogId: string | undefined,
  audioUrl: string
): Promise<AnomalyCheckResult> {
  try {
    logger.info('Starting voice anomaly check', { patientId, callLogId, audioUrl });
    
    // 1. Get or create baseline embedding
    let baselineEmbedding = await getOrCreateBaseline(patientId);
    let baselineUrl: string | null = null;
    
    // 2. Extract current call embedding
    logger.info('Extracting embedding from current call audio');
    const { embedding: currentEmbedding, snr } = await extractEmbedding(audioUrl);
    
    // 3. If no baseline exists, check if we should create one
    if (!baselineEmbedding) {
      // Check if this is the first call and patient is healthy
      const isHealthy = await isPatientHealthy(patientId);
      const { data: callLogs } = await getSupabaseClient()
        .from('call_logs')
        .select('id')
        .eq('patient_id', patientId)
        .eq('outcome', 'answered')
        .limit(1);
      
      const isFirstCall = !callLogs || callLogs.length === 0;
      
      if (isFirstCall && isHealthy) {
        logger.info('First call and patient is healthy - storing baseline', { patientId });
        baselineEmbedding = currentEmbedding;
        
        // Store as baseline embedding vector in database
        baselineUrl = await storeEmbedding(currentEmbedding, patientId, true);
        
        // Update patient record with baseline URL reference (for backward compatibility)
        if (baselineUrl) {
          await getSupabaseClient()
            .from('patients')
            .update({ baseline_embedding_url: baselineUrl })
            .eq('id', patientId);
        }
        
        // For first call, no anomaly to report (it IS the baseline)
        logger.info('First call baseline stored - no anomaly to check', { patientId });
        
        return {
          success: true,
          anomalyScore: 0.0,
          rawSimilarity: 1.0,
          normalizedScore: 0.0,
          snr,
          alertType: null,
        };
      } else {
        // Not first call or patient is not healthy - can't create baseline
        logger.info('Cannot create baseline', { 
          patientId, 
          isFirstCall, 
          isHealthy,
          reason: !isFirstCall ? 'not first call' : 'patient not healthy'
        });
        
        // Return success but with no comparison (baseline will be created later when healthy)
        return {
          success: true,
          anomalyScore: 0.0,
          rawSimilarity: 1.0,
          normalizedScore: 0.0,
          snr,
          alertType: null,
        };
      }
    }
    
    // 4. Compare embeddings
    const hour = new Date().getHours();
    logger.info('Comparing embeddings', { hour });
    const comparison = await compareEmbeddings(
      baselineEmbedding,
      currentEmbedding,
      snr,
      hour
    );
    
    // 5. Determine alert type
    const alertType = determineAlertType(comparison.score);
    
    // 6. Store current embedding
    const currentEmbeddingUrl = await storeEmbedding(currentEmbedding, patientId, false);
    
    // 7. Save anomaly log
    const log = await createAnomalyLog({
      patient_id: patientId,
      call_log_id: callLogId,
      anomaly_score: comparison.score,
      raw_similarity: comparison.raw_similarity,
      normalized_score: comparison.normalized,
      snr: comparison.snr,
      alert_type: alertType,
      baseline_embedding_url: baselineUrl,
      current_embedding_url: currentEmbeddingUrl,
    });
    
    // 8. Send alert if needed (optional - can be handled separately)
    if (alertType) {
      await sendAnomalyAlert(patientId, comparison.score, alertType);
    }
    
    logger.info('Anomaly check complete', {
      patientId,
      anomalyScore: comparison.score,
      alertType,
      logId: log.id,
    });
    
    return {
      success: true,
      anomalyScore: comparison.score,
      rawSimilarity: comparison.raw_similarity,
      normalizedScore: comparison.normalized,
      snr: comparison.snr,
      alertType,
      logId: log.id,
    };
  } catch (error: any) {
    logger.error('Anomaly check failed', {
      patientId,
      callLogId,
      error: error.message,
      stack: error.stack,
    });
    
    return {
      success: false,
      anomalyScore: 0,
      rawSimilarity: 0,
      normalizedScore: 0,
      snr: 0,
      alertType: null,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send anomaly alert notification to caregiver
 */
async function sendAnomalyAlert(
  patientId: string,
  score: number,
  type: 'warning' | 'emergency'
): Promise<void> {
  try {
    // Get patient name for the message
    const supabase = getSupabaseClient();
    const { data: patient } = await supabase
      .from('patients')
      .select('name')
      .eq('id', patientId)
      .single();
    
    const patientName = patient?.name || 'Patient';
    const priority = type === 'emergency' ? 'emergency' : 'high';
    const message = `Voice anomaly detected for ${patientName}. Anomaly score: ${score.toFixed(2)} (${type} level). Their voice sounds different from baseline - please check in.`;
    
    // Use the notifyCaregiver tool to send the alert
    const { routeToolCall } = await import('../vapi/tools');
    await routeToolCall(
      {
        name: 'notifyCaregiver',
        parameters: {
          message,
          priority,
        },
      },
      {
        patientId,
        callId: 'anomaly-alert',
        assistantName: 'System',
        timestamp: new Date().toISOString(),
      }
    );
    
    logger.info('Anomaly alert sent to caregiver', {
      patientId,
      score,
      type,
      priority,
    });
  } catch (error: any) {
    logger.error('Failed to send anomaly alert', {
      patientId,
      score,
      type,
      error: error.message,
    });
    // Don't throw - alert failure shouldn't break the anomaly check
  }
}

/**
 * Check if Python service is available
 */
export async function isAnomalyServiceAvailable(): Promise<boolean> {
  try {
    const { checkPythonServiceHealth } = await import('./pythonClient');
    return await checkPythonServiceHealth();
  } catch (error) {
    logger.warn('Python service health check failed', error);
    return false;
  }
}

