/**
 * Voice Anomaly Detection Module
 * 
 * Exports for the anomaly detection system
 */
export { checkVoiceAnomaly, isAnomalyServiceAvailable } from './anomalyService';
export { extractEmbedding, compareEmbeddings, checkPythonServiceHealth } from './pythonClient';
export {
  createAnomalyLog,
  getAnomalyLogsForPatient,
  getRecentAnomalyLogs,
  updateAnomalyLog,
  getAnomalyLogsByAlertType,
} from '../supabase/anomalyLogs';
export type { VoiceAnomalyLog, NewAnomalyLog } from '../supabase/anomalyLogs';
export type { AnomalyCheckResult } from './anomalyService';

