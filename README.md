# RetroCare

RetroCare is a caregiver-facing companion app built with Expo + Expo Router on the frontend and a Node/Supabase stack for backend modules.

## Getting Started

```sh
npm install
npm run start
```

The Expo CLI will let you open the project in Expo Go (iOS/Android) or the web preview.

## Repository Guardrails

- `masterprompt.md` is the source of truth for every development rule.
- Frontend modules live under `app/`, shared client utilities stay in `components/`, `hooks/`, `styles/`, and `utils/`.
- Backend work must stay inside the `backend/` tree to avoid merge conflicts with mobile development.

Refer to the phase checklist inside `masterprompt.md` before editing core files.