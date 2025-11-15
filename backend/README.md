# RetroCare Backend

This directory contains the backend server for RetroCare, including:
- Express REST API
- VAPI integration for outbound calls
- Cron-based call scheduler
- ElevenLabs voice generation

## Setup

1. Install dependencies:
```bash
npm install express cors node-cron @types/express @types/cors @types/node-cron
```

2. Set up environment variables in `.env`:
```
# VAPI Configuration
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER_ID=your_phone_number_id
VAPI_ASSISTANT_ID=your_assistant_id (optional)

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Supabase Configuration (already set)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server Configuration
PORT=3000
```

3. Start the server:
```bash
# Using ts-node (if installed)
npx ts-node backend/server.ts

# Or compile and run
npm run build:backend
node dist/backend/server.js
```

## API Endpoints

### POST /api/call-now
Make an immediate call to a patient.

**Request:**
```json
{
  "patientId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "callId": "call_id",
  "error": null
}
```

### POST /api/generate-preview
Generate a voice preview using ElevenLabs.

**Request:**
```json
{
  "voiceId": "voice_id",
  "text": "Preview text"
}
```

**Response:**
```json
{
  "audio": "base64_encoded_audio",
  "format": "mp3"
}
```

### GET /api/call-logs/:patientId
Get call logs for a patient.

**Response:**
```json
{
  "callLogs": [...]
}
```

## Scheduler

The cron scheduler runs every minute to check for scheduled calls. It:
- Checks all patients with call schedules
- Makes calls at scheduled times
- Retries failed calls (2 attempts, 5 minutes apart)
- Sets low-priority flag if both attempts fail
- Updates patient's last_call_at timestamp

