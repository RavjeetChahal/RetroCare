# Render Deployment - Build & Start Commands

## Commands for Render Dashboard

When creating a new Web Service on Render, use these commands:

### Build Command
```
npm install
```

### Start Command
```
npx tsx backend/server.ts
```

## Important Notes

1. **Port**: Render automatically sets the `PORT` environment variable. Your server already uses `process.env.PORT || 3000`, so it will automatically use Render's assigned port.

2. **Environment Variables**: Make sure to set these in Render's dashboard (Environment tab):
   - `ELEVENLABS_API_KEY`
   - `VAPI_API_KEY`
   - `VAPI_PHONE_NUMBER_ID`
   - `VAPI_WEBHOOK_URL` (set after deployment: `https://your-app.onrender.com/api/vapi/call-ended`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV=production` (optional, but recommended)

3. **Health Check**: Render will use `/health` endpoint to verify your service is running.

4. **Free Tier Note**: Render's free tier spins down after 15 minutes of inactivity. For production with cron jobs, consider:
   - Upgrading to paid plan ($7/month) for always-on service
   - Or use Railway/Fly.io which have better free tier options for always-on services

## Step-by-Step Render Setup

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `retrocare-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (uses repo root)
   - **Build Command**: `npm install`
   - **Start Command**: `npx tsx backend/server.ts`
5. Add environment variables (see above)
6. Click "Create Web Service"
7. Wait for deployment (~5-10 minutes)
8. Get your URL: `https://retrocare-backend.onrender.com`
9. Update `VAPI_WEBHOOK_URL` in Render environment variables:
   ```
   https://retrocare-backend.onrender.com/api/vapi/call-ended
   ```

## Alternative: Using render.yaml

If you prefer, you can use the `render.yaml` file I created. Render will auto-detect it:

1. Push `render.yaml` to your repository
2. In Render dashboard, select "Apply Render YAML"
3. Render will read the config from `render.yaml`

The `render.yaml` file already has the correct build and start commands configured.

