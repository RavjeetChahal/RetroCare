import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { checkVoiceAnomaly } from './anomalyService';
import { getAnomalyLogsForPatient } from '../supabase/anomalyLogs';
import { checkPythonServiceHealth } from './pythonClient';
import axios from 'axios';

const router = Router();

/**
 * POST /api/anomaly-check
 * Check voice anomaly for a patient after a call
 * 
 * Request body:
 * {
 *   "patientId": "uuid",
 *   "callLogId": "uuid (optional)",
 *   "audioUrl": "https://..."
 * }
 */
router.post('/anomaly-check', async (req: Request, res: Response) => {
  try {
    const { patientId, callLogId, audioUrl } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl is required' });
    }
    
    logger.info('Anomaly check request', { patientId, callLogId, hasAudioUrl: !!audioUrl });
    
    const result = await checkVoiceAnomaly(patientId, callLogId, audioUrl);
    
    if (!result.success) {
      logger.warn('Anomaly check failed', { patientId, error: result.error });
      return res.status(500).json({
        success: false,
        error: result.error || 'Anomaly check failed',
      });
    }
    
    res.json({
      success: true,
      anomalyScore: result.anomalyScore,
      rawSimilarity: result.rawSimilarity,
      normalizedScore: result.normalizedScore,
      snr: result.snr,
      alertType: result.alertType,
      logId: result.logId,
    });
  } catch (error: any) {
    logger.error('Error in anomaly-check endpoint', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/anomaly-logs/:patientId
 * Get anomaly logs for a patient
 * 
 * Response:
 * {
 *   "logs": [...]
 * }
 */
router.get('/anomaly-logs/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    
    logger.info('Fetching anomaly logs', { patientId });
    
    const logs = await getAnomalyLogsForPatient(patientId);
    
    // Transform to match frontend expectations
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      patientId: log.patient_id,
      callLogId: log.call_log_id,
      timestamp: log.timestamp,
      anomalyScore: log.anomaly_score,
      rawSimilarity: log.raw_similarity,
      normalizedScore: log.normalized_score,
      snr: log.snr,
      alertSent: log.alert_sent,
      alertType: log.alert_type,
      notes: log.notes,
    }));
    
    res.json({ logs: transformedLogs });
  } catch (error: any) {
    logger.error('Error fetching anomaly logs', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/python-service-status
 * Check Python service connectivity (quick diagnostic)
 */
router.get('/python-service-status', async (req: Request, res: Response) => {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  
  const status: any = {
    configuredUrl: pythonServiceUrl,
    timestamp: new Date().toISOString(),
    tests: {},
  };
  
  // Test 1: Health check
  try {
    const isHealthy = await checkPythonServiceHealth();
    status.tests.healthCheck = {
      status: 'success',
      isHealthy,
    };
  } catch (error: any) {
    status.tests.healthCheck = {
      status: 'failed',
      error: error.message,
      code: error.code,
    };
  }
  
  // Test 2: Direct HTTP
  try {
    const response = await axios.get(`${pythonServiceUrl}/health`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    status.tests.directHttp = {
      status: 'success',
      statusCode: response.status,
    };
  } catch (error: any) {
    status.tests.directHttp = {
      status: 'failed',
      error: error.message,
      code: error.code,
    };
  }
  
  // Summary
  const allPassed = Object.values(status.tests).every((t: any) => t.status === 'success');
  status.summary = {
    allTestsPassed: allPassed,
    status: allPassed ? 'healthy' : 'unhealthy',
    recommendation: allPassed 
      ? 'Python service is accessible'
      : 'Python service is not reachable. Check PYTHON_SERVICE_URL environment variable and ensure service is running.',
  };
  
  res.status(allPassed ? 200 : 503).json(status);
});

export default router;

