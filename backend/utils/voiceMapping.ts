/**
 * Mapping of VAPI assistant IDs to ElevenLabs voice IDs for previews
 * These are the actual voice IDs from your ElevenLabs account
 */

export const ASSISTANT_TO_PREVIEW_VOICE_MAP: Record<string, string> = {
  // Julia
  '6f576490-1309-4a49-8764-6cabb1264b74': 'GDzHdQOi6jjf8zaXhCYD',
  // Andy (formerly Kenji)
  'b127b52b-bdb5-4c88-b55d-b3b2e62051ab': 'h1i3CVVBUuF6s46cxUGG',
  // Priya
  'd480cd37-26ca-4fb9-a146-c64b547e3de1': 'amiAXapsDOAiHJqbsAZj',
  // Lucy
  '67bdddf5-1556-4417-82f9-580593b80153': 'qXdtsJJ9LgnQ8Z2TYfav',
  // Clyde
  '6662cc0e-d6c6-45ec-a580-fe4465b80aeb': 'hWnML2XRpykt4MG3bS1i',
};

/**
 * Get ElevenLabs voice ID for preview based on assistant ID
 * Falls back to Julia's voice if assistant not found
 */
export function getPreviewVoiceId(assistantId: string): string {
  return ASSISTANT_TO_PREVIEW_VOICE_MAP[assistantId] || 'GDzHdQOi6jjf8zaXhCYD';
}

