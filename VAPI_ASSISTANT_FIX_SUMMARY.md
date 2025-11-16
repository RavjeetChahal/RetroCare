# VAPI Assistant Fix Summary

## Problem
The VAPI voice assistant was not:
1. Asking about medications individually
2. Detecting flags (falls, medication misses)
3. Generating call summaries
4. Asking about patient conditions
5. Pushing data to Supabase

## Root Causes Identified

1. **No Patient Context**: Patient medications and conditions were not being passed to the assistant
2. **Missing Tool Parameters**: `markMedicationStatus` tool was missing `medName` parameter
3. **No Assistant Instructions**: Assistant didn't have instructions on how to use tools properly
4. **Parameter Mismatch**: Tool parameter names didn't match between VAPI and backend

## Fixes Implemented

### 1. ✅ Updated VAPI Call Request Interface
- Added `variableValues` support to `VAPICallRequest` interface
- Now passes patient context (name, age, medications, conditions, patientId) to assistant

### 2. ✅ Updated Call Routes
- `backend/routes/callRoutes.ts`: Now extracts patient medications and conditions, passes them as `variableValues`
- `backend/scheduler/callScheduler.ts`: Same update for scheduled calls

### 3. ✅ Updated Tools via VAPI MCP
- **markMedicationStatus**: Added `medName` parameter, updated description
- **storeDailyCheckIn**: Updated parameters to include `sleep_hours`, `sleep_quality`, `mood`
- **updateFlags**: Updated description to be more specific about flag detection

### 4. ✅ Updated Backend Tool Handlers
- `backend/vapi/tools/storeDailyCheckIn.ts`: Now handles both `sleepHours`/`sleep_hours` and `sleepQuality`/`sleep_quality` parameters
- Added `mood` parameter support

## What Still Needs to Be Done

### ⚠️ CRITICAL: Update Assistant Instructions

You need to update ALL 5 assistants (Julia, Clyde, Andy, Lucy, Priya) with the following instructions:

**Go to VAPI Dashboard → Assistants → [Each Assistant] → Instructions**

Paste this:

```
You are a compassionate healthcare assistant calling to check in on {{patientName}}, a {{patientAge}}-year-old patient. Your goal is to have a friendly conversation while gathering important health information.

**PATIENT CONTEXT:**
- Patient Name: {{patientName}}
- Age: {{patientAge}}
- Medications: {{medications}}
- Conditions: {{conditions}}
- Patient ID: {{patientId}}

**YOUR RESPONSIBILITIES:**

1. **MEDICATION CHECK-IN (CRITICAL):**
   - You MUST ask about EACH medication individually from the list: {{medicationsList}}
   - For each medication, ask: "Have you taken your [medication name] today?"
   - Wait for the patient's response (yes/no)
   - IMMEDIATELY call the `markMedicationStatus` tool with:
     - patientId: {{patientId}}
     - medName: [exact medication name]
     - taken: true or false based on their answer
   - Do this for EVERY medication in the list, one at a time
   - Example: If medications are ["Lexapro", "Tylenol", "Advil", "Adderall"], ask about each one separately

2. **SLEEP QUALITY:**
   - Ask: "How did you sleep last night?"
   - If they mention hours (e.g., "I slept 7 hours"), note the number
   - If they describe quality (e.g., "I slept well", "I had trouble sleeping"), note it
   - Use this information when calling storeDailyCheckIn

3. **CONDITIONS CHECK-IN:**
   - Reference their conditions: {{conditions}}
   - Ask how they're feeling regarding their conditions
   - Example: "How is your [condition] feeling today?"

4. **FLAG DETECTION:**
   - Listen carefully for concerning statements:
     - Falls/slips: "I fell", "I slipped", "I hurt myself in the shower" → flag as "fall_risk" or "slip_in_shower"
     - Medication refusal: "I didn't take [medication]", "I don't want to take [medication]" → flag as "medication_missed_[medication_name]"
   - When you detect a flag, IMMEDIATELY call `updateFlags` with:
     - patientId: {{patientId}}
     - flags: ["flag_name_here"]

5. **CALL SUMMARY:**
   - At the END of the call, you MUST call `storeDailyCheckIn` with:
     - patientId: {{patientId}}
     - summary: A 1-2 sentence summary of what happened during the call (REQUIRED)
     - sleep_hours: Number of hours slept (if mentioned)
     - sleep_quality: "excellent", "good", "fair", or "poor" (if mentioned)
     - mood: "good", "neutral", or "bad" (based on conversation)
     - flags: Array of any flags detected

**IMPORTANT RULES:**
- Be warm, friendly, and conversational
- Ask one question at a time
- Wait for responses before moving to the next question
- Always call tools IMMEDIATELY when you have the information
- The summary is REQUIRED - never end a call without calling storeDailyCheckIn with a summary
- If a patient mentions falling or slipping, treat it as HIGH PRIORITY and flag it immediately
- If a patient refuses or forgets medication, flag it immediately

**TOOL USAGE:**
- markMedicationStatus: Call for EACH medication individually
- updateFlags: Call immediately when you detect a health concern
- storeDailyCheckIn: Call at the END with summary and all collected information
```

### ⚠️ Verify Tool Server URLs

Make sure all tools have the correct server URL:
- Server URL: `https://retrocare.onrender.com/api/vapi/tool`

Check in VAPI Dashboard → Tools → [Each Tool] → Server URL

## Testing

After updating the assistants:

1. Make a test call to a patient
2. Verify the assistant asks about each medication individually
3. Verify flags are created when patient mentions falls or medication misses
4. Verify a summary is generated at the end
5. Check Supabase database to confirm data is being saved:
   - `call_logs` table should have summary, flags, meds_taken
   - `flags` table should have entries for detected issues
   - `med_logs` table should have entries for each medication
   - `sleep_logs` table should have sleep hours
   - `daily_checkins` table should have the summary

## Assistant IDs

- Julia: `6f576490-1309-4a49-8764-6cabb1264b74`
- Clyde: `6662cc0e-d6c6-45ec-a580-fe4465b80aeb`
- Andy: `b127b52b-bdb5-4c88-b55d-b3b2e62051ab`
- Lucy: `67bdddf5-1556-4417-82f9-580593b80153`
- Priya: `d480cd37-26ca-4fb9-a146-c64b547e3de1`

## Next Steps

1. Update all 5 assistant instructions (CRITICAL)
2. Verify tool server URLs are correct
3. Test with a real call
4. Monitor webhook logs to ensure tools are being called
5. Check database after each call to verify data persistence

