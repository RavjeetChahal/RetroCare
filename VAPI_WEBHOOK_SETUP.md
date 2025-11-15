# VAPI Webhook URL Setup

## Two Places to Set VAPI_WEBHOOK_URL

### 1. Render Environment Variables (What you're looking at)

**In Render Dashboard → Environment Variables:**
- **Key**: `VAPI_WEBHOOK_URL`
- **Value**: `https://your-app-name.onrender.com/api/vapi/call-ended`

**Important**: 
- Wait until after deployment to set this (you need your Render URL first)
- Replace `your-app-name` with your actual Render service name

### 2. VAPI Dashboard (Phone Number Settings)

**Go to VAPI Dashboard:**
1. Navigate to: https://dashboard.vapi.ai/
2. Go to **Phone Numbers** section
3. Click on your phone number
4. Find **Webhook URL** or **Call Webhook** setting
5. Set it to: `https://your-app-name.onrender.com/api/vapi/call-ended`

**Why both places?**
- **Render**: Your backend code reads this to know where to tell VAPI to send webhooks
- **VAPI Dashboard**: VAPI needs to know where to actually send the webhook events

## Step-by-Step Process

### Step 1: Deploy to Render First
1. Deploy your service
2. Get your Render URL (e.g., `retrocare-backend.onrender.com`)

### Step 2: Set in Render
1. Go to Render → Your Service → Environment
2. Add: `VAPI_WEBHOOK_URL=https://retrocare-backend.onrender.com/api/vapi/call-ended`
3. Save (service will restart)

### Step 3: Set in VAPI Dashboard
1. Go to https://dashboard.vapi.ai/
2. Phone Numbers → Your Phone Number
3. Set Webhook URL: `https://retrocare-backend.onrender.com/api/vapi/call-ended`
4. Save

### Step 4: Test
Make a test call and check if webhook is received at:
```
https://your-app-name.onrender.com/api/vapi/call-ended
```

## What Happens

When a call ends:
1. VAPI sends webhook to your Render URL
2. Your backend receives it at `/api/vapi/call-ended`
3. Backend processes the call data
4. Updates database, computes mood, checks anomalies, etc.

## Troubleshooting

**Webhook not received?**
- Check VAPI dashboard webhook URL is correct
- Check Render logs for incoming requests
- Verify your backend route is working: `curl https://your-app.onrender.com/health`

**Getting 404?**
- Make sure the route is `/api/vapi/call-ended` (not `/vapi/call-ended`)
- Check your `backend/routes/index.ts` has the vapiRoutes mounted

**Webhook received but errors?**
- Check Render logs for error messages
- Verify all environment variables are set correctly
- Check database connection (SUPABASE_SERVICE_ROLE_KEY)

