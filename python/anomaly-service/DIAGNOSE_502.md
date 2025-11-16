# Diagnosing 502 Bad Gateway Error

## Quick Checks

### 1. Check Render Logs
Go to Render Dashboard → `retrocare-python` → **Logs** tab and look for:
- Error messages or tracebacks
- Import errors
- Memory errors
- Model loading failures

### 2. Test Service Locally First
Before deploying, test locally to catch issues:

```bash
cd python/anomaly-service
python3 -c "from main import app; print('✓ Imports OK')"
```

### 3. Common Causes of 502

**A. Import Errors**
- Missing dependencies
- Python version mismatch
- Module not found

**B. Model Loading Crashes**
- Out of memory (model is ~83MB)
- Network issues downloading model
- Disk space issues

**C. Port Binding Issues**
- Service not listening on correct port
- Port already in use

**D. Startup Timeout**
- Model loading takes too long
- Render health check times out

## Solutions

### Solution 1: Check if Service Starts Without Model
The service should start even if model fails to load. Check logs for:
```
Starting voice anomaly detection service...
Service is ready - model loading in background
```

If you see errors before these lines, there's an import/startup issue.

### Solution 2: Increase Render Resources
If model loading is causing memory issues:
- Go to Render Dashboard → Service Settings
- Increase memory allocation
- Free tier has limited memory

### Solution 3: Check Python Version
Render might be using wrong Python version. Check `requirements.txt` or add:
```python
python-version: "3.10"
```

### Solution 4: Test Health Endpoint
Even if model isn't loaded, `/health` should return 200:
```bash
curl https://retrocare-python.onrender.com/health
```

Expected response (even during model loading):
```json
{
  "status": "loading",
  "service": "anomaly-detection",
  "model_loaded": false,
  "model_error": null,
  "model_loading": true
}
```

## Next Steps

1. **Check Render Logs** - Most important!
2. **Test locally** - Run `python main.py` locally
3. **Check health endpoint** - Should work even without model
4. **Review error messages** - Look for specific import or runtime errors


