export type VoiceOption = {
  id: string; // ElevenLabs voice ID
  name: string;
  description: string;
  style: 'Warm' | 'Energetic' | 'Calm' | 'Compassionate' | 'Upbeat';
  assistantId?: string; // VAPI assistant ID (optional)
};

/**
 * Mapping of VAPI assistant IDs to ElevenLabs voice IDs
 * Update these voice IDs to match your actual ElevenLabs voice configuration
 */
export const ASSISTANT_TO_VOICE_MAP: Record<string, string> = {
  // Andy (formerly Kenji)
  'b127b52b-bdb5-4c88-b55d-b3b2e62051ab': 'h1i3CVVBUuF6s46cxUGG',
  // Priya
  'd480cd37-26ca-4fb9-a146-c64b547e3de1': 'amiAXapsDOAiHJqbsAZj',
  // Lucy
  '67bdddf5-1556-4417-82f9-580593b80153': 'qXdtsJJ9LgnQ8Z2TYfav',
  // Clyde
  '6662cc0e-d6c6-45ec-a580-fe4465b80aeb': 'hWnML2XRpykt4MG3bS1i',
  // Julia
  '6f576490-1309-4a49-8764-6cabb1264b74': 'GDzHdQOi6jjf8zaXhCYD',
};

/**
 * Generate a personalized sample script for a voice
 */
export function getVoiceSampleScript(voiceName: string): string {
  return `Hi, this is RetroCare. My name is ${voiceName}. How are you feeling today? Did you take your meds?`;
}

/**
 * Default sample script (for backward compatibility)
 */
export const VOICE_SAMPLE_SCRIPT = getVoiceSampleScript('Julia');

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: ASSISTANT_TO_VOICE_MAP['6f576490-1309-4a49-8764-6cabb1264b74'] || '21m00Tcm4TlvDq8ikWAM',
    name: 'Julia',
    description: 'Warm, reassuring, and friendly for daily check-ins.',
    style: 'Warm',
    assistantId: '6f576490-1309-4a49-8764-6cabb1264b74',
  },
  {
    id: ASSISTANT_TO_VOICE_MAP['b127b52b-bdb5-4c88-b55d-b3b2e62051ab'] || 'h1i3CVVBUuF6s46cxUGG',
    name: 'Andy',
    description: 'Calm and professional voice for medication reminders.',
    style: 'Calm',
    assistantId: 'b127b52b-bdb5-4c88-b55d-b3b2e62051ab',
  },
  {
    id: ASSISTANT_TO_VOICE_MAP['d480cd37-26ca-4fb9-a146-c64b547e3de1'] || 'ThT5KcBePX1pzSbhoV0x',
    name: 'Priya',
    description: 'Compassionate and caring voice for sensitive conversations.',
    style: 'Compassionate',
    assistantId: 'd480cd37-26ca-4fb9-a146-c64b547e3de1',
  },
  {
    id: ASSISTANT_TO_VOICE_MAP['67bdddf5-1556-4417-82f9-580593b80153'] || 'pMsXgVXv3BLzUgSXRplE',
    name: 'Lucy',
    description: 'Upbeat and energetic voice for schedule confirmations.',
    style: 'Energetic',
    assistantId: '67bdddf5-1556-4417-82f9-580593b80153',
  },
  {
    id: ASSISTANT_TO_VOICE_MAP['6662cc0e-d6c6-45ec-a580-fe4465b80aeb'] || '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde',
    description: 'Friendly and conversational voice for mood check-ins.',
    style: 'Upbeat',
    assistantId: '6662cc0e-d6c6-45ec-a580-fe4465b80aeb',
  },
];

/**
 * Get ElevenLabs voice ID from VAPI assistant ID
 */
export function getVoiceIdFromAssistantId(assistantId: string): string | undefined {
  return ASSISTANT_TO_VOICE_MAP[assistantId];
}

/**
 * Get voice option by assistant ID
 */
export function getVoiceOptionByAssistantId(assistantId: string): VoiceOption | undefined {
  return VOICE_OPTIONS.find((voice) => voice.assistantId === assistantId);
}

