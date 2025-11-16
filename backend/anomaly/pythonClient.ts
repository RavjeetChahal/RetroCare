import axios from 'axios';
import { logger } from '../utils/logger';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export interface EmbeddingResponse {
  embedding: number[];
  snr: number;
  sample_rate: number;
}

export interface CompareResponse {
  score: number; // anomaly score 0.0-1.0
  raw_similarity: number; // cosine similarity
  normalized: number; // after noise/time adjustments
  snr: number;
}

/**
 * Extract voice embedding from audio URL using Python service
 */
export async function extractEmbedding(audioUrl: string): Promise<EmbeddingResponse> {
  try {
    logger.info('Extracting embedding from Python service', { 
      audioUrl,
      pythonServiceUrl: PYTHON_SERVICE_URL,
    });
    
    const response = await axios.post<EmbeddingResponse>(
      `${PYTHON_SERVICE_URL}/embed`,
      {
        audio_url: audioUrl,
        sample_rate: 16000,
      },
      {
        timeout: 60000, // 60 second timeout for audio processing
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );
    
    // Check for HTTP error status
    if (response.status >= 400) {
      throw new Error(
        `Python service returned ${response.status}: ${JSON.stringify(response.data)}`
      );
    }

    logger.info('Embedding extracted successfully', {
      embeddingLength: response.data.embedding.length,
      snr: response.data.snr,
    });

    return response.data;
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: `${PYTHON_SERVICE_URL}/embed`,
      audioUrl,
    };
    
    logger.error('Failed to extract embedding from Python service', errorDetails);
    
    // Provide more helpful error messages
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(
        `Python service not reachable at ${PYTHON_SERVICE_URL}. Is the service running?`
      );
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(
        `Python service request timed out after 60s. The service may be overloaded or the audio file is too large.`
      );
    } else if (error.response?.status) {
      throw new Error(
        `Python service returned error ${error.response.status}: ${error.response?.data?.detail || error.response.statusText}`
      );
    } else {
      throw new Error(
        `Python service embedding extraction failed: ${error.response?.data?.detail || error.message || 'Unknown error'}`
      );
    }
  }
}

/**
 * Compare baseline and current embeddings using Python service
 */
export async function compareEmbeddings(
  baseline: number[],
  current: number[],
  snr: number,
  hour?: number
): Promise<CompareResponse> {
  try {
    logger.info('Comparing embeddings via Python service', {
      baselineLength: baseline.length,
      currentLength: current.length,
      snr,
      hour,
    });

    const response = await axios.post<CompareResponse>(
      `${PYTHON_SERVICE_URL}/compare`,
      {
        baseline,
        current,
        snr,
        hour: hour ?? null,
      },
      {
        timeout: 30000, // 30 second timeout
      }
    );

    logger.info('Embedding comparison complete', {
      anomalyScore: response.data.score,
      similarity: response.data.raw_similarity,
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to compare embeddings via Python service', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(
      `Python service comparison failed: ${error.response?.data?.detail || error.message}`
    );
  }
}

/**
 * Health check for Python service
 */
export async function checkPythonServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return response.data.status === 'ok';
  } catch (error: any) {
    logger.warn('Python service health check failed', error.message);
    return false;
  }
}

