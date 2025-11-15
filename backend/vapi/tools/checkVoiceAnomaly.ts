/**
 * VAPI Tool: checkVoiceAnomaly
 * 
 * Triggers voice anomaly detection check
 */

import { logger } from '../../utils/logger';
import type { ToolContext } from './index';

export async function checkVoiceAnomaly(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const { audioUrl } = parameters;
    
    if (!audioUrl) {
      return { success: false, error: 'audioUrl is required' };
    }
    
    // This will be handled by the webhook after the call ends
    // The webhook will extract the audio URL and call the anomaly service
    // This tool just acknowledges the request
    
    logger.info('Voice anomaly check requested', {
      patientId: context.patientId,
      audioUrl: audioUrl as string,
      callId: context.callId,
    });
    
    return {
      success: true,
      result: {
        message: 'Voice anomaly check will be performed after call ends',
        audioUrl: audioUrl as string,
      },
    };
  } catch (error: any) {
    logger.error('Error requesting voice anomaly check', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

