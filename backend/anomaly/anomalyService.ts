import { extractEmbedding, compareEmbeddings } from './pythonClient';
import { getSupabaseClient } from '../supabase/client';
import { createAnomalyLog } from '../supabase/anomalyLogs';
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
 * Get or create baseline embedding for a patient
 * 
 * Strategy: Use first successful call as baseline if no baseline exists
 * TODO: Could also capture during onboarding
 */
async function getOrCreateBaseline(patientId: string): Promise<number[] | null> {
  const supabase = getSupabaseClient();
  
  // Check if patient has baseline_embedding_url stored
  const { data: patient } = await supabase
    .from('patients')
    .select('baseline_embedding_url')
    .eq('id', patientId)
    .single();
  
  if (patient?.baseline_embedding_url) {
    // TODO: Load baseline from storage URL
    // For now, return null to indicate we need to create baseline from first call
    logger.info('Baseline URL found but loading not implemented', { patientId });
    return null;
  }
  
  // Check if we have any previous anomaly logs with embeddings
  // Use the first call's embedding as baseline
  const { data: firstLog } = await supabase
    .from('voice_anomaly_logs')
    .select('current_embedding_url')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: true })
    .limit(1)
    .single();
  
  if (firstLog?.current_embedding_url) {
    // TODO: Load embedding from URL
    logger.info('First call embedding found but loading not implemented', { patientId });
    return null;
  }
  
  // No baseline exists - will be created from this call
  return null;
}

/**
 * Store embedding (placeholder - implement with actual storage solution)
 */
async function storeEmbedding(embedding: number[], patientId: string, isBaseline: boolean): Promise<string | null> {
  // TODO: Implement actual storage (Supabase Storage, S3, etc.)
  // For now, return null
  logger.debug('Embedding storage not implemented', { patientId, isBaseline });
  return null;
}

/**
 * Load embedding from URL (placeholder)
 */
async function loadEmbeddingFromUrl(url: string): Promise<number[] | null> {
  // TODO: Implement actual loading from storage
  logger.debug('Embedding loading not implemented', { url });
  return null;
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
    
    // 3. If no baseline exists, use this call as baseline
    if (!baselineEmbedding) {
      logger.info('No baseline found, using current call as baseline', { patientId });
      baselineEmbedding = currentEmbedding;
      
      // Store as baseline for future use
      baselineUrl = await storeEmbedding(currentEmbedding, patientId, true);
      
      // Update patient record with baseline URL
      if (baselineUrl) {
        await getSupabaseClient()
          .from('patients')
          .update({ baseline_embedding_url: baselineUrl })
          .eq('id', patientId);
      }
      
      // For first call, no anomaly to report (it IS the baseline)
      logger.info('First call - no anomaly to check', { patientId });
      
      return {
        success: true,
        anomalyScore: 0.0,
        rawSimilarity: 1.0,
        normalizedScore: 0.0,
        snr,
        alertType: null,
      };
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
 * Send anomaly alert notification (placeholder)
 * 
 * TODO: Implement actual notification system (email, push, SMS, etc.)
 */
async function sendAnomalyAlert(
  patientId: string,
  score: number,
  type: 'warning' | 'emergency'
): Promise<void> {
  // TODO: Implement notification system
  // Options:
  // - Email to caregiver
  // - Push notification
  // - SMS
  // - In-app notification
  
  logger.info('Anomaly alert triggered', {
    patientId,
    score,
    type,
    message: `Voice anomaly detected: ${type} level (score: ${score.toFixed(2)})`,
  });
  
  // For now, just log. In production, implement actual notification.
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

