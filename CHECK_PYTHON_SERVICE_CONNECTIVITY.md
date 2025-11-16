# How to Check Python Service Connectivity from Deployed Backend

Based on your logs, your backend is deployed on **Render** (`retrocare.onrender.com`). Here's how to verify the Python service is accessible:

## Method 1: Check Environment Variables in Render Dashboard

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Navigate to your backend service (`retrocare`)

2. **Check Environment Variables**
   - Click on **"Environment"** tab
   - Look for `PYTHON_SERVICE_URL`
   - Verify it's set correctly (e.g., `https://your-python-service.onrender.com`)

3. **If Missing, Add It**
   - Click **"Add Environment Variable"**
   - Key: `PYTHON_SERVICE_URL`
   - Value: Your Python service URL (e.g., `https://retrocare-python-service.onrender.com`)
   - Click **"Save Changes"** (this will trigger a redeploy)

## Method 2: Add a Health Check Endpoint to Your Backend

Add this endpoint to test connectivity from your backend:

```typescript
// Add to backend/routes/index.ts or backend/server.ts

import { checkPythonServiceHealth } from '../anomaly/pythonClient';

// Add this route
app.get('/api/health/python-service', async (req, res) => {
  try {
    const isHealthy = await checkPythonServiceHealth();
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    
    res.json({
      pythonServiceUrl,
      isHealthy,
      status: isHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
      isHealthy: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
```

Then test it:
```bash
curl https://retrocare.onrender.com/api/health/python-service
```

## Method 3: Check Backend Logs for Connection Details

The improved error logging will now show:

1. **Connection Errors:**
   ```
   Python service not reachable at [URL]. Is the service running?
   ```
   - Means: Service is not accessible (not running, wrong URL, or network issue)

2. **Timeout Errors:**
   ```
   Python service request timed out after 60s...
   ```
   - Means: Service is reachable but taking too long to respond

3. **HTTP Errors:**
   ```
   Python service returned error 500: [error message]
   ```
   - Means: Service is reachable but returning an error

## Method 4: Test from Render Shell (Most Direct)

1. **Open Render Shell**
   - In Render dashboard → Your backend service
   - Click **"Shell"** tab
   - This gives you a terminal on the Render server

2. **Test Connectivity**
   ```bash
   # Check if PYTHON_SERVICE_URL is set
   echo $PYTHON_SERVICE_URL
   
   # Test HTTP connectivity
   curl -v $PYTHON_SERVICE_URL/health
   
   # Test with timeout
   curl --max-time 10 $PYTHON_SERVICE_URL/health
   ```

3. **Check DNS Resolution**
   ```bash
   # Extract hostname from URL
   # If PYTHON_SERVICE_URL=https://retrocare-python.onrender.com
   nslookup retrocare-python.onrender.com
   ```

## Method 5: Check Python Service Logs

If your Python service is also on Render:

1. **Go to Python Service Dashboard**
   - Navigate to your Python service in Render
   - Check **"Logs"** tab
   - Look for incoming requests from your backend

2. **Check for CORS Errors**
   - If you see CORS errors, the Python service needs to allow requests from your backend domain
   - Update Python service CORS settings to include: `https://retrocare.onrender.com`

## Common Issues & Solutions

### Issue 1: `ECONNREFUSED` or `ENOTFOUND`
**Problem:** Python service URL is wrong or service isn't running

**Solution:**
- Verify Python service is deployed and running
- Check the exact URL in Python service dashboard
- Ensure `PYTHON_SERVICE_URL` matches exactly (including `https://`)

### Issue 2: Service Works Locally but Not in Production
**Problem:** Using `localhost` URL in production

**Solution:**
- Never use `localhost` in production
- Use the full public URL: `https://your-python-service.onrender.com`
- Ensure Python service is publicly accessible (not private/internal)

### Issue 3: Timeout Errors
**Problem:** Python service is slow or overloaded

**Solution:**
- Check Python service logs for errors
- Verify Python service has enough resources
- Consider increasing timeout (currently 60s)

### Issue 4: CORS Errors
**Problem:** Python service blocking requests from backend domain

**Solution:**
- Update Python service CORS settings:
  ```python
  # In python/anomaly-service/main.py
  from fastapi.middleware.cors import CORSMiddleware
  
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[
          "https://retrocare.onrender.com",
          "http://localhost:3000",  # For local dev
      ],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

## Quick Diagnostic Script

Add this to your backend to get full diagnostic info:

```typescript
// backend/routes/diagnostics.ts
import express from 'express';
import { checkPythonServiceHealth } from '../anomaly/pythonClient';
import axios from 'axios';

const router = express.Router();

router.get('/python-service', async (req, res) => {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  
  const diagnostics = {
    configuredUrl: pythonServiceUrl,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    tests: {},
  };
  
  // Test 1: Health check
  try {
    const isHealthy = await checkPythonServiceHealth();
    diagnostics.tests.healthCheck = {
      status: 'success',
      isHealthy,
    };
  } catch (error: any) {
    diagnostics.tests.healthCheck = {
      status: 'failed',
      error: error.message,
      code: error.code,
    };
  }
  
  // Test 2: Direct HTTP request
  try {
    const response = await axios.get(`${pythonServiceUrl}/health`, {
      timeout: 5000,
    });
    diagnostics.tests.directHttp = {
      status: 'success',
      statusCode: response.status,
      data: response.data,
    };
  } catch (error: any) {
    diagnostics.tests.directHttp = {
      status: 'failed',
      error: error.message,
      code: error.code,
      statusCode: error.response?.status,
    };
  }
  
  res.json(diagnostics);
});

export default router;
```

Then access: `https://retrocare.onrender.com/api/diagnostics/python-service`

## Next Steps

1. **Check Render Environment Variables** - Verify `PYTHON_SERVICE_URL` is set
2. **Test Health Endpoint** - Use Method 2 or 4 above
3. **Check Logs** - Look for the improved error messages in your next call
4. **Deploy Python Service** - If not deployed yet, deploy it to Render or another service

## Python Service Deployment Options

### Option 1: Deploy to Render (Easiest)
1. Create new **Web Service** in Render
2. Connect your GitHub repo
3. Set **Root Directory** to `python/anomaly-service`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable: `PORT=8000`
7. Copy the service URL and add to backend's `PYTHON_SERVICE_URL`

### Option 2: Deploy to Railway
Similar to Render, but Railway auto-detects Python services

### Option 3: Deploy to Fly.io
Good for Python services, supports Docker

### Option 4: Keep Local (Development Only)
Only works if backend is also local. Not recommended for production.

