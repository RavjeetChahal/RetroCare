const ELEVEN_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

export async function fetchVoicePreview(voiceId: string, text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_KEY;

  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_ELEVENLABS_KEY environment variable.');
  }

  const response = await fetch(`${ELEVEN_BASE_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs preview failed: ${response.status} ${errorText}`);
  }

  return response.arrayBuffer();
}

