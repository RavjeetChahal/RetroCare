# Environment Variables for Deployment

## You Have Two .env Files

1. **Root `.env`** - Frontend variables (public, safe to bundle)
2. **`backend/.env`** - Backend variables (sensitive, secret keys)

## How It Works in Production

### In Development:
- Code reads from `.env` files on disk
- Frontend reads from root `.env`
- Backend reads from `backend/.env`

### In Production (Render/Deployed):
- **No `.env` files are deployed!** (They're gitignored)
- Environment variables are set in the deployment platform's dashboard
- Code reads from `process.env` (set by the platform)

## Setting Environment Variables on Render

When deploying to Render, you need to set **ALL** environment variables in Render's dashboard, combining both files.

### Step-by-Step:

1. **Go to Render Dashboard** → Your Service → Environment tab

2. **Add ALL variables from both files:**

#### From Root `.env` (Frontend):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
EXPO_PUBLIC_API_URL=https://your-app.onrender.com
```

#### From `backend/.env` (Backend):
```
ELEVENLABS_API_KEY=your_elevenlabs_key
VAPI_API_KEY=your_vapi_key
VAPI_PHONE_NUMBER_ID=your_phone_number_id
VAPI_ASSISTANT_ID=your_assistant_id (optional)
VAPI_WEBHOOK_URL=https://your-app.onrender.com/api/vapi/call-ended
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000
NODE_ENV=production
```

3. **Click "Save Changes"** - Render will restart your service

## Complete List for Render

Copy-paste this into Render's environment variables (replace with your actual values):

```bash
# Frontend (Public - Safe to expose)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
EXPO_PUBLIC_API_URL=https://your-app.onrender.com

# Backend (Secret - Never expose)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
VAPI_ASSISTANT_ID=your_vapi_assistant_id (optional)
VAPI_WEBHOOK_URL=https://your-app.onrender.com/api/vapi/call-ended
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Config
PORT=3000
NODE_ENV=production
```

## How the Code Handles This

### Backend (`backend/server.ts` or `serverWithFrontend.ts`):

```typescript
// In development: loads from backend/.env
// In production: uses process.env (set by Render)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: 'backend/.env' });
} else {
  // Uses process.env directly (set by platform)
}
```

### Frontend:

```typescript
// Always reads from process.env
// In development: Expo loads from root .env
// In production: Set in Render dashboard
const API_URL = process.env.EXPO_PUBLIC_API_URL;
```

## Important Notes

### 1. `EXPO_PUBLIC_API_URL` Value

When deploying together, set this to your Render URL:
```
EXPO_PUBLIC_API_URL=https://your-app-name.onrender.com
```

### 2. `VAPI_WEBHOOK_URL`

Set this after you know your deployment URL:
```
VAPI_WEBHOOK_URL=https://your-app-name.onrender.com/api/vapi/call-ended
```

### 3. Frontend Variables

Even though you're deploying together, the frontend still needs `EXPO_PUBLIC_*` variables because:
- Expo bundles them at build time
- They're embedded in the JavaScript bundle
- They're public anyway (safe to expose)

### 4. Backend Variables

These are **secret** and should never be exposed:
- `ELEVENLABS_API_KEY`
- `VAPI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

They're only used server-side, never sent to the browser.

## Quick Checklist

Before deploying:

- [ ] Copy all variables from root `.env` to Render
- [ ] Copy all variables from `backend/.env` to Render
- [ ] Update `EXPO_PUBLIC_API_URL` to your Render URL
- [ ] Update `VAPI_WEBHOOK_URL` to your Render URL + `/api/vapi/call-ended`
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT=3000` (or let Render auto-assign)

## Example: Render Environment Variables UI

In Render dashboard:
```
Key: EXPO_PUBLIC_SUPABASE_URL
Value: https://abc123.supabase.co

Key: ELEVENLABS_API_KEY
Value: sk_abc123xyz...

Key: VAPI_API_KEY
Value: your_vapi_key_here
...
```

## Troubleshooting

### "Environment variable not found"
- Check you added it in Render dashboard
- Check spelling (case-sensitive!)
- Restart service after adding variables

### "Frontend can't connect to backend"
- Check `EXPO_PUBLIC_API_URL` is set correctly
- Should be: `https://your-app.onrender.com`
- Not: `http://localhost:3000`

### "Backend can't connect to database"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Check it's the **service role** key, not anon key

## Security Reminder

✅ **Safe to expose** (in frontend):
- `EXPO_PUBLIC_*` variables
- `VITE_CLERK_PUBLISHABLE_KEY`

❌ **Never expose** (backend only):
- `ELEVENLABS_API_KEY`
- `VAPI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PHONE_NUMBER_ID`

These backend variables are only used server-side and never sent to the browser.

