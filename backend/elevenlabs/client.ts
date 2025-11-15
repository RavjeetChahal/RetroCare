import axios from 'axios';
import { logger } from '../../utils';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.EXPO_PUBLIC_ELEVENLABS_KEY;

/**
 * Generate voice preview using ElevenLabs
 */
export async function generateVoicePreview(
  voiceId: string,
  text: string,
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  try {
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
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    return response.data;
  } catch (error: any) {
    logger.error('ElevenLabs preview generation failed', error.response?.data || error.message);
    throw new Error(
      `ElevenLabs preview failed: ${error.response?.data?.message || error.message}`,
    );
  }
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

