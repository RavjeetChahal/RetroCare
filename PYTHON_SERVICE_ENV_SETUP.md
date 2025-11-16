# Python Service Environment Variables Setup

## ✅ Service is Deployed!

Your Python service is now live at: `https://retrocare-python.onrender.com`

## Environment Variables Needed

### Required: None
The service will work without any environment variables (uses defaults).

### Recommended: `CORS_ORIGINS`

**Why you need it:**
- Without it, your backend will get CORS errors when calling the Python service
- Default only allows `localhost`, which won't work in production

**How to set it:**

1. Go to Render Dashboard → Your Python Service (`retrocare-python`)
2. Click **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Set:
   - **Key:** `CORS_ORIGINS`
   - **Value:** `https://retrocare.onrender.com,http://localhost:3000`
5. Click **"Save Changes"** (this will trigger a redeploy)

**Note:** Replace `retrocare.onrender.com` with your actual backend URL if different.

### Optional: `PORT`

Render sets this automatically via `$PORT`, so you don't need to set it manually.

## Test Your Service

After setting CORS_ORIGINS (or even without it, for testing):

```bash
# Test health endpoint
curl https://retrocare-python.onrender.com/health

# Should return:
# {"status":"ok","service":"anomaly-detection","model_loaded":true}
```

## Update Backend Environment Variable

Make sure your backend knows where the Python service is:

1. Go to Render Dashboard → Your Backend Service (`retrocare-backend`)
2. Click **"Environment"** tab
3. Add/Update:
   - **Key:** `PYTHON_SERVICE_URL`
   - **Value:** `https://retrocare-python.onrender.com`
4. Click **"Save Changes"**

## Verify Everything Works

Test the connectivity:

```bash
# From your backend
curl https://retrocare.onrender.com/api/python-service-status
```

Should show:
```json
{
  "configuredUrl": "https://retrocare-python.onrender.com",
  "tests": {
    "healthCheck": { "status": "success", "isHealthy": true },
    "directHttp": { "status": "success", "statusCode": 200 }
  },
  "summary": {
    "allTestsPassed": true,
    "status": "healthy"
  }
}
```

## Summary

**Python Service Environment Variables:**
- ✅ `CORS_ORIGINS` (recommended) - Set to allow your backend to call it
- ❌ `PORT` (not needed) - Render sets this automatically

**Backend Environment Variables:**
- ✅ `PYTHON_SERVICE_URL` - Set to `https://retrocare-python.onrender.com`

Once both are set, your next call will successfully:
1. ✅ Extract voice embeddings
2. ✅ Compare with baseline
3. ✅ Store anomaly logs
4. ✅ Send alerts if needed

