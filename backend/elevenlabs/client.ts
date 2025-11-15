import axios from 'axios';
import { logger } from '../utils/logger';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
// Backend should only use ELEVENLABS_API_KEY from backend/.env
// Never use EXPO_PUBLIC_ELEVENLABS_KEY in backend code
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Request queue to handle concurrent request limit (max 1 concurrent request)
// This ensures we don't exceed ElevenLabs' concurrent request limit
let requestQueue: Array<{
  resolve: (value: ArrayBuffer) => void;
  reject: (error: Error) => void;
  voiceId: string;
  text: string;
  apiKey: string;
}> = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const request = requestQueue.shift();

  if (!request) {
    isProcessing = false;
    return;
  }

  try {
    const { voiceId, text, apiKey, resolve, reject } = request;
    
    logger.info('Processing ElevenLabs request from queue', {
      voiceId,
      textLength: text.length,
      queueLength: requestQueue.length,
    });

    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        text,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.7,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey.trim(),
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    resolve(response.data);
  } catch (error: any) {
    const { reject } = request;
    
    // Handle error with detailed logging
    const errorResponse = error.response?.data;
    let errorMessage = '';
    let errorDetail: any = null;
    
    if (errorResponse) {
      // Handle Buffer/ArrayBuffer responses (from axios with responseType: 'arraybuffer')
      if (Buffer.isBuffer(errorResponse) || errorResponse instanceof ArrayBuffer) {
        try {
          const buffer = Buffer.isBuffer(errorResponse) ? errorResponse : Buffer.from(errorResponse);
          const jsonString = buffer.toString('utf-8');
          errorDetail = JSON.parse(jsonString);
        } catch {
          errorMessage = errorResponse.toString();
        }
      } else if (typeof errorResponse === 'string') {
        try {
          errorDetail = JSON.parse(errorResponse);
        } catch {
          errorMessage = errorResponse;
        }
      } else {
        errorDetail = errorResponse;
      }
    }
    
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: errorDetail?.message || errorDetail?.detail?.message || errorMessage || error.message,
      detail: errorDetail?.detail,
      voiceId: request.voiceId,
      apiKeyPrefix: request.apiKey.substring(0, 10) + '...',
      fullError: errorDetail,
    };
    
    logger.error('ElevenLabs preview generation failed', errorDetails);
    
    // Create appropriate error message
    let finalError: Error;
    
    if (errorDetail?.detail?.status === 'quota_exceeded' || errorDetail?.message?.includes('quota') || errorMessage?.includes('quota')) {
      finalError = new Error(
        `ElevenLabs API quota exceeded. ${errorDetail?.detail?.message || errorDetail?.message || errorMessage || 'Please check your ElevenLabs account quota.'}`,
      );
    } else if (error.response?.status === 401) {
      const detailMessage = errorDetail?.detail?.message || errorDetail?.message || errorMessage;
      if (detailMessage?.includes('permission')) {
        finalError = new Error(
          `ElevenLabs API key missing required permissions. ${detailMessage}. Please check your API key permissions in the ElevenLabs dashboard.`,
        );
      } else if (detailMessage?.includes('quota') || detailMessage?.includes('credit')) {
        finalError = new Error(
          `ElevenLabs API quota/credit limit reached. ${detailMessage}. Please check your ElevenLabs account quota.`,
        );
      } else {
        finalError = new Error(
          `ElevenLabs API authentication failed (401). ${detailMessage || 'Please verify your ELEVENLABS_API_KEY in backend/.env has "Text to Speech" permission enabled.'}`,
        );
      }
    } else if (error.response?.status === 404) {
      finalError = new Error(
        `ElevenLabs voice ID not found (404). Voice ID "${request.voiceId}" may be invalid.`,
      );
    } else {
      finalError = new Error(
        `ElevenLabs preview failed: ${errorDetail?.detail?.message || errorDetail?.message || errorMessage || error.message}`,
      );
    }
    
    reject(finalError);
  } finally {
    isProcessing = false;
    // Process next request in queue after a small delay
    if (requestQueue.length > 0) {
      setTimeout(() => processQueue(), 100);
    }
  }
}

/**
 * Generate voice preview using ElevenLabs
 */
export async function generateVoicePreview(
  voiceId: string,
  text: string,
): Promise<ArrayBuffer> {
  // Get API key from environment (loaded from backend/.env by server.ts)
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  
  if (!apiKey) {
    logger.error('ELEVENLABS_API_KEY is not set in backend/.env', {
      envKeys: Object.keys(process.env).filter(k => k.includes('ELEVEN')),
      hasKey: !!process.env.ELEVENLABS_API_KEY,
      keyLength: process.env.ELEVENLABS_API_KEY?.length,
    });
    throw new Error('ELEVENLABS_API_KEY environment variable is not set. Please check backend/.env file.');
  }

  // Use request queue to handle concurrent request limit (max 1 concurrent)
  return new Promise<ArrayBuffer>((resolve, reject) => {
    requestQueue.push({ resolve, reject, voiceId, text, apiKey });
    logger.info('Added request to queue', {
      voiceId,
      textLength: text.length,
      queueLength: requestQueue.length,
    });
    processQueue();
  });
}

/**
 * Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

