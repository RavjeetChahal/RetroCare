# RetroCare Backend Deployment Guide

## VAPI Webhook URL

Your VAPI webhook URL should be:

```
https://your-deployed-backend.com/api/vapi/call-ended
```

Replace `your-deployed-backend.com` with your actual deployment URL.

## Deployment Options

### Option 1: Railway (Recommended - Easiest)

Railway is great for Node.js apps with cron jobs.

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create new project**:

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your RetroCare repository

3. **Configure environment variables**:

   - Go to your project → Variables tab
   - Add all variables from `backend/.env`:
     ```
     ELEVENLABS_API_KEY=your_key
     VAPI_API_KEY=your_key
     VAPI_PHONE_NUMBER_ID=your_id
     VAPI_WEBHOOK_URL=https://your-app-name.up.railway.app/api/vapi/call-ended
     SUPABASE_SERVICE_ROLE_KEY=your_key
     PORT=3000
     ```

4. **Deploy**:

   - Railway auto-detects Node.js and will run `npm install`
   - It will use the `railway.json` config
   - Your app will be live at: `https://your-app-name.up.railway.app`

5. **Get your URL**:
   - Go to Settings → Domains
   - Copy your Railway URL
   - Update `VAPI_WEBHOOK_URL` with this URL

**Cost**: Free tier available, then ~$5-10/month

---

### Option 2: Render

Render is another good option with free tier.

1. **Sign up**: Go to [render.com](https://render.com) and sign up

2. **Create new Web Service**:

   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your RetroCare repo

3. **Configure**:

   - **Name**: `retrocare-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npx tsx backend/server.ts`
   - **Health Check Path**: `/health`

4. **Set environment variables**:

   - Go to Environment tab
   - Add all variables from `backend/.env`
   - Set `VAPI_WEBHOOK_URL` to: `https://retrocare-backend.onrender.com/api/vapi/call-ended`

5. **Deploy**:
   - Click "Create Web Service"
   - Render will build and deploy automatically

**Cost**: Free tier available (spins down after 15min inactivity), paid starts at $7/month

---

### Option 3: Fly.io

Fly.io is great for always-on services.

1. **Install Fly CLI**:

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Sign up and login**:

   ```bash
   fly auth signup
   fly auth login
   ```

3. **Launch app**:

   ```bash
   fly launch
   ```

   - Follow prompts
   - Don't deploy yet (we need to configure first)

4. **Configure**:

   - Edit `fly.toml` (created by `fly launch`)
   - Set environment variables:

   ```bash
   fly secrets set ELEVENLABS_API_KEY=your_key
   fly secrets set VAPI_API_KEY=your_key
   fly secrets set VAPI_PHONE_NUMBER_ID=your_id
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
   fly secrets set VAPI_WEBHOOK_URL=https://your-app.fly.dev/api/vapi/call-ended
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

**Cost**: Free tier available, then pay-as-you-go

---

### Option 4: Vercel (Serverless Functions)

⚠️ **Note**: Vercel uses serverless functions, which may not be ideal for cron jobs. Consider this only if you move cron to a separate service.

1. **Install Vercel CLI**:

   ```bash
   npm i -g vercel
   ```

2. **Create `vercel.json`**:

   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "backend/server.ts",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "backend/server.ts"
       }
     ]
   }
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

---

## Recommended: Railway

**Why Railway?**

- ✅ Easy setup (GitHub integration)
- ✅ Always-on (perfect for cron jobs)
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Environment variable management
- ✅ Logs and monitoring

## After Deployment

1. **Get your deployment URL**:

   - Railway: `https://your-app-name.up.railway.app`
   - Render: `https://your-app-name.onrender.com`
   - Fly.io: `https://your-app-name.fly.dev`

2. **Set VAPI Webhook URL**:

   ```
   https://your-deployment-url.com/api/vapi/call-ended
   ```

3. **Update VAPI Dashboard**:

   - Go to [VAPI Dashboard](https://dashboard.vapi.ai/)
   - Navigate to your phone number settings
   - Set webhook URL to your deployment URL + `/api/vapi/call-ended`

4. **Update frontend** (if needed):

   - Update `EXPO_PUBLIC_API_URL` in your root `.env`:
     ```
     EXPO_PUBLIC_API_URL=https://your-deployment-url.com
     ```

5. **Test the webhook**:
   ```bash
   curl https://your-deployment-url.com/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

## Environment Variables Checklist

Make sure these are set in your deployment platform:

- ✅ `ELEVENLABS_API_KEY`
- ✅ `VAPI_API_KEY`
- ✅ `VAPI_PHONE_NUMBER_ID`
- ✅ `VAPI_WEBHOOK_URL` (set after deployment)
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `PORT` (usually auto-set, but can be 3000 or platform default)

## Troubleshooting

### Cron job not running?

- Check that your deployment platform supports long-running processes
- Railway and Render (paid) support this
- Fly.io supports this

### Webhook not receiving calls?

- Verify `VAPI_WEBHOOK_URL` is set correctly
- Check VAPI dashboard webhook settings
- Test webhook endpoint manually:
  ```bash
  curl -X POST https://your-url.com/api/vapi/call-ended \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

### Environment variables not loading?

- Make sure variables are set in deployment platform (not just `.env` file)
- `.env` files are not deployed to production
- Use platform's environment variable UI
