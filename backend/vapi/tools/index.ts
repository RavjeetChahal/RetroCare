/**
 * VAPI Tool Router
 * 
 * Routes VAPI tool calls to appropriate handlers
 */

import { logger } from '../../utils/logger';
import { storeDailyCheckIn } from './storeDailyCheckIn';
import { updateFlags } from './updateFlags';
import { markMedicationStatus } from './markMedicationStatus';
import { logCallAttempt } from './logCallAttempt';
import { notifyCaregiver } from './notifyCaregiver';
import { checkVoiceAnomaly } from './checkVoiceAnomaly';

export type VAPIToolCall = {
  name: string;
  parameters: Record<string, unknown>;
};

export type ToolContext = {
  patientId: string;
  callId: string;
  assistantName: string;
  timestamp: string;
};

/**
 * Route a VAPI tool call to the appropriate handler
 */
export async function routeToolCall(
  toolCall: VAPIToolCall,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { name, parameters } = toolCall;
  
  logger.info('Routing VAPI tool call', {
    toolName: name,
    patientId: context.patientId,
    callId: context.callId,
  });
  
  try {
    switch (name) {
      case 'storeDailyCheckIn':
        return await storeDailyCheckIn(parameters, context);
      
      case 'updateFlags':
        return await updateFlags(parameters, context);
      
      case 'markMedicationStatus':
        return await markMedicationStatus(parameters, context);
      
      case 'logCallAttempt':
        return await logCallAttempt(parameters, context);
      
      case 'notifyCaregiver':
        return await notifyCaregiver(parameters, context);
      
      case 'checkVoiceAnomaly':
        return await checkVoiceAnomaly(parameters, context);
      
      default:
        logger.warn('Unknown VAPI tool', { toolName: name });
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error: any) {
    logger.error('Error routing tool call', {
      toolName: name,
      error: error.message,
      patientId: context.patientId,
    });
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}

