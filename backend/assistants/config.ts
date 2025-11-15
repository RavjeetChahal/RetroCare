/**
 * RetroCare Assistant Configuration
 * 
 * Defines the 5 voice assistants and their VAPI/ElevenLabs mappings
 */

export type AssistantName = 'Julia' | 'Clyde' | 'Andy' | 'Lucy' | 'Priya';

export interface AssistantConfig {
  name: AssistantName;
  assistantId: string; // VAPI assistant UUID
  voiceId: string; // ElevenLabs voice ID
  description: string;
  ethnicity: string;
  gender: 'male' | 'female';
}

/**
 * Assistant configurations with VAPI assistant IDs and ElevenLabs voice IDs
 */
export const ASSISTANTS: Record<AssistantName, AssistantConfig> = {
  Julia: {
    name: 'Julia',
    assistantId: '6f576490-1309-4a49-8764-6cabb1264b74',
    voiceId: 'GDzHdQOi6jjf8zaXhCYD',
    description: 'Warm, reassuring, and friendly for daily check-ins.',
    ethnicity: 'American',
    gender: 'female',
  },
  Clyde: {
    name: 'Clyde',
    assistantId: '6662cc0e-d6c6-45ec-a580-fe4465b80aeb',
    voiceId: 'hWnML2XRpykt4MG3bS1i',
    description: 'Friendly and conversational voice for mood check-ins.',
    ethnicity: 'American',
    gender: 'male',
  },
  Andy: {
    name: 'Andy',
    assistantId: 'b127b52b-bdb5-4c88-b55d-b3b2e62051ab',
    voiceId: 'h1i3CVVBUuF6s46cxUGG',
    description: 'Calm and professional voice for medication reminders.',
    ethnicity: 'Chinese-American',
    gender: 'male',
  },
  Lucy: {
    name: 'Lucy',
    assistantId: '67bdddf5-1556-4417-82f9-580593b80153',
    voiceId: 'qXdtsJJ9LgnQ8Z2TYfav',
    description: 'Upbeat and energetic voice for schedule confirmations.',
    ethnicity: 'British',
    gender: 'female',
  },
  Priya: {
    name: 'Priya',
    assistantId: 'd480cd37-26ca-4fb9-a146-c64b547e3de1',
    voiceId: 'amiAXapsDOAiHJqbsAZj',
    description: 'Compassionate and caring voice for sensitive conversations.',
    ethnicity: 'South-Asian American',
    gender: 'female',
  },
};

/**
 * Get assistant config by name
 */
export function getAssistantByName(name: AssistantName): AssistantConfig {
  return ASSISTANTS[name];
}

/**
 * Get assistant config by VAPI assistant ID
 */
export function getAssistantById(assistantId: string): AssistantConfig | undefined {
  return Object.values(ASSISTANTS).find((a) => a.assistantId === assistantId);
}

/**
 * Get assistant ID (UUID) from assistant name
 */
export function getAssistantId(name: AssistantName): string {
  return ASSISTANTS[name].assistantId;
}

/**
 * All 6 VAPI tools that every assistant exposes
 */
export const VAPI_TOOLS = [
  'storeDailyCheckIn',
  'updateFlags',
  'markMedicationStatus',
  'logCallAttempt',
  'notifyCaregiver',
  'checkVoiceAnomaly',
] as const;

export type VAPIToolName = typeof VAPI_TOOLS[number];

