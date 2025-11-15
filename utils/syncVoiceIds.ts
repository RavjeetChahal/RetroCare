/**
 * Utility script to sync ElevenLabs voice IDs from VAPI assistants
 * Run this script to automatically update ASSISTANT_TO_VOICE_MAP with actual voice IDs
 * 
 * Usage: 
 *   - From backend: node -r ts-node/register utils/syncVoiceIds.ts
 *   - Or import and call syncVoiceIds() from your backend code
 */

import { getAssistant } from '../backend/vapi';
import { ASSISTANT_TO_VOICE_MAP } from './voices';

const ASSISTANT_IDS = {
  Kenji: 'b127b52b-bdb5-4c88-b55d-b3b2e62051ab',
  Priya: 'd480cd37-26ca-4fb9-a146-c64b547e3de1',
  Lucy: '67bdddf5-1556-4417-82f9-580593b80153',
  Clyde: '6662cc0e-d6c6-45ec-a580-fe4465b80aeb',
  Julia: '6f576490-1309-4a49-8764-6cabb1264b74',
};

export async function syncVoiceIds(): Promise<Record<string, string>> {
  const voiceMap: Record<string, string> = {};

  for (const [name, assistantId] of Object.entries(ASSISTANT_IDS)) {
    try {
      const assistant = await getAssistant(assistantId);
      
      if (assistant.voice?.provider === 'elevenlabs' && assistant.voice?.voiceId) {
        voiceMap[assistantId] = assistant.voice.voiceId;
        console.log(`✓ ${name}: ${assistant.voice.voiceId}`);
      } else {
        console.warn(`⚠ ${name}: No ElevenLabs voice found in assistant`);
      }
    } catch (error: any) {
      console.error(`✗ ${name}: Failed to fetch assistant - ${error.message}`);
    }
  }

  return voiceMap;
}

// If running directly
if (require.main === module) {
  syncVoiceIds()
    .then((voiceMap) => {
      console.log('\n=== Voice ID Mapping ===');
      console.log(JSON.stringify(voiceMap, null, 2));
      console.log('\nUpdate ASSISTANT_TO_VOICE_MAP in utils/voices.ts with these values.');
    })
    .catch((error) => {
      console.error('Failed to sync voice IDs:', error);
      process.exit(1);
    });
}

