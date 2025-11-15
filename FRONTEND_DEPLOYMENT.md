# Frontend Deployment Guide

## Overview

Your RetroCare app has two parts:
- **Backend**: Express.js API server (deployed on Render/Railway/Fly.io)
- **Frontend**: Expo React Native app (can be deployed as web or mobile)

## Deployment Options

### Option 1: Deploy Frontend Web App (Recommended for Web)

Deploy the Expo web build to Vercel or Netlify.

#### For Vercel:

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Create `vercel.json`**:
   ```json
   {
     "buildCommand": "npm install && npx expo export --platform web",
     "outputDirectory": "dist",
     "devCommand": "npx expo start --web",
     "installCommand": "npm install",
     "framework": null,
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

3. **Set Environment Variables** in Vercel dashboard:
   ```
   EXPO_PUBLIC_API_URL=https://your-backend.onrender.com
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
   ```

4. **Deploy**:
   ```bash
   vercel
   ```

#### For Netlify:

1. **Create `netlify.toml`**:
   ```toml
   [build]
     command = "npm install && npx expo export --platform web"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Set Environment Variables** in Netlify dashboard (same as Vercel)

3. **Deploy**: Connect GitHub repo in Netlify dashboard

---

### Option 2: Deploy Mobile App (EAS Build)

For iOS/Android native apps using Expo's EAS Build.

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login**:
   ```bash
   eas login
   ```

3. **Configure**:
   ```bash
   eas build:configure
   ```

4. **Create `eas.json`**:
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "preview": {
         "distribution": "internal",
         "env": {
           "EXPO_PUBLIC_API_URL": "https://your-backend.onrender.com"
         }
       },
       "production": {
         "env": {
           "EXPO_PUBLIC_API_URL": "https://your-backend.onrender.com"
         }
       }
     },
     "submit": {
       "production": {}
     }
   }
   ```

5. **Build**:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

6. **Submit to stores** (optional):
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

---

### Option 3: Deploy Both on Same Platform (Advanced)

You can deploy both frontend and backend on Render, but they need to be **separate services**.

#### Render Setup (Two Services):

1. **Backend Service** (already configured):
   - Build: `npm install`
   - Start: `npx tsx backend/server.ts`

2. **Frontend Service** (new):
   - Build: `npm install && npx expo export --platform web`
   - Start: `npx serve dist -s` (or use a static file server)
   - Environment: `Node`

**Note**: You'll need to install `serve`:
```bash
npm install --save-dev serve
```

Then update `package.json`:
```json
{
  "scripts": {
    "serve": "serve dist -s"
  }
}
```

---

## Configuration Steps

### 1. Update Frontend Environment Variables

After deploying backend, update your frontend `.env`:

```env
# Point to your deployed backend
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com

# Other public variables
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
```

### 2. Rebuild Frontend

After updating environment variables, rebuild:

```bash
# For web
npx expo export --platform web

# For mobile (EAS)
eas build --platform all
```

### 3. Test Connection

Verify frontend can reach backend:
```bash
curl https://your-backend.onrender.com/health
```

---

## Recommended Architecture

```
┌─────────────────────┐
│   Frontend (Web)    │
│   Vercel/Netlify    │
│   or EAS (Mobile)   │
└──────────┬──────────┘
           │
           │ HTTP Requests
           │
┌──────────▼──────────┐
│   Backend (API)     │
│   Render/Railway    │
│   /api/* endpoints  │
└──────────┬──────────┘
           │
           │
┌──────────▼──────────┐
│   Supabase          │
│   Database          │
└─────────────────────┘
```

**Best Practice**: Deploy separately
- Frontend: Vercel (web) or EAS (mobile)
- Backend: Render/Railway/Fly.io

---

## Quick Start: Deploy Frontend Web to Vercel

1. **Update `.env`** with deployed backend URL:
   ```
   EXPO_PUBLIC_API_URL=https://your-backend.onrender.com
   ```

2. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Set environment variables** in Vercel dashboard

5. **Done!** Your frontend is live

---

## Troubleshooting

### Frontend can't reach backend?
- Check CORS is enabled on backend (already configured)
- Verify `EXPO_PUBLIC_API_URL` is correct
- Check backend is running: `curl https://your-backend.com/health`

### Build fails?
- Make sure all dependencies are in `package.json`
- Check Node version (should be 18+)
- Verify environment variables are set

### Mobile app not connecting?
- For EAS builds, environment variables must be in `eas.json`
- Rebuild after changing environment variables

