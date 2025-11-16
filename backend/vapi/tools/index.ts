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
  const routeStartTime = Date.now();
  
  logger.info('🔀 [TOOL ROUTER] Routing VAPI tool call', {
    toolName: name,
    patientId: context.patientId,
    callId: context.callId,
    assistantName: context.assistantName,
    timestamp: context.timestamp,
    parameterKeys: Object.keys(parameters || {}),
    parameterCount: Object.keys(parameters || {}).length,
    parameters: JSON.stringify(parameters, null, 2),
  });
  
  try {
    let result: { success: boolean; result?: unknown; error?: string };
    
    switch (name) {
      case 'storeDailyCheckIn':
        logger.info('🔀 [TOOL ROUTER] Routing to storeDailyCheckIn', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await storeDailyCheckIn(parameters, context);
        break;
      
      case 'updateFlags':
        logger.info('🔀 [TOOL ROUTER] Routing to updateFlags', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await updateFlags(parameters, context);
        break;
      
      case 'markMedicationStatus':
        logger.info('🔀 [TOOL ROUTER] Routing to markMedicationStatus', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await markMedicationStatus(parameters, context);
        break;
      
      case 'logCallAttempt':
        logger.info('🔀 [TOOL ROUTER] Routing to logCallAttempt', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await logCallAttempt(parameters, context);
        break;
      
      case 'notifyCaregiver':
        logger.info('🔀 [TOOL ROUTER] Routing to notifyCaregiver', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await notifyCaregiver(parameters, context);
        break;
      
      case 'checkVoiceAnomaly':
        logger.info('🔀 [TOOL ROUTER] Routing to checkVoiceAnomaly', {
          toolName: name,
          patientId: context.patientId,
        });
        result = await checkVoiceAnomaly(parameters, context);
        break;
      
      default:
        logger.warn('⚠️ [TOOL ROUTER] Unknown VAPI tool', { 
          toolName: name,
          patientId: context.patientId,
          availableTools: ['storeDailyCheckIn', 'updateFlags', 'markMedicationStatus', 'logCallAttempt', 'notifyCaregiver', 'checkVoiceAnomaly'],
        });
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
    
    const routeDuration = Date.now() - routeStartTime;
    
    logger.info('🔀 [TOOL ROUTER] Tool call routed successfully', {
      toolName: name,
      patientId: context.patientId,
      callId: context.callId,
      success: result.success,
      hasResult: !!result.result,
      hasError: !!result.error,
      error: result.error,
      resultPreview: result.result ? JSON.stringify(result.result).substring(0, 200) : null,
      durationMs: routeDuration,
    });
    
    return result;
  } catch (error: any) {
    const routeDuration = Date.now() - routeStartTime;
    logger.error('❌ [TOOL ROUTER] Error routing tool call', {
      toolName: name,
      error: error.message,
      stack: error.stack,
      patientId: context.patientId,
      callId: context.callId,
      durationMs: routeDuration,
    });
    return {
      success: false,
      error: error.message || 'Tool execution failed',
    };
  }
}

