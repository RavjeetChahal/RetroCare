# Troubleshooting 502 Bad Gateway on Render

## What 502 Means

A 502 Bad Gateway means Render can't connect to your server. This usually means:
- Server isn't starting
- Server is crashing on startup
- Server isn't listening on the correct port
- Code error preventing startup

## Step 1: Check Render Logs

1. Go to Render Dashboard → Your Service
2. Click **"Logs"** tab (or "Live tail")
3. Look for error messages

Common errors you might see:

### Error: "Cannot find module"
- **Fix**: Make sure all files are committed and pushed to git

### Error: "Port already in use" or "EADDRINUSE"
- **Fix**: Render sets `PORT` automatically - make sure you're using `process.env.PORT`

### Error: "Missing environment variables"
- **Fix**: Check all required env vars are set in Render dashboard

### Error: "SyntaxError" or "TypeError"
- **Fix**: Check the code for syntax errors

## Step 2: Common Issues & Fixes

### Issue 1: Port Configuration

**Check**: Your server must use `process.env.PORT` (Render sets this automatically)

```typescript
// ✅ Correct
const PORT = process.env.PORT || 3000;

// ❌ Wrong (hardcoded port)
const PORT = 3000;
```

### Issue 2: Missing Dependencies

**Check**: All dependencies in `package.json`

**Fix**: Make sure `tsx` is in `devDependencies` or `dependencies`

### Issue 3: Import Errors

**Check**: All imports are correct

**Common issue**: Using `require()` instead of `import` in TypeScript

### Issue 4: Environment Variables

**Check**: All required env vars are set:
- `ELEVENLABS_API_KEY`
- `VAPI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_API_URL`

## Step 3: Quick Debug Steps

### 1. Test Health Endpoint

Once server starts, test:
```bash
curl https://your-app.onrender.com/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### 2. Check Start Command

In Render dashboard, verify Start Command is:
```
npx tsx backend/server.ts
```

### 3. Check Build Command

Should be:
```
npm install && npx expo export --platform web
```

### 4. Verify File Structure

Make sure these files exist in your repo:
- `backend/server.ts`
- `backend/routes/index.ts`
- `backend/scheduler/callScheduler.ts`
- All other backend files

## Step 4: Add Debug Logging

If server starts but immediately crashes, add logging:

```typescript
// At the very top of server.ts
console.log('Server starting...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
```

## Step 5: Check Render Logs for Specific Errors

Look for these patterns in logs:

### "Error: Cannot find module"
→ File missing or not committed

### "Error: listen EADDRINUSE"
→ Port conflict (shouldn't happen on Render)

### "Missing required environment variables"
→ Add missing vars in Render dashboard

### "SyntaxError: Unexpected token"
→ TypeScript/JavaScript syntax error

### "TypeError: Cannot read property"
→ Runtime error - check the specific line

## Most Likely Causes for Your Case

Based on your setup:

1. **Missing `fs` import** - I just added this, make sure it's committed
2. **Static file serving error** - The `dist` folder might not exist yet
3. **Route mounting issue** - Check `routes/index.ts` is correct

## Quick Fix to Try

Temporarily simplify `server.ts` to test:

```typescript
// Comment out static file serving temporarily
// if (frontendExists) { ... }
```

If that works, the issue is with static file serving. If not, it's something else.

## Next Steps

1. **Check Render logs** - This will tell you the exact error
2. **Share the error message** - I can help fix the specific issue
3. **Verify all files are committed** - `git status` to check

The logs will show exactly what's wrong!

