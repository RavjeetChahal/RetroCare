# Deploy Both Frontend & Backend

## Quick Answer

**For Render specifically**, if you want to deploy both:

### Backend (Already configured):
- **Build**: `npm install`
- **Start**: `npx tsx backend/server.ts`

### Frontend (New service):
- **Build**: `npm install && npx expo export --platform web`
- **Start**: `npx serve dist -s`

## Two Options

### Option 1: Deploy Separately (Recommended)

**Backend on Render:**
- Use existing `render.yaml` backend config
- Build: `npm install`
- Start: `npx tsx backend/server.ts`

**Frontend on Vercel/Netlify:**
- Better for static sites
- Faster builds
- Free tier is better
- See `FRONTEND_DEPLOYMENT.md`

### Option 2: Deploy Both on Render

Create **two separate services** in Render:

1. **Backend Service** (already done):
   - Build: `npm install`
   - Start: `npx tsx backend/server.ts`

2. **Frontend Service** (new):
   - Build: `npm install && npx expo export --platform web`
   - Start: `npx serve dist -s`
   - Environment: `Node`
   - Environment variables:
     ```
     EXPO_PUBLIC_API_URL=https://retrocare-backend.onrender.com
     EXPO_PUBLIC_SUPABASE_URL=your_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
     EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
     ```

The `render.yaml` file has a commented-out frontend service you can uncomment.

## Why Option 1 is Better

- ✅ Vercel/Netlify are optimized for static sites
- ✅ Faster deployments
- ✅ Better free tier
- ✅ Automatic CDN
- ✅ Better performance (CDN edge locations)

## Why Option 2 Works

- ✅ Everything in one place
- ✅ Easier to manage
- ⚠️ Slower builds (Expo export takes time)
- ⚠️ Uses more Render resources

## Summary

| Platform | Backend | Frontend | Best For |
|----------|---------|----------|----------|
| Render | ✅ Yes | ✅ Yes | All-in-one |
| Render + Vercel | ✅ Yes | ✅ Yes | **Recommended** |
| Railway + Vercel | ✅ Yes | ✅ Yes | Alternative |

**My recommendation**: Deploy backend on Render, frontend on Vercel.

