# Environment Variables Setup

## Single .env File (Recommended)

You can now use **one `.env` file** at the root of the project for all environment variables.

### Setup:

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your values** in the root `.env` file

3. **That's it!** The backend will automatically load from:
   - `backend/.env` (if it exists - for backward compatibility)
   - OR `./.env` (root .env file)

## What Goes in .env

### Frontend Variables (Public - Safe):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

### Backend Variables (Secret):
- `ELEVENLABS_API_KEY`
- `VAPI_API_KEY`
- `VAPI_PHONE_NUMBER_ID`
- `VAPI_ASSISTANT_ID` (optional)
- `VAPI_WEBHOOK_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT`
- `NODE_ENV`

## For Deployment

When deploying to Render (or any platform), set **all** these variables in the platform's environment variables dashboard. The `.env` file is only for local development.

## Backward Compatibility

If you still have `backend/.env`, it will be used first. If not, the root `.env` will be used. This ensures existing setups continue to work.

