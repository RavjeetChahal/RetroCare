import { Router } from 'express';
import { checkPythonServiceHealth } from '../anomaly/pythonClient';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/diagnostics
 * 
 * List available diagnostic endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Diagnostics endpoints available',
    endpoints: {
      pythonService: '/api/diagnostics/python-service',
      health: '/api/diagnostics/health',
    },
  });
});

/**
 * GET /api/diagnostics/health
 * 
 * Simple health check for diagnostics router
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Diagnostics router is working',
  });
});

/**
 * GET /api/diagnostics/python-service
 * 
 * Diagnostic endpoint to check Python service connectivity
 * Useful for debugging connection issues in production
 */
router.get('/python-service', async (req, res) => {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  
  const diagnostics: any = {
    configuredUrl: pythonServiceUrl,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    tests: {},
  };
  
  // Test 1: Health check using our client function
  try {
    logger.info('Running Python service health check', { pythonServiceUrl });
    const isHealthy = await checkPythonServiceHealth();
    diagnostics.tests.healthCheck = {
      status: 'success',
      isHealthy,
      message: isHealthy ? 'Service is healthy' : 'Service returned unhealthy status',
    };
  } catch (error: any) {
    diagnostics.tests.healthCheck = {
      status: 'failed',
      error: error.message,
      code: error.code,
      message: 'Health check failed - service may not be reachable',
    };
  }
  
  // Test 2: Direct HTTP request to /health endpoint
  try {
    logger.info('Testing direct HTTP connection to Python service', { pythonServiceUrl });
    const response = await axios.get(`${pythonServiceUrl}/health`, {
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    });
    diagnostics.tests.directHttp = {
      status: 'success',
      statusCode: response.status,
      responseTime: response.headers['x-response-time'] || 'unknown',
      data: response.data,
      message: `HTTP ${response.status} - ${response.status >= 400 ? 'Error' : 'OK'}`,
    };
  } catch (error: any) {
    diagnostics.tests.directHttp = {
      status: 'failed',
      error: error.message,
      code: error.code,
      statusCode: error.response?.status,
      message: getErrorMessage(error.code),
    };
  }
  
  // Test 3: Try /embed endpoint (without actually processing)
  // This tests if the endpoint exists and accepts requests
  try {
    logger.info('Testing /embed endpoint availability', { pythonServiceUrl });
    const response = await axios.post(
      `${pythonServiceUrl}/embed`,
      {
        audio_url: 'https://example.com/test.wav', // Dummy URL - will fail but tests connectivity
        sample_rate: 16000,
      },
      {
        timeout: 5000,
        validateStatus: () => true,
      }
    );
    diagnostics.tests.embedEndpoint = {
      status: 'success',
      statusCode: response.status,
      message: response.status >= 400 
        ? 'Endpoint exists but returned error (expected for dummy URL)'
        : 'Endpoint responded successfully',
    };
  } catch (error: any) {
    diagnostics.tests.embedEndpoint = {
      status: 'failed',
      error: error.message,
      code: error.code,
      message: getErrorMessage(error.code),
    };
  }
  
  // Summary
  const allTestsPassed = Object.values(diagnostics.tests).every(
    (test: any) => test.status === 'success'
  );
  
  diagnostics.summary = {
    allTestsPassed,
    status: allTestsPassed ? 'healthy' : 'unhealthy',
    recommendation: getRecommendation(diagnostics.tests),
  };
  
  // Return appropriate status code
  const statusCode = allTestsPassed ? 200 : 503;
  res.status(statusCode).json(diagnostics);
});

function getErrorMessage(code?: string): string {
  switch (code) {
    case 'ECONNREFUSED':
      return 'Connection refused - service is not running or URL is incorrect';
    case 'ENOTFOUND':
      return 'DNS lookup failed - hostname not found';
    case 'ETIMEDOUT':
      return 'Connection timed out - service may be overloaded or unreachable';
    case 'ECONNRESET':
      return 'Connection reset by server';
    default:
      return 'Connection failed - check service URL and network';
  }
}

function getRecommendation(tests: any): string {
  if (tests.healthCheck?.status === 'failed' && tests.directHttp?.status === 'failed') {
    if (tests.directHttp?.code === 'ECONNREFUSED' || tests.directHttp?.code === 'ENOTFOUND') {
      return 'Python service is not reachable. Check: 1) Service is deployed and running, 2) PYTHON_SERVICE_URL is correct, 3) Service is publicly accessible';
    }
    if (tests.directHttp?.code === 'ETIMEDOUT') {
      return 'Python service is timing out. Check: 1) Service has enough resources, 2) Network connectivity, 3) Firewall rules';
    }
  }
  
  if (tests.healthCheck?.status === 'success' && tests.directHttp?.status === 'success') {
    return 'Python service is accessible and healthy';
  }
  
  if (tests.healthCheck?.isHealthy === false) {
    return 'Python service is reachable but reporting unhealthy status. Check service logs';
  }
  
  return 'Partial connectivity detected. Review individual test results above';
}

export default router;

