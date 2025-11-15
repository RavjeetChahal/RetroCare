/**
 * Script to sync ElevenLabs voice IDs from VAPI assistants
 * Run with: node scripts/syncVoiceIds.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const VAPI_BASE_URL = 'https://api.vapi.ai';
// Try to get API key from command line arg, environment, or .env
const VAPI_API_KEY = process.argv[2] || process.env.VAPI_API_KEY;

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY is required!');
  console.error('   Please set it in your .env file or pass it as an argument:');
  console.error('   node scripts/syncVoiceIds.js your_api_key_here');
  process.exit(1);
}

const ASSISTANT_IDS = {
  Kenji: 'b127b52b-bdb5-4c88-b55d-b3b2e62051ab',
  Priya: 'd480cd37-26ca-4fb9-a146-c64b547e3de1',
  Lucy: '67bdddf5-1556-4417-82f9-580593b80153',
  Clyde: '6662cc0e-d6c6-45ec-a580-fe4465b80aeb',
  Julia: '6f576490-1309-4a49-8764-6cabb1264b74',
};

async function getAssistant(assistantId) {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY environment variable is not set');
  }

  const response = await axios.get(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
  });

  return response.data;
}

async function syncVoiceIds() {
  console.log('Fetching voice IDs from VAPI assistants...\n');

  const voiceMap = {};
  const results = [];

  for (const [name, assistantId] of Object.entries(ASSISTANT_IDS)) {
    try {
      console.log(`Fetching ${name}...`);
      const assistant = await getAssistant(assistantId);
      
      // Log the full assistant voice configuration for debugging
      console.log(`  Assistant voice config:`, JSON.stringify(assistant.voice || assistant.model?.voice || 'none', null, 2));
      
      // Check different possible locations for voice configuration
      const voiceConfig = assistant.voice || assistant.model?.voice || assistant.firstMessage?.voice;
      
      if (voiceConfig?.provider === 'elevenlabs' && voiceConfig?.voiceId) {
        voiceMap[assistantId] = voiceConfig.voiceId;
        results.push({
          name,
          assistantId,
          voiceId: voiceConfig.voiceId,
          success: true,
        });
        console.log(`  ✓ ${name}: ${voiceConfig.voiceId}\n`);
      } else if (voiceConfig?.voiceId) {
        // Found a voice ID but not sure if it's ElevenLabs
        voiceMap[assistantId] = voiceConfig.voiceId;
        results.push({
          name,
          assistantId,
          voiceId: voiceConfig.voiceId,
          provider: voiceConfig.provider || 'unknown',
          success: true,
        });
        console.log(`  ✓ ${name}: ${voiceConfig.voiceId} (provider: ${voiceConfig.provider || 'unknown'})\n`);
      } else {
        results.push({
          name,
          assistantId,
          error: 'No voice configuration found in assistant',
          assistantData: JSON.stringify(assistant, null, 2).substring(0, 200),
          success: false,
        });
        console.log(`  ⚠ ${name}: No voice configuration found`);
        console.log(`  Full assistant data (first 500 chars):`, JSON.stringify(assistant, null, 2).substring(0, 500));
        console.log('');
      }
    } catch (error) {
      results.push({
        name,
        assistantId,
        error: error.response?.data?.message || error.message,
        success: false,
      });
      console.log(`  ✗ ${name}: ${error.response?.data?.message || error.message}\n`);
    }
  }

  // Update the voices.ts file
  const voicesFilePath = path.join(__dirname, '../utils/voices.ts');
  let voicesContent = fs.readFileSync(voicesFilePath, 'utf8');

  // Replace the ASSISTANT_TO_VOICE_MAP
  const mapStart = 'export const ASSISTANT_TO_VOICE_MAP: Record<string, string> = {';
  const mapEnd = '};';
  const mapStartIndex = voicesContent.indexOf(mapStart);
  const mapEndIndex = voicesContent.indexOf(mapEnd, mapStartIndex);

  if (mapStartIndex !== -1 && mapEndIndex !== -1) {
    const newMapContent = Object.entries(voiceMap)
      .map(([assistantId, voiceId]) => {
        const name = Object.entries(ASSISTANT_IDS).find(([n, id]) => id === assistantId)?.[0] || 'Unknown';
        return `  // ${name}\n  '${assistantId}': '${voiceId}',`;
      })
      .join('\n');

    const beforeMap = voicesContent.substring(0, mapStartIndex + mapStart.length);
    const afterMap = voicesContent.substring(mapEndIndex);

    voicesContent = beforeMap + '\n' + newMapContent + '\n' + afterMap;

    fs.writeFileSync(voicesFilePath, voicesContent, 'utf8');
    console.log('✓ Updated utils/voices.ts with synced voice IDs\n');
  } else {
    console.log('⚠ Could not find ASSISTANT_TO_VOICE_MAP in voices.ts, manual update required\n');
  }

  console.log('=== Summary ===');
  results.forEach((result) => {
    if (result.success) {
      console.log(`✓ ${result.name}: ${result.voiceId}`);
    } else {
      console.log(`✗ ${result.name}: ${result.error}`);
    }
  });

  return { voiceMap, results };
}

if (require.main === module) {
  syncVoiceIds()
    .then(() => {
      console.log('\n✓ Voice ID sync completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Failed to sync voice IDs:', error.message);
      process.exit(1);
    });
}

module.exports = { syncVoiceIds };

