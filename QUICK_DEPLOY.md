# Quick Deployment Guide

## Your VAPI Webhook URL

After deployment, your webhook URL will be:
```
https://YOUR-DEPLOYMENT-URL.com/api/vapi/call-ended
```

## Fastest Option: Railway (5 minutes)

1. **Go to [railway.app](https://railway.app)** and sign up with GitHub

2. **Create New Project** → "Deploy from GitHub repo" → Select RetroCare

3. **Add Environment Variables** (in Railway dashboard → Variables):
   ```
   ELEVENLABS_API_KEY=your_key_here
   VAPI_API_KEY=your_key_here
   VAPI_PHONE_NUMBER_ID=your_id_here
   SUPABASE_SERVICE_ROLE_KEY=your_key_here
   PORT=3000
   ```

4. **Wait for deployment** (Railway auto-detects and deploys)

5. **Get your URL**:
   - Go to Settings → Domains
   - Copy your URL (e.g., `retrocare-production.up.railway.app`)

6. **Add webhook URL to Railway variables**:
   ```
   VAPI_WEBHOOK_URL=https://retrocare-production.up.railway.app/api/vapi/call-ended
   ```

7. **Configure VAPI**:
   - Go to [VAPI Dashboard](https://dashboard.vapi.ai/)
   - Phone Number Settings → Webhook URL
   - Set to: `https://retrocare-production.up.railway.app/api/vapi/call-ended`

8. **Update frontend** (root `.env`):
   ```
   EXPO_PUBLIC_API_URL=https://retrocare-production.up.railway.app
   ```

## Test It

```bash
# Test health endpoint
curl https://your-url.up.railway.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

Done! Your backend is live and ready to receive VAPI webhooks.

