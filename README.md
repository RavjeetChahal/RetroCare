# RetroCare

RetroCare is a caregiver dashboard for managing patient check-ins. A caregiver can create a patient profile, record medications and conditions, save preferred call times, preview and select a voice, manually start a phone call, and review information collected from calls.

The repository contains two main components:

- An Expo/React Native app for authentication, onboarding, patient selection, and dashboard views.
- An Express API that starts Vapi calls, receives Vapi webhooks and tool calls, generates ElevenLabs voice previews, and stores data in Supabase.

## What is implemented

- Clerk sign-up and sign-in.
- Caregiver and patient onboarding backed by Supabase.
- Preferred call times stored with each patient profile.
- Manual outbound calls through Vapi.
- Vapi webhook handling for call outcomes, transcripts, medication status, mood, sleep data, summaries, and health flags.
- A dashboard showing recent calls, medications, mood, sleep, and flags from stored patient data.
- Patient history/calendar views.
- ElevenLabs voice previews during onboarding.

RetroCare depends on configured third-party accounts and is not a standalone medical monitoring or emergency alert service.

## Tech stack

- Expo 54, React Native, Expo Router, TypeScript
- Clerk authentication
- Supabase database and realtime subscriptions
- Express backend
- Vapi calls and webhooks
- ElevenLabs text-to-speech previews

## Local setup

### Prerequisites

- Node.js and npm
- Clerk, Supabase, Vapi, and ElevenLabs credentials for their respective features

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Configure the environment

Copy the example file:

```bash
cp env.example .env
```

The Expo client reads only variables prefixed with `EXPO_PUBLIC_`. The Express server loads `backend/.env` when present and otherwise falls back to the root `.env`.

Required for the client:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Required for the backend call and preview flows:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=
VAPI_API_KEY=
VAPI_PHONE_NUMBER_ID=
ELEVENLABS_API_KEY=
```

Optional backend variables:

```dotenv
PORT=3000
VAPI_ASSISTANT_ID=
VAPI_WEBHOOK_URL=
```

Do not expose service-role or provider API keys through `EXPO_PUBLIC_` variables.

### 3. Create the database

Run [backend/supabase/schema.sql](backend/supabase/schema.sql) in the Supabase SQL editor, followed by any files in [backend/supabase/migrations](backend/supabase/migrations) that have not already been applied.

### 4. Start the app

Run the backend:

```bash
npm run backend
```

In a second terminal, start Expo:

```bash
npm start
```

You can also target a platform directly:

```bash
npm run web
npm run android
npm run ios
```

For web development, `EXPO_PUBLIC_API_URL` normally points to `http://localhost:3000`. Physical devices must use a backend URL reachable from the device rather than `localhost`.

## Useful commands

```bash
npm run build:web
```

This repository does not currently define a general unit-test or lint command.

## Project structure

```text
app/                    Expo Router screens
components/             Reusable UI components
hooks/                  Client state and realtime hooks
utils/                  Client-side services
backend/                Express API, integrations, and SQL
scripts/                Setup and integration-check scripts
```

## Health checks

With the Express backend running:

- `GET /health` checks the Node service.
- `GET /api/diagnostics/health` checks that the diagnostics router is available.

## License

See [LICENSE](LICENSE).
