# Quick Test Commands for Python Service

## Basic Tests

### 1. Root Endpoint (Quick Check)
```bash
curl https://retrocare-python.onrender.com/
```

**Expected Response:**
```json
{"status":"ok","service":"anomaly-detection"}
```

### 2. Health Endpoint (Detailed Status)
```bash
curl https://retrocare-python.onrender.com/health
```

**Expected Response (during loading):**
```json
{
  "status": "loading",
  "service": "anomaly-detection",
  "model_loaded": false,
  "model_error": null,
  "model_loading": true
}
```

**Expected Response (after model loads):**
```json
{
  "status": "ok",
  "service": "anomaly-detection",
  "model_loaded": true,
  "model_error": null,
  "model_loading": false
}
```

### 3. Health Check (Pretty JSON)
```bash
curl -s https://retrocare-python.onrender.com/health | python3 -m json.tool
```

### 4. Test Embed Endpoint (Will fail without model, but tests endpoint exists)
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{"audio_url":"https://example.com/test.wav","sample_rate":16000}'
```

**Expected Response (if model not loaded):**
```json
{"detail":"Model not loaded. Error: ..."}
```
Status: 503

**Expected Response (if model loaded):**
```json
{"detail":"Failed to extract embedding: ..."}
```
Status: 500 (because example.com URL doesn't exist, but endpoint works!)

## Automated Test Script

Run the test script:
```bash
cd python/anomaly-service
./test_service.sh
```

Or test a different URL:
```bash
./test_service.sh http://localhost:8000
```

## What to Look For

✅ **Service Working:**
- Root endpoint returns 200
- Health endpoint returns 200 (even during model loading)
- Response time < 1 second

✅ **Model Loading:**
- Health shows `"status": "loading"` initially
- Health shows `"model_loading": true` initially
- After 30-60 seconds, shows `"model_loaded": true`

❌ **Service Not Working:**
- 502 Bad Gateway
- Connection timeout
- 404 Not Found

## Troubleshooting

If you get **502 Bad Gateway:**
- Service might be crashing during startup
- Check Render logs for errors
- Verify all dependencies are installed

If you get **Connection Timeout:**
- Service might be hanging
- Check Render logs
- Verify the service started successfully

If health shows **"model_error"**:
- Model failed to load
- Check Render logs for the specific error
- Verify model download is working


