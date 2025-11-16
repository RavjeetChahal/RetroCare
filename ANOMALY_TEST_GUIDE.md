# Anomaly Detection Testing Guide

## Current Status

✅ **Database Tables Created**
- `voice_anomaly_logs` table exists
- `baseline_embedding_url` column added to `patients` table
- Indexes created for performance

✅ **Database Data Available**
- 1 patient (Ravi) with 6 answered calls
- All 6 calls have transcripts
- No anomaly scores yet (all null)

⚠️ **Python Service**
- Virtual environment exists
- Service needs to be started manually

## Setup Steps

### 1. Start Python Anomaly Service

```bash
cd python/anomaly-service
source venv/bin/activate  # On macOS/Linux
# or: venv\Scripts\activate  # On Windows

python main.py
```

**Note:** First run will download the ECAPA-TDNN model (~100MB) which may take a few minutes.

The service should start on `http://localhost:8000`

### 2. Verify Python Service is Running

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "anomaly-detection",
  "model_loaded": true
}
```

### 3. Run Tests

```bash
# Option 1: Use the test script
npx tsx scripts/testAnomalyDetection.ts

# Option 2: Use the shell script (checks service first)
./scripts/runAnomalyTests.sh
```

## What the Tests Check

1. **Python Service Health** - Is the service running and responding?
2. **Database Data** - Do we have patients and call logs?
3. **Embedding Extraction** - Can we extract embeddings from audio?
4. **Embedding Comparison** - Can we compare embeddings and get anomaly scores?
5. **Full Anomaly Check** - End-to-end test with a patient and audio URL

## Testing with Real Data

### Current Database State

- **Patients:** 1 patient (Ravi) with ID: `97d5ebe2-c96f-4d24-b9ec-7cd6345f30de`
- **Call Logs:** 6 answered calls with transcripts
- **Audio URLs:** Need to fetch from VAPI API (not stored in database)

### To Test with Real VAPI Audio

1. Get a call log ID from the database
2. Fetch the audio recording URL from VAPI API using the call log ID
3. Use that URL in the test script

Example:
```typescript
const audioUrl = await getVAPIRecordingUrl(callLogId);
const result = await checkVoiceAnomaly(patientId, callLogId, audioUrl);
```

## Expected Test Results

### ✅ All Tests Pass When:
- Python service is running
- Database has patients and call logs
- Audio URLs are accessible
- Model loads successfully

### ⚠️ Partial Tests When:
- Python service not running → Only database tests run
- No audio URLs → Embedding extraction fails
- No call logs → Full anomaly check fails

## Troubleshooting

### Python Service Won't Start

**Error: Module not found**
```bash
cd python/anomaly-service
source venv/bin/activate
pip install -r requirements.txt
```

**Error: Model download fails**
- Check internet connection
- Model downloads to `models/ecapa/` directory
- First download is ~100MB

**Error: Port 8000 already in use**
```bash
# Change port in .env or main.py
PORT=8001 python main.py
```

### Database Issues

**Table doesn't exist**
- Run the migration: The migration has been applied
- Check Supabase dashboard to verify tables exist

**No data**
- You have 1 patient with 6 call logs
- All calls have transcripts but no audio URLs stored
- Need to fetch audio URLs from VAPI

### Audio URL Issues

**VAPI recordings not accessible**
- VAPI stores recordings separately
- Need to fetch recording URL from VAPI API
- Recording URLs expire after some time
- Check VAPI dashboard for recording URLs

## Next Steps

1. ✅ Database tables created
2. ⏳ Start Python service
3. ⏳ Run tests
4. ⏳ Get VAPI audio URLs for real testing
5. ⏳ Test with actual call recordings

## Manual Testing

You can also test manually using curl:

```bash
# Health check
curl http://localhost:8000/health

# Extract embedding (replace with real audio URL)
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://example.com/audio.wav",
    "sample_rate": 16000
  }'

# Compare embeddings (replace with real embeddings)
curl -X POST http://localhost:8000/compare \
  -H "Content-Type: application/json" \
  -d '{
    "baseline": [0.1, 0.2, ...],
    "current": [0.15, 0.25, ...],
    "snr": 20.0,
    "hour": 14
  }'
```

## Integration with Backend

The backend automatically calls anomaly detection when:
- A call completes (via VAPI webhook)
- A scheduled call finishes
- Manual call is made via `/api/calls/call-now`

The anomaly check is non-blocking and runs in the background.

