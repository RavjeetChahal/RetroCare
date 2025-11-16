# Voice Anomaly Detection - How It Works

## Overview

The voice anomaly detection system analyzes patient voice patterns from phone calls to detect potential health issues. It compares each call against a baseline voice embedding to identify changes that might indicate illness or distress.

## How It Works

### 1. **Baseline Creation (First Call)**

When a patient receives their **first successful call**:

1. **Health Check**: System checks if patient is healthy (no sick flags)
   - Checks `patients.flags` array for: `sick`, `illness`, `pain`, `fever`, `cough`, etc.
   - Checks `health_flags` table for unresolved health issues
   
2. **If Healthy**: 
   - Extracts voice embedding from the call audio
   - Stores embedding as a **vector (array of 192 numbers)** in `patient_voice_baseline` table
   - This becomes the baseline for all future comparisons
   
3. **If Sick**: 
   - Baseline is **NOT** stored
   - System waits for patient to be healthy before creating baseline
   - This ensures baseline represents normal, healthy voice

### 2. **Subsequent Calls (Anomaly Detection)**

For every call after the first:

1. **Extract Current Embedding**: Gets voice embedding from current call audio
2. **Compare with Baseline**: Uses **cosine similarity** to compare current vs baseline
3. **Calculate Anomaly Score**: 
   - Score 0.0 = identical to baseline (normal)
   - Score 1.0 = completely different (anomaly)
   - Higher score = more different from baseline

### 3. **Alert Thresholds**

The system triggers alerts based on anomaly scores:

- **Score ≤ 0.25**: ✅ Normal (no alert)
- **Score 0.25 - 0.40**: ⚠️ Warning alert sent to caregiver
- **Score > 0.40**: 🚨 Emergency alert sent to caregiver
- **Score > 0.70**: 🔴 Critical - immediate caregiver notification

### 4. **What Happens When Anomaly Detected**

When voice anomaly is detected:

1. **Anomaly Log Created**: Entry in `voice_anomaly_logs` table with:
   - Anomaly score
   - Raw similarity score
   - SNR (signal-to-noise ratio)
   - Alert type (warning/emergency)
   - Timestamps

2. **Call Log Updated**: `call_logs.anomaly_score` field updated

3. **Daily Check-In Updated**: If score > 0.40, updates `daily_checkins` table with:
   - Anomaly score
   - Severity level (low/medium/high/critical)

4. **Caregiver Alert**: 
   - For scores > 0.70: Emergency notification sent immediately
   - For scores 0.25-0.40: Warning notification sent
   - Uses `notifyCaregiver` tool to send SMS/notification

## Why Your Call Didn't Get Anomaly Check

Looking at your logs, the call had:
- ✅ Call answered: `true`
- ✅ Patient found: `Vedant`
- ❌ **Recording URL: `false`** ← This is why anomaly check didn't run

### The Fix

I've updated the code to:
1. **Check webhook payload** for recording URL (existing behavior)
2. **If not found, fetch from VAPI API** using `getCallStatus(callId)`
3. **Try multiple field names** where VAPI might store the recording URL:
   - `recordingUrl`
   - `recording.url`
   - `transcript.audioUrl`

### Recording Availability

VAPI recordings may not be immediately available when the webhook fires. The updated code:
- Fetches recording URL from VAPI API if missing from webhook
- Logs warnings if recording still not available
- Only runs anomaly check when recording URL is confirmed

## Database Tables

### `patient_voice_baseline`
Stores the baseline voice embedding:
- `patient_id`: Patient UUID
- `embedding`: JSON string of embedding vector (192 numbers)
- `embedding_url`: Optional URL reference
- `created_at`, `updated_at`: Timestamps

### `voice_anomaly_logs`
Stores each anomaly detection result:
- `patient_id`: Patient UUID
- `call_log_id`: Reference to call log
- `anomaly_score`: 0.0-1.0 score
- `raw_similarity`: Cosine similarity score
- `normalized_score`: Score after noise/time adjustments
- `snr`: Signal-to-noise ratio
- `alert_type`: `warning` | `emergency` | `null`
- `baseline_embedding_url`: Reference to baseline
- `current_embedding_url`: Reference to current call
- `alert_sent`: Boolean flag
- `timestamp`: When anomaly was detected

## Technical Details

### Embedding Extraction
- Uses **ECAPA-TDNN** model (Python service)
- Extracts 192-dimensional vector from audio
- Computes SNR to assess audio quality

### Cosine Similarity
- Measures angle between two vectors
- Range: -1 to 1 (we normalize to 0-1)
- Higher similarity = lower anomaly score

### Noise Normalization
- Adjusts score based on audio quality (SNR)
- Poor audio quality = higher tolerance for differences

### Time-of-Day Compensation
- Accounts for natural voice variations throughout day
- Morning voice may differ from evening voice

## Testing

Run the test suite to verify everything works:

```bash
npm run test:anomaly
```

Tests cover:
- ✅ Baseline storage (healthy patient)
- ✅ Baseline NOT stored (sick patient)
- ✅ Anomaly detection
- ✅ Alert thresholds
- ✅ Edge cases

## Next Steps

After deploying the fix:
1. **Make a new call** - system will fetch recording URL from VAPI API
2. **Check logs** - should see "Recording URL fetched from VAPI API"
3. **Verify anomaly check runs** - should see "Starting voice anomaly check"
4. **Check database** - `voice_anomaly_logs` table should populate

## Troubleshooting

### Recording URL Still Not Available
- VAPI may need time to process recording
- Check VAPI dashboard for recording availability
- Ensure recording is enabled in VAPI assistant settings

### Anomaly Check Fails
- Check Python service is running (`python/anomaly-service/main.py`)
- Verify `PYTHON_SERVICE_URL` environment variable
- Check logs for Python service errors

### Baseline Not Created
- Verify patient has no sick flags
- Check this is first answered call
- Verify patient exists in database

