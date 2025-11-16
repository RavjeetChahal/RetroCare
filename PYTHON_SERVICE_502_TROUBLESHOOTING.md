# Python Service 502 Bad Gateway Troubleshooting

## Issue
The Python service is returning a 502 Bad Gateway error, indicating the service is not responding.

## Changes Made

### 1. Improved Error Handling
- **File**: `python/anomaly-service/main.py`
- **Changes**:
  - Service now starts even if model loading fails (instead of crashing)
  - Health endpoint reports model loading status
  - Better error messages for debugging

### 2. Production Settings
- **File**: `python/anomaly-service/main.py`
- **Changes**:
  - Removed `reload=True` in production (only enabled in development)
  - Service won't crash if model fails to load initially

## Common Causes of 502 Errors

### 1. **Model Loading Takes Too Long**
The ECAPA-TDNN model is ~83MB and takes time to download/load. Render's health check might timeout.

**Solution**: Check Render logs to see if model is still loading.

### 2. **Memory Issues**
Loading the model requires significant memory. Render's free tier might not have enough.

**Solution**: 
- Check Render logs for memory errors
- Consider upgrading to a paid plan with more memory
- Or use a smaller model

### 3. **Service Crashed After Startup**
The service might have crashed due to an unhandled exception.

**Solution**: Check Render logs for error messages.

## How to Debug

### Step 1: Check Render Logs
1. Go to Render Dashboard → `retrocare-python` service
2. Click "Logs" tab
3. Look for:
   - `"Voice anomaly detection service started successfully"` ✅ Good
   - `"Failed to load model on startup"` ⚠️ Model failed but service should still start
   - Any Python tracebacks ❌ Service crashed

### Step 2: Test Health Endpoint
After deploying, test:
```bash
curl https://retrocare-python.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "anomaly-detection",
  "model_loaded": true,
  "model_error": null
}
```

If `model_loaded: false`, check `model_error` field for details.

### Step 3: Check Service Status
1. Go to Render Dashboard → `retrocare-python`
2. Check "Status" - should be "Live" (green)
3. If "Failed" or "Building", check logs

## Next Steps

1. **Commit and push these changes**:
   ```bash
   git add python/anomaly-service/main.py
   git commit -m "Fix: Improve error handling and production settings for Python service"
   git push
   ```

2. **Wait for Render to redeploy** (automatic on push)

3. **Check logs** after deployment completes

4. **Test health endpoint**:
   ```bash
   curl https://retrocare-python.onrender.com/health
   ```

## If Still Getting 502

### Option 1: Increase Health Check Timeout
In Render Dashboard → `retrocare-python` → Settings:
- Increase "Health Check Timeout" to 120 seconds (model loading can take time)

### Option 2: Check Memory Limits
- Free tier: 512MB RAM
- Model + dependencies might exceed this
- Consider upgrading to Starter plan ($7/month) with 512MB RAM

### Option 3: Lazy Model Loading
If model loading is the issue, we can modify the service to load the model on first request instead of startup (slower first request but faster startup).

## Environment Variables Needed

Make sure these are set in Render Dashboard → `retrocare-python` → Environment:
- ✅ `PORT` - Auto-set by Render (don't need to set manually)
- ✅ `CORS_ORIGINS` - Set to: `https://retrocare.onrender.com,http://localhost:3000`

## Summary

The changes ensure:
1. ✅ Service starts even if model fails to load
2. ✅ Health endpoint reports actual status
3. ✅ Better error messages for debugging
4. ✅ Production-safe settings (no reload)

After deploying, check logs to see what's actually happening!

