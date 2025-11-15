/**
 * Generate voice preview using VAPI assistant ID
 * This function now calls the backend API which handles VAPI integration
 */
export async function fetchVoicePreview(assistantId: string, text: string): Promise<ArrayBuffer> {
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  const response = await fetch(`${API_BASE_URL}/api/generate-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice preview failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Convert base64 audio to ArrayBuffer
  const base64 = data.audio;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

