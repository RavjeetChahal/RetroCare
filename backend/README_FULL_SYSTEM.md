# RetroCare Backend - Full System Documentation

## Overview

The RetroCare backend is a comprehensive system for automated elder-care voice check-ins using VAPI.ai for phone calls and ElevenLabs for voice synthesis. The system includes:

- **5 Voice Assistants**: Julia, Clyde, Andy, Lucy, Priya
- **Hourly Scheduling**: Timezone-aware call scheduling
- **Mood Analysis**: Sentiment-based mood computation from call transcripts
- **Voice Anomaly Detection**: Integration with Python microservice
- **Daily Check-in Aggregation**: Automatic daily summaries
- **VAPI Tool Integration**: 6 tools for comprehensive call handling

## Architecture

### Directory Structure

```
backend/
├── assistants/          # Assistant configurations
│   ├── config.ts        # 5 assistants with VAPI/ElevenLabs IDs
│   └── index.ts
├── scheduler/           # Call scheduling
│   ├── callScheduler.ts # Hourly scheduler (runs at :00)
│   ├── timeUtils.ts     # Timezone utilities
│   └── index.ts
├── vapi/               # VAPI integration
│   ├── client.ts       # VAPI API client
│   ├── tools/          # VAPI tool handlers
│   │   ├── index.ts
│   │   ├── storeDailyCheckIn.ts
│   │   ├── updateFlags.ts
│   │   ├── markMedicationStatus.ts
│   │   ├── logCallAttempt.ts
│   │   ├── notifyCaregiver.ts
│   │   └── checkVoiceAnomaly.ts
│   └── index.ts
├── routes/              # API routes
│   ├── callRoutes.ts   # Manual call endpoints
│   ├── vapiRoutes.ts   # VAPI webhook handler
│   └── index.ts
├── sentiment/           # Mood analysis
│   ├── moodAnalyzer.ts # Sentiment → mood computation
│   └── index.ts
├── daily/               # Daily aggregation
│   ├── aggregator.ts   # Daily check-in computation
│   └── index.ts
├── anomaly/             # Voice anomaly detection
│   ├── anomalyService.ts
│   └── pythonClient.ts
├── supabase/              # Database operations
│   ├── patients.ts
│   ├── callLogs.ts
│   ├── medications.ts
│   ├── healthFlags.ts
│   ├── dailyCheckIns.ts
│   ├── voiceBaseline.ts
│   └── types.ts
└── server.ts            # Express server entry point
```

## Database Schema

### Core Tables

1. **patients**
   - `assigned_assistant`: "Julia" | "Clyde" | "Andy" | "Lucy" | "Priya"
   - `voice_choice`: VAPI assistant ID (UUID)
   - `call_schedule`: Array of hourly times (e.g., ["09:00", "14:00", "19:00"])

2. **call_logs**
   - `outcome`: "answered" | "no_answer" | "busy" | "failed" | "voicemail"
   - `transcript`: Full call transcript
   - `mood`: "good" | "neutral" | "bad" | null
   - `sentiment_score`: 0.0-1.0
   - `anomaly_score`: 0.0-1.0
   - `meds_taken`: JSON array of medication status

3. **daily_checkins**
   - One row per patient per day
   - Aggregates mood, sleep, meds, flags from all answered calls
   - `mood`: Most recent answered call's mood, or "neutral" if none

4. **health_flags**
   - Tracks health concerns from assistants, anomalies, or caregivers
   - Can be resolved with notes

5. **medications**
   - Medication schedule per patient

6. **patient_voice_baseline**
   - Stores voice embedding for anomaly detection

## Scheduling System

### How It Works

1. **Cron Job**: Runs every hour at :00 (e.g., 09:00, 10:00, 11:00)
2. **Timezone Conversion**: Converts UTC to patient's local timezone
3. **Hour Matching**: Checks if current hour (e.g., "09:00") matches `call_schedule`
4. **Call Initiation**: Makes VAPI outbound call with:
   - Patient's phone number
   - Correct assistant ID
   - Webhook URL for call-ended events

### Retry Logic

- **Attempt 1**: Initial call
- **Wait**: 5 minutes
- **Attempt 2**: Retry if first failed
- **If Both Fail**:
  - Logs call attempt
  - Updates flags: `["did_not_answer_twice"]`
  - Notifies caregiver (low priority)

## Mood Computation

### Rules

