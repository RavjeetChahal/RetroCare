import axios from 'axios';
import { logger } from '../../utils';

const VAPI_BASE_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;

export interface VAPICallRequest {
  phoneNumberId: string;
  customer: {
    number: string;
  };
  assistantId?: string;
  assistantOverrides?: {
    firstMessage?: string;
    model?: {
      provider: string;
      model: string;
      messages: Array<{
        role: string;
        content: string;
      }>;
    };
    voice?: {
      provider: string;
      voiceId: string;
    };
  };
}

export interface VAPICallResponse {
  id: string;
  status: string;
  customer?: {
    number: string;
  };
  endedReason?: string;
  transcript?: string;
  summary?: string;
}

/**
 * Make an outbound call using VAPI
 */
export async function makeOutboundCall(request: VAPICallRequest): Promise<VAPICallResponse> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY environment variable is not set');
  }

  try {
    const response = await axios.post(`${VAPI_BASE_URL}/call`, request, {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info('VAPI call initiated', { callId: response.data.id });
    return response.data;
  } catch (error: any) {
    logger.error('VAPI call failed', error.response?.data || error.message);
    throw new Error(`VAPI call failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get call status from VAPI
 */
export async function getCallStatus(callId: string): Promise<VAPICallResponse> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY environment variable is not set');
  }

  try {
    const response = await axios.get(`${VAPI_BASE_URL}/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to get VAPI call status', error.response?.data || error.message);
    throw new Error(`Failed to get call status: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Create a call with retry logic (2 attempts, 5 minutes apart)
 */
export async function makeCallWithRetry(
  request: VAPICallRequest,
  retryDelayMs: number = 5 * 60 * 1000, // 5 minutes
): Promise<{ success: boolean; callId?: string; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      logger.info(`VAPI call attempt ${attempt}/2`, { phoneNumber: request.customer.number });
      const response = await makeOutboundCall(request);

      // Wait a bit and check if call was successful
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await getCallStatus(response.id);

      // Check if call was answered (not voicemail)
      if (status.status === 'ended' && status.endedReason !== 'voicemail') {
        logger.info('VAPI call successful', { callId: response.id, attempt });
        return { success: true, callId: response.id };
      }

      if (status.endedReason === 'voicemail') {
        logger.warn('Call went to voicemail, will retry', { callId: response.id, attempt });
        lastError = 'voicemail';
      } else {
        logger.warn('Call ended unexpectedly', { callId: response.id, status: status.status });
        lastError = status.endedReason || 'unknown';
      }
    } catch (error: any) {
      logger.error(`VAPI call attempt ${attempt} failed`, error.message);
      lastError = error.message;
    }

    // Wait before retry (except on last attempt)
    if (attempt < 2) {
      logger.info(`Waiting ${retryDelayMs / 1000}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  logger.error('All VAPI call attempts failed', { phoneNumber: request.customer.number });
  return { success: false, error: lastError };
}

