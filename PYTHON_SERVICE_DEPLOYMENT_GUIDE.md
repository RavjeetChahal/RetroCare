# Python Service Deployment Guide

## Overview

Since you're deploying the **full RetroCare repository**, you need to create a **separate Python service** in Render that points to the `python/anomaly-service` subdirectory.

## Quick Setup Steps

### 1. Create New Python Service in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your **GitHub repository** (same repo as your backend)
4. Name it: `retrocare-python`

### 2. Configure the Service

**Critical Settings:**

| Setting | Value |
|---------|-------|
| **Environment** | Python 3 |
| **Root Directory** | `python/anomaly-service` ⚠️ **This is the key!** |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/health` |

### 3. Environment Variables

**Required:** None (all have defaults)

**Recommended for Production:**

Add these in Render → Environment tab:

| Variable | Value | Required? | Notes |
|----------|-------|-----------|-------|
| `PORT` | `8000` | No | Render sets this automatically via `$PORT` |
| `CORS_ORIGINS` | `https://retrocare.onrender.com,http://localhost:3000` | **Yes** | Allows your backend to make requests |

**Minimum Setup:**
Just set `CORS_ORIGINS`:
```
CORS_ORIGINS=https://retrocare.onrender.com,http://localhost:3000
```

**Why CORS_ORIGINS is important:**
- Without it, your backend at `https://retrocare.onrender.com` will get CORS errors
- The default only allows `localhost`, which won't work in production
- Include your backend URL so it can call the Python service

### 4. Deploy

1. Click **"Create Web Service"**
2. Wait for deployment to complete
3. Copy the service URL (e.g., `https://retrocare-python.onrender.com`)

### 5. Update Backend Environment Variable

1. Go to your **backend service** in Render (`retrocare-backend`)
2. Go to **Environment** tab
3. Add/Update: `PYTHON_SERVICE_URL=https://retrocare-python.onrender.com`
4. Save (this will trigger a redeploy)

### 6. Test

```bash
# Test Python service
curl https://retrocare-python.onrender.com/health

# Should return:
# {"status":"ok","service":"anomaly-detection","model_loaded":true}

# Test from backend
curl https://retrocare.onrender.com/api/python-service-status
```

## Why Separate Services?

- **Node.js backend** runs on one service (handles API, webhooks, etc.)
- **Python service** runs on a separate service (handles ML/embedding extraction)
- Both can use the **same GitHub repo** but different root directories

## Troubleshooting

### Issue: Still Getting 404

**Check Root Directory:**
- Must be exactly: `python/anomaly-service`
- Not: `python` or `python/anomaly-service/` (no trailing slash)
- Not: `.` (root)

**Check Start Command:**
- Must be: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Not: `python main.py` (unless you modify main.py)
- Not: `uvicorn main:app` (missing host/port)

**Check Logs:**
- Look for: `Application startup complete`
- Look for: `Uvicorn running on http://0.0.0.0:PORT`
- If you see errors about missing `main.py`, root directory is wrong

### Issue: Build Fails

**Check requirements.txt exists:**
- File must be at: `python/anomaly-service/requirements.txt`
- Verify it has all dependencies

**Check Python version:**
- Render should auto-detect Python 3
- If not, manually set to Python 3.10 or 3.11

### Issue: Service Starts But Returns 404

**Check if uvicorn is installed:**
- Should be in `requirements.txt`
- If missing, add: `uvicorn[standard]`

**Check if main.py exists:**
- File must be at: `python/anomaly-service/main.py`
- Verify the file exists in your repo

## File Structure

Your repo structure should look like:
```
RetroCare/
├── backend/           # Node.js backend (deployed as retrocare-backend)
├── python/
│   └── anomaly-service/  # Python service (deployed as retrocare-python)
│       ├── main.py
│       ├── requirements.txt
│       ├── utils/
│       └── models/
└── app/              # Frontend
```

## Render Dashboard Summary

You should have **2 services** in Render:

1. **retrocare-backend** (Node.js)
   - Root: `.` (or `backend`)
   - Start: `npx tsx backend/server.ts`

2. **retrocare-python** (Python) ⭐ **This is what you need to create/fix**
   - Root: `python/anomaly-service`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## After Deployment

Once both services are running:

1. ✅ Backend health: `https://retrocare.onrender.com/health`
2. ✅ Python health: `https://retrocare-python.onrender.com/health`
3. ✅ Connectivity check: `https://retrocare.onrender.com/api/python-service-status`

Then your next call will successfully:
- Extract voice embeddings
- Compare with baseline
- Store anomaly logs
- Send alerts if needed

