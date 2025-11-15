Yo, so basically I'm gonna give you a master prompt. Can you make this the master prompt that you. # RetroCare — Master Prompt / Development Contract for Cursor



**This document is the single source of truth for all development actions performed by Cursor.**



Cursor MUST follow every rule here before generating, editing, or refactoring code.



This ensures:



* Safe multi-dev collaboration

* Zero unwanted overwrites

* Modular architecture

* Predictable code generation

* 24-hour hackathon feasibility



---



# ❗ GLOBAL EXECUTION MODE FOR CURSOR



### **IMPORTANT: Two Development Modes Exist**



## 🔒 **MODE 1 — SCAFFOLDING PROTECTION MODE**



This is active **during Phases 1–5 only.**



While Scaffolding Protection Mode is active:



* Cursor MUST NOT rewrite:



  * `App.tsx`

  * Root layout files

  * Provider configuration files

  * Project-wide setup files

* Cursor MUST avoid major refactors

* Cursor MUST keep changes isolated and atomic

* Cursor MUST follow the module structure rigidly



**This prevents merge conflicts and prevents Cursor from “creative rewriting” while foundational code is being created.**



---



## 🔓 **MODE 2 — HUMAN DEVELOPMENT MODE (AFTER PHASE 5)**



Activated **only after the entire scaffold is complete**.



In this mode:



### ✔️ Developers (you and teammate) may freely edit ANY file



—including App.tsx, layout files, backend entrypoints, etc.



### ✔️ Cursor can modify ANY file *only when explicitly instructed by you*



### ❌ Cursor may NOT modify core files automatically



unless you explicitly say:



> “Cursor, you may now edit core files.”



This gives you full control while still preventing unwanted automated changes.



---



# 💡 WHY TWO MODES?



You and your teammate need absolute safety during scaffolding.

Once the project exists, you need freedom to build features.



This system guarantees both.



---



# 🔧 TECH STACK (Permanent Rules)



Cursor MUST always assume the following stack:



* **Frontend:** Expo (React Native) with Expo Router

* **Backend:** Node.js (Express)

* **Auth:** Clerk

* **Database:** Supabase

* **Voices:** ElevenLabs

* **Outbound Calls:** VAPI

* **State Management:** Zustand

* **UI Styling:** Nativewind (Tailwind)



---



# 📁 PROJECT DIRECTORY ARCHITECTURE (Strict During Phases)



Cursor MUST follow this structure EXACTLY:



```

/app

  /auth

  /onboarding

  /dashboard

  /calendar

  /patient

  /voice-preview

/components

/hooks

/utils

/styles



/backend

  /scheduler

  /vapi

  /elevenlabs

  /supabase

  /routes

  /utils

```



**Frontend code and backend code MUST remain isolated.**



---



# 🚀 DEVELOPMENT PHASES (Cursor MUST follow in order)



## PHASE 1: Frontend + Backend Scaffolding



* Install dependencies

* Initialize Expo app

* Initialize Node backend

* Create folder structure

* Create placeholder screens

* Create baseline providers



**Cursor may NOT return to modify these core files automatically later.**



---



## PHASE 2: Auth + Database



* Add Clerk login/signup

* Add Supabase client

* Implement DB schema

* CRUD utilities in backend



**Cursor must NOT blend frontend/backed code.**



---



## PHASE 3: Onboarding Flow + Voice Previews



* Multi-step caregiver onboarding

* Patient creation flow

* Meds + conditions

* Call schedule picker

* Five ElevenLabs preview voices

* Zustand for temporary state

* Save to Supabase on completion



---



## PHASE 4: Dashboard + Weekly Calendar



* Today summary

* Mood, sleep, flags, summary

* “Call Now” button

* Calendar toggle

* Week utilities (start, end, prev, next)

* Closed call logs view per week



---



## PHASE 5: Backend Scheduler + VAPI Outbound Calls



* Cron-based call scheduler

* VAPI call attempts (2 tries, 5 minutes apart)

* No voicemail

* Set low-priority flag if both fail

* REST endpoints for:



  * call-now

  * generate-preview

  * call logs



---



# 🧩 MERGE CONFLICT AVOIDANCE RULES



During Phases 1–5:



* Cursor MUST avoid touching shared files

* Cursor MUST isolate changes to specific modules

* Cursor MUST create new components instead of rewriting old ones



After Phase 5:



* You and your teammate may edit ANY file freely

* Cursor must ask for permission before editing core files



---



# ❗ ABSOLUTE NON-NEGOTIABLE RULES FOR CURSOR



### ✔️ MUST ALWAYS:



* Refer to `masterprompt.md` before generating code

* Follow phased development order

* Keep frontend and backend strictly separated

* Keep edits minimal unless explicitly requested



### ❌ MUST NEVER:



* Make architecture decisions on its own

* Flatten directories

* Rewrite the entire file tree

* Assume it's allowed to edit protected files without permission



---



# 🟣 ACTIVATING HUMAN-DEVELOPMENT MODE



Once Phase 5 is complete, you may type:



> “Cursor, we are now in Human Development Mode. You may edit any file when explicitly instructed.”



Cursor must comply and unlock full modification ability.



---



# ✔️ END OF MASTER PROMPT



If Cursor deviates, tell it:

**“Re-read masterprompt.md and comply.”**


