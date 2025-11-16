# Diagnostic Endpoint Guide

## Available Endpoints

After deploying, these endpoints will be available:

### 1. Test Diagnostics Router (Simple Test)
```
GET https://retrocare.onrender.com/api/diagnostics
```
**Expected Response:**
```json
{
  "message": "Diagnostics endpoints available",
  "endpoints": {
    "pythonService": "/api/diagnostics/python-service",
    "health": "/api/diagnostics/health"
  }
}
```

### 2. Diagnostics Health Check
```
GET https://retrocare.onrender.com/api/diagnostics/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T...",
  "message": "Diagnostics router is working"
}
```

### 3. Python Service Connectivity Check (Main Endpoint)
```
GET https://retrocare.onrender.com/api/diagnostics/python-service
```
**Expected Response:**
```json
{
  "configuredUrl": "http://localhost:8000",
  "environment": "production",
  "timestamp": "2025-11-16T...",
  "tests": {
    "healthCheck": { ... },
    "directHttp": { ... },
    "embedEndpoint": { ... }
  },
  "summary": {
    "allTestsPassed": false,
    "status": "unhealthy",
    "recommendation": "..."
  }
}
```

## Troubleshooting "API endpoint not found"

If you're getting `{"error":"API endpoint not found"}`, try these steps:

### Step 1: Verify the URL
Make sure you're using the correct URL:
- ✅ Correct: `https://retrocare.onrender.com/api/diagnostics/python-service`
- ❌ Wrong: `https://retrocare.onrender.com/diagnostics/python-service` (missing `/api`)
- ❌ Wrong: `https://retrocare.onrender.com/api/python-service` (missing `/diagnostics`)

### Step 2: Check if Code is Deployed
The diagnostic endpoints are new - make sure you've:
1. Committed the changes
2. Pushed to GitHub (if using Render auto-deploy)
3. Or manually triggered a deploy in Render dashboard
4. Waited for deployment to complete

### Step 3: Test Basic Endpoints First
Try these endpoints to verify routing works:

1. **Backend Health Check:**
   ```
   GET https://retrocare.onrender.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **API Base:**
   ```
   GET https://retrocare.onrender.com/api/diagnostics
   ```
   Should return the list of endpoints

3. **Diagnostics Health:**
   ```
   GET https://retrocare.onrender.com/api/diagnostics/health
   ```
   Should return: `{"status":"ok",...}`

### Step 4: Check Render Logs
1. Go to Render Dashboard → Your Backend Service
2. Click **"Logs"** tab
3. Look for:
   - `✓ API routes available at /api/*`
   - Any errors about route registration
   - Requests to `/api/diagnostics/*`

### Step 5: Verify Route Registration
Check that the routes are being loaded. In Render logs, you should see:
```
[RetroCare] Loaded environment from: ...
[RetroCare] RetroCare server running on port ...
[RetroCare] ✓ API routes available at /api/*
```

## Quick Test Commands

### Using curl:
```bash
# Test 1: Basic health
curl https://retrocare.onrender.com/health

# Test 2: Diagnostics list
curl https://retrocare.onrender.com/api/diagnostics

# Test 3: Diagnostics health
curl https://retrocare.onrender.com/api/diagnostics/health

# Test 4: Python service check
curl https://retrocare.onrender.com/api/diagnostics/python-service
```

### Using Browser:
Just paste the URLs above into your browser address bar.

## If Still Not Working

1. **Check Render Deployment Status**
   - Make sure deployment completed successfully
   - Check for build errors

2. **Verify File Structure**
   - Ensure `backend/routes/diagnostics.ts` exists
   - Ensure `backend/routes/index.ts` imports it

3. **Check for Typos**
   - URL must be exactly: `/api/diagnostics/python-service`
   - Case-sensitive

4. **Restart Service**
   - In Render dashboard → Click "Manual Deploy" → "Deploy latest commit"

## What the Python Service Check Will Show

Once the endpoint works, it will test:

1. **Health Check Test**
   - Uses the `checkPythonServiceHealth()` function
   - Tests if Python service responds to `/health`

2. **Direct HTTP Test**
   - Makes direct HTTP request to Python service
   - Shows connection status, error codes, etc.

3. **Embed Endpoint Test**
   - Tests if `/embed` endpoint exists
   - Uses dummy data (will fail but tests connectivity)

4. **Summary & Recommendations**
   - Overall status
   - Specific recommendations based on test results

## Expected Results

### If Python Service is Running:
```json
{
  "configuredUrl": "https://your-python-service.onrender.com",
  "tests": {
    "healthCheck": { "status": "success", "isHealthy": true },
    "directHttp": { "status": "success", "statusCode": 200 },
    "embedEndpoint": { "status": "success" }
  },
  "summary": {
    "allTestsPassed": true,
    "status": "healthy",
    "recommendation": "Python service is accessible and healthy"
  }
}
```

### If Python Service is Not Running:
```json
{
  "configuredUrl": "http://localhost:8000",
  "tests": {
    "healthCheck": { 
      "status": "failed", 
      "code": "ECONNREFUSED",
      "message": "Health check failed - service may not be reachable"
    },
    "directHttp": { 
      "status": "failed", 
      "code": "ECONNREFUSED",
      "message": "Connection refused - service is not running or URL is incorrect"
    }
  },
  "summary": {
    "allTestsPassed": false,
    "status": "unhealthy",
    "recommendation": "Python service is not reachable. Check: 1) Service is deployed and running, 2) PYTHON_SERVICE_URL is correct, 3) Service is publicly accessible"
  }
}
```

