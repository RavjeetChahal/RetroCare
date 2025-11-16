# Fix Python Service 404 Error

## Problem

Your Python service at `https://retrocare-python.onrender.com` is returning **404** for `/health` and `/embed` endpoints, even though the code has these endpoints defined.

## Root Cause

The service is deployed but the endpoints aren't accessible. This usually means:

1. Wrong root directory in Render
2. Wrong start command
3. Service not running correctly
4. Missing dependencies

## Solution: Fix Render Deployment

Since you're deploying the **full RetroCare folder**, you need a **separate Python service** in Render that points to the `python/anomaly-service` subdirectory.

### Step 1: Create/Update Python Service in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. **If you already have a Python service:**
   - Click on it → Go to **Settings**
   - Update the configuration below
3. **If you don't have a Python service yet:**
   - Click **"New +"** → **"Web Service"**
   - Connect the **same GitHub repository** (RetroCare)
   - Name it: `retrocare-python`

### Step 2: Configure the Python Service

**Important:** Even though you're deploying the full repo, set these:

#### Root Directory

**Must be:** `python/anomaly-service`

This tells Render to only look in that subdirectory for the Python service.

#### Build Command

```
pip install -r requirements.txt
```

#### Start Command

```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### Environment

**Python 3** (not Node.js)

### Step 3: Verify Service is Running

After saving and redeploying, test:

```bash
curl https://retrocare-python.onrender.com/health
```

**Expected response:**

```json
{ "status": "ok", "service": "anomaly-detection", "model_loaded": true }
```

If you still get 404, check the logs (next step).

### Step 4: Check Render Logs

1. Go to Render Dashboard → Your Python Service
2. Click **"Logs"** tab
3. Look for:
   - `Application startup complete`
   - `Uvicorn running on`
   - Any errors about missing modules or imports

### Step 5: Common Fixes

#### Fix 1: Update Root Directory

If Root Directory is wrong:

1. Go to Settings → Root Directory
2. Set to: `python/anomaly-service`
3. Save and redeploy

#### Fix 2: Update Start Command

If Start Command is wrong:

1. Go to Settings → Start Command
2. Set to: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Save and redeploy

#### Fix 3: Check Environment Variables

Make sure these are set:

- `PORT` (Render sets this automatically, but verify)
- `CORS_ORIGINS` (optional, defaults to localhost)

#### Fix 4: Verify Requirements.txt Exists

Make sure `python/anomaly-service/requirements.txt` exists and has all dependencies.

### Step 6: Alternative Start Commands

If `uvicorn` isn't found, try:

**Option A: Using Python module**

```
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Option B: Using python main.py**
Update `main.py` to handle PORT from environment:

```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Set to False in production
        log_level="info"
    )
```

Then use start command: `python main.py`

### Step 7: Test After Fix

Once redeployed, test:

```bash
# Health check
curl https://retrocare-python.onrender.com/health

# Should return:
# {"status":"ok","service":"anomaly-detection","model_loaded":true}
```

## Quick Diagnostic

Run this to see what's actually deployed:

```bash
# Test root path
curl https://retrocare-python.onrender.com/

# Test health
curl https://retrocare-python.onrender.com/health

# Test with verbose output
curl -v https://retrocare-python.onrender.com/health
```

## Expected Render Configuration

### Service Type

**Web Service**

### Environment

**Python 3**

### Root Directory

```
python/anomaly-service
```

### Build Command

```
pip install -r requirements.txt
```

### Start Command

```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Environment Variables

```
PORT=8000  (Render sets this automatically)
CORS_ORIGINS=https://retrocare.onrender.com,http://localhost:3000
```

## If Still Getting 404

1. **Check Render Logs** - Look for startup errors
2. **Verify File Structure** - Make sure `main.py` is in the root directory
3. **Test Locally First**:
   ```bash
   cd python/anomaly-service
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   # Then test: curl http://localhost:8000/health
   ```
4. **Check Render Build Logs** - See if dependencies installed correctly

## After Fixing

Once the service returns 200 for `/health`, your anomaly detection will work automatically. The next call will:

1. ✅ Fetch recording URL from VAPI
2. ✅ Extract embedding from Python service
3. ✅ Compare with baseline
4. ✅ Store anomaly logs