1. **Only answered calls count**: Missed calls → `mood = null` (not "bad")
2. **Sentiment Analysis**: Transcript analyzed for positive/negative keywords
3. **Score Mapping**:
   - `score >= 0.66` → `"good"`
   - `0.33 <= score < 0.66` → `"neutral"`
   - `score < 0.33` → `"bad"`
4. **Daily Mood**: Most recent answered call's mood, or `"neutral"` if no calls answered

### Implementation

- Keyword-based sentiment analysis (can be upgraded to NLP API)
- Confidence scoring based on distance from thresholds
- Defaults to "neutral" if sentiment cannot be determined

## VAPI Webhook System

### Endpoint

`POST /api/vapi/call-ended`

### Webhook Flow

1. **Receive webhook** from VAPI when call ends
2. **Extract data**:
   - Transcript
   - Tool calls and results
   - Recording URL
   - Assistant used
3. **Route tool calls** to appropriate handlers
4. **Compute mood** from transcript
5. **Create/update call log** with all data
6. **Aggregate daily check-in** (if answered)
7. **Check voice anomaly** (if recording available)
8. **Notify caregiver** if anomaly detected

### Tool Handlers

All 6 tools are implemented:

- `storeDailyCheckIn`: Updates daily_checkins table
- `updateFlags`: Creates health_flags entries
- `markMedicationStatus`: Records medication adherence
- `logCallAttempt`: Creates call_logs entry
- `notifyCaregiver`: Sends notifications (SMS/call - TODO: implement actual notification)
- `checkVoiceAnomaly`: Triggers anomaly detection

## Voice Anomaly Detection

### Integration

- Calls Python microservice `/embed` and `/compare` endpoints
- Compares current call embedding with baseline
- Scores: 0.0 (normal) to 1.0 (severe anomaly)
- Thresholds:
  - `> 0.70`: Critical → Emergency caregiver notification
  - `> 0.55`: High → High-priority notification
  - `> 0.45`: Medium → Medium-priority notification
  - `> 0.40`: Low → Low-priority notification

## Daily Check-in Aggregation

### Process

1. **Triggered** after each answered call
2. **Aggregates** all answered calls for the day:
   - Mood: Most recent answered call
   - Sleep: Most recent sleep data
   - Meds: All medications taken across calls
   - Flags: All flags from all calls
   - Summary: Most recent summary
3. **Idempotent**: Safe to run multiple times
4. **Updates** `daily_checkins` table (one row per patient per day)

## Environment Variables

### Required

- `ELEVENLABS_API_KEY`: For voice previews
- `VAPI_API_KEY`: For making calls
- `VAPI_PHONE_NUMBER_ID`: Your VAPI phone number
- `SUPABASE_SERVICE_ROLE_KEY`: Backend database access

### Optional

- `VAPI_ASSISTANT_ID`: Fallback assistant (usually not needed)
- `VAPI_WEBHOOK_URL`: Webhook URL (defaults to `EXPO_PUBLIC_API_URL/api/vapi/call-ended`)
- `PORT`: Backend server port (default: 3000)

## API Endpoints

### Manual Calls

- `POST /api/call-now`: Make immediate call to patient
- `POST /api/generate-preview`: Generate voice preview

### VAPI Webhooks

- `POST /api/vapi/call-ended`: Receives call-ended events from VAPI

### Anomaly Detection

- `POST /api/anomaly/check`: Manual anomaly check
- `GET /api/anomaly/logs/:patientId`: Get anomaly logs

## Testing

### Test Scheduler

The scheduler runs every hour. To test immediately:

```typescript
import { runScheduledCalls } from './backend/scheduler';
await runScheduledCalls();
```

### Test Webhook

```bash
curl -X POST http://localhost:3000/api/vapi/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "call": {
      "id": "test-call-id",
      "status": "ended",
      "customer": { "number": "+1234567890" },
      "assistantId": "6f576490-1309-4a49-8764-6cabb1264b74",
      "transcript": "Hello, I am feeling good today.",
      "recordingUrl": "https://example.com/recording.mp3",
      "toolCalls": []
    }
  }'
```

## Next Steps

1. **Run Database Migration**: Execute `backend/supabase/migrations/001_add_new_tables.sql`
2. **Set Webhook URL**: Configure `VAPI_WEBHOOK_URL` in VAPI dashboard
3. **Implement Notifications**: Add actual SMS/call logic in `notifyCaregiver` tool
4. **Upgrade Sentiment**: Replace keyword-based analysis with NLP API (optional)
5. **Test End-to-End**: Create a test patient and verify scheduling works

