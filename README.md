# RetroCare

RetroCare is a caregiver-facing companion app built with Expo + Expo Router on the frontend and a Node/Supabase stack for backend modules.

## Getting Started

### 1. Install Dependencies

```sh
npm install
```

### 2. Environment Variables Setup

**Important:** This project uses separate environment files for frontend (Expo) and backend (Node.js) to keep sensitive keys secure.

#### Frontend Environment (Root `.env`)
Create a `.env` file in the project root with **public** variables only:

```sh
cp env.example .env
```

The root `.env` should contain:
- `EXPO_PUBLIC_*` variables (Supabase URL, Clerk keys, etc.)
- `EXPO_PUBLIC_API_URL` (backend server URL)

**Never put sensitive keys in the root `.env`** - they will be bundled into the Expo app.

#### Backend Environment (`backend/.env`)
Create a `backend/.env` file with **all sensitive keys**:

```sh
cp backend/env.example backend/.env
```

The `backend/.env` should contain:
- `ELEVENLABS_API_KEY` (for voice previews)
- `VAPI_API_KEY` (for phone calls)
- `SUPABASE_SERVICE_ROLE_KEY` (backend admin key)
- `VAPI_PHONE_NUMBER_ID` (required)
- `VAPI_ASSISTANT_ID` (optional - only used as fallback; each voice has its own assistant ID)
- `PORT` (backend server port)

**Note:** `VAPI_ASSISTANT_ID` is optional because each voice option (Kenji, Priya, Lucy, Clyde, Julia) has its own assistant ID. When users select a voice during onboarding, that assistant ID is stored in the patient's `voice_choice` field and used for their calls.

**Security Note:** The `backend/.env` file is gitignored and should never be committed.

### 3. Start the Application

**Start the backend server:**
```sh
npm run backend
```

**Start the Expo frontend (in a separate terminal):**
```sh
npm start
```

The Expo CLI will let you open the project in Expo Go (iOS/Android) or the web preview.

## Repository Guardrails

- `masterprompt.md` is the source of truth for every development rule.
- Frontend modules live under `app/`, shared client utilities stay in `components/`, `hooks/`, `styles/`, and `utils/`.
- Backend work must stay inside the `backend/` tree to avoid merge conflicts with mobile development.

Refer to the phase checklist inside `masterprompt.md` before editing core files.