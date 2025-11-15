# RetroCare Voice Anomaly Detection — UI Development Master Prompt

**This document is the single source of truth for UI development work on the Voice Anomaly Detection feature.**

**Status:** Phase 6 — Voice Anomaly Detection UI Implementation

---

## 🎯 OVERVIEW

You are building the **UI components and frontend integration** for RetroCare's Voice Anomaly Detection feature. Your teammate is working on the Python microservice and Node backend integration. You will work on **UI/UX only** to ensure zero merge conflicts.

### What Voice Anomaly Detection Does

The system analyzes voice patterns from patient calls to detect potential health issues:

- **Baseline**: Captures patient's normal voice during onboarding
- **Comparison**: Analyzes each new call against baseline
- **Scoring**: Returns anomaly score 0.0 (normal) → 1.0 (very different)
- **Alerts**: Notifies caregivers when anomalies are detected

---

## 🚫 STRICT BOUNDARIES — DO NOT TOUCH

### ❌ **DO NOT MODIFY THESE FILES/DIRECTORIES:**

1. **Python Service** (teammate's work):

   - `/python/anomaly-service/**` (entire directory)
   - Any Python files

2. **Backend Anomaly Integration** (teammate's work):

   - `/backend/anomaly/**` (entire directory)
   - `/backend/routes/callRoutes.ts` (teammate may modify)
   - `/backend/server.ts` (teammate may modify)

3. **Core MVP Files** (unless explicitly needed):
   - `/backend/scheduler/**`
   - `/backend/vapi/**`
   - `/backend/elevenlabs/**`
   - `/backend/supabase/**` (except schema additions you request)

### ✅ **YOUR WORK AREA — SAFE TO MODIFY:**

1. **Frontend UI Components:**

   - `/app/anomaly/**` (new directory — create this)
   - `/components/anomaly/**` (new directory — create this)
   - `/components/dashboard/**` (modify existing components)
   - `/app/dashboard/index.tsx` (add anomaly UI elements)

2. **Frontend Utilities:**

   - `/utils/anomalyService.ts` (new file — API client for frontend)
   - `/hooks/useAnomalyAlerts.ts` (new file — React hook)

3. **Database Schema Requests:**
   - Request teammate to add `voice_anomaly_logs` table (you provide SQL)

---

## 📋 PHASE 6 UI REQUIREMENTS

### **PHASE 6.1: Database Schema Addition**

**Action:** Request teammate to add this table to Supabase schema:

```sql
-- Add to backend/supabase/schema.sql
create table if not exists voice_anomaly_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  call_log_id uuid references call_logs(id) on delete set null,
  timestamp timestamptz not null default now(),
  anomaly_score float not null, -- 0.0 to 1.0
  raw_similarity float, -- cosine similarity before normalization
  normalized_score float, -- after noise/time adjustments
  snr float, -- signal-to-noise ratio
  baseline_embedding_url text, -- URL to stored baseline embedding
  current_embedding_url text, -- URL to current call embedding
  alert_sent boolean default false, -- whether caregiver was notified
  alert_type text, -- 'warning' (score <= 0.40) or 'emergency' (score > 0.40)
  notes text -- optional caregiver notes
);
```

**Note:** You don't modify the schema file. Ask teammate to add it.

---

### **PHASE 6.2: Frontend API Client**

**File:** `/utils/anomalyService.ts` (CREATE NEW)

Create a TypeScript client that calls the Node backend anomaly endpoint:

```typescript
// Example structure (implement fully)
import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export interface AnomalyCheckResponse {
  success: boolean;
  anomalyScore: number; // 0.0 to 1.0
  rawSimilarity: number;
  normalizedScore: number;
  snr: number;
  alertType?: "warning" | "emergency" | null;
  error?: string;
}

export async function checkVoiceAnomaly(
  patientId: string,
  callLogId?: string
): Promise<AnomalyCheckResponse> {
  // POST /api/anomaly-check
  // Body: { patientId, callLogId? }
}
```

---

### **PHASE 6.3: Anomaly Dashboard Screen**

**File:** `/app/anomaly/index.tsx` (CREATE NEW)

Create a new screen that displays:

- List of all anomaly alerts for patient(s)
- Filter by alert type (warning/emergency)
- Sort by date (newest first)
- Show anomaly score with color coding:
  - Green: 0.0 - 0.25 (normal)
  - Yellow: 0.26 - 0.40 (warning)
  - Orange: 0.41 - 0.60 (moderate)
  - Red: 0.61 - 1.0 (severe)
- Click to view details (score, similarity, SNR, timestamp)

**Design Requirements:**

- Use existing color tokens from `/styles/tokens.ts`
- Match dashboard styling patterns
- Use React Query for data fetching
- Add pull-to-refresh

---

### **PHASE 6.4: Anomaly Alert Badge Component**

**File:** `/components/anomaly/AnomalyBadge.tsx` (CREATE NEW)

Create a badge component that shows:

- Anomaly score with color
- Alert type icon (warning/emergency)
- Clickable to navigate to anomaly details

**Usage:** Add to dashboard patient cards and call log cards.

---

### **PHASE 6.5: Anomaly Detail Modal/Card**

**File:** `/components/anomaly/AnomalyDetailCard.tsx` (CREATE NEW)

Display detailed anomaly information:

- Anomaly score (large, color-coded)
- Raw similarity score
- Normalized score
- SNR (signal-to-noise ratio)
- Timestamp
- Associated call log link
- Alert status (sent/not sent)
- Notes field (editable by caregiver)

---

### **PHASE 6.6: Dashboard Integration**

**File:** `/app/dashboard/index.tsx` (MODIFY EXISTING)

Add anomaly indicators:

1. **Anomaly Alert Banner** (if any emergency alerts exist)

   - Red banner at top: "⚠️ Emergency: [X] patients have voice anomalies"
   - Clickable → navigates to `/anomaly`

2. **Anomaly Badge on Patient Cards**

   - Show badge if patient has recent anomaly (last 7 days)
   - Badge color based on severity

3. **Anomaly Score in Call Logs**
   - Add anomaly score column to call log cards
   - Show score if available

**Important:** Only add UI elements. Do not modify backend logic.

---

### **PHASE 6.7: Anomaly Alert Hook**

**File:** `/hooks/useAnomalyAlerts.ts` (CREATE NEW)

Create a React hook that:

- Fetches anomaly alerts for caregiver's patients
- Filters by alert type
- Provides real-time updates (polling or WebSocket if available)
- Returns:
  - `alerts`: Array of anomaly alerts
  - `emergencyCount`: Number of emergency alerts
  - `warningCount`: Number of warning alerts
  - `isLoading`: Loading state
  - `refetch`: Manual refresh function

---

### **PHASE 6.8: Navigation Updates**

**File:** `/app/index.tsx` (MODIFY EXISTING)

Add navigation link to anomaly dashboard:

- Add "Voice Anomalies" link to home screen
- Or add to main navigation menu

---

## 🎨 UI/UX REQUIREMENTS

### **Color Coding for Anomaly Scores:**

```typescript
// Use in components
const getAnomalyColor = (score: number): string => {
  if (score <= 0.25) return colors.success || "#10b981"; // Green
  if (score <= 0.4) return colors.warning || "#f59e0b"; // Yellow
  if (score <= 0.6) return colors.orange || "#f97316"; // Orange
  return colors.error || "#ef4444"; // Red
};
```

### **Alert Type Icons:**

- Warning: ⚠️ or `AlertTriangle` icon
- Emergency: 🚨 or `AlertCircle` icon

### **Styling:**

- Use existing design tokens from `/styles/tokens.ts`
- Match dashboard card styling
- Use NativeWind (Tailwind) classes
- Ensure mobile-responsive design

---

## 📡 API CONTRACT (What Backend Will Provide)

Your teammate will create this endpoint. You should call it from your frontend:

### **POST /api/anomaly-check**

**Request:**

```json
{
  "patientId": "uuid",
  "callLogId": "uuid (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "anomalyScore": 0.65,
  "rawSimilarity": 0.35,
  "normalizedScore": 0.65,
  "snr": 18.5,
  "alertType": "emergency",
  "logId": "uuid (if saved)"
}
```

### **GET /api/anomaly-logs/:patientId**

**Response:**

```json
{
  "logs": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "callLogId": "uuid",
      "timestamp": "2024-01-15T10:30:00Z",
      "anomalyScore": 0.65,
      "rawSimilarity": 0.35,
      "normalizedScore": 0.65,
      "snr": 18.5,
      "alertSent": true,
      "alertType": "emergency",
      "notes": "Caregiver notes here"
    }
  ]
}
```

---

## 🔄 DATA FLOW

1. **Onboarding** (teammate handles):

   - Patient completes onboarding
   - Backend captures baseline voice embedding
   - Stored in Supabase

2. **During Call** (teammate handles):

   - VAPI call completes
   - Backend extracts voice embedding
   - Compares to baseline via Python service
   - Saves anomaly log to Supabase

3. **UI Display** (YOUR WORK):
   - Dashboard fetches anomaly logs
   - Displays alerts/badges
   - Caregiver views details
   - Caregiver can add notes

---

## ✅ CHECKLIST

### Phase 6.1: Setup

- [ ] Request teammate to add `voice_anomaly_logs` table
- [ ] Create `/app/anomaly/` directory
- [ ] Create `/components/anomaly/` directory

### Phase 6.2: API Client

- [ ] Create `/utils/anomalyService.ts`
- [ ] Implement `checkVoiceAnomaly()` function
- [ ] Implement `getAnomalyLogs()` function

### Phase 6.3: Components

- [ ] Create `AnomalyBadge.tsx`
- [ ] Create `AnomalyDetailCard.tsx`
- [ ] Create `AnomalyAlertBanner.tsx` (optional)

### Phase 6.4: Screens

- [ ] Create `/app/anomaly/index.tsx` (main anomaly dashboard)
- [ ] Add navigation link to home screen

### Phase 6.5: Hooks

- [ ] Create `useAnomalyAlerts.ts` hook
- [ ] Integrate with React Query

### Phase 6.6: Dashboard Integration

- [ ] Add anomaly banner to dashboard
- [ ] Add anomaly badges to patient cards
- [ ] Add anomaly scores to call log cards

### Phase 6.7: Testing

- [ ] Test with mock data
- [ ] Test with real API (once backend is ready)
- [ ] Verify color coding
- [ ] Verify navigation flows

---

## 🚨 IMPORTANT RULES

1. **DO NOT** modify any Python files
2. **DO NOT** modify `/backend/anomaly/**` files
3. **DO NOT** modify backend route handlers (teammate's work)
4. **DO** create new UI components and screens
5. **DO** use existing design patterns and tokens
6. **DO** request database changes from teammate (don't modify schema.sql yourself)
7. **DO** test with mock data until backend is ready

---

## 📝 NOTES FOR TEAMMATE COORDINATION

### What You Need From Teammate:

1. **Database Table:** Add `voice_anomaly_logs` table (SQL provided above)
2. **API Endpoints:**
   - `POST /api/anomaly-check`
   - `GET /api/anomaly-logs/:patientId`
3. **Environment Variable:** `EXPO_PUBLIC_API_URL` (should already exist)

### What Teammate Needs From You:

1. **UI Mockups/Designs:** Share your component designs if needed
2. **Data Structure Feedback:** Confirm if response format works for UI
3. **Testing:** Test UI once backend endpoints are ready

---

## 🎯 SUCCESS CRITERIA

The UI implementation is complete when:

1. ✅ Caregivers can view all anomaly alerts in a dedicated screen
2. ✅ Dashboard shows anomaly indicators (badges, banners)
3. ✅ Anomaly scores are color-coded and easy to understand
4. ✅ Caregivers can view detailed anomaly information
5. ✅ Caregivers can add notes to anomaly logs
6. ✅ UI matches existing RetroCare design system
7. ✅ No merge conflicts with Python/backend work

---

## 📞 COORDINATION

- **Your Work:** Frontend UI only (`/app/anomaly/**`, `/components/anomaly/**`, dashboard modifications)
- **Teammate's Work:** Python service (`/python/**`), backend integration (`/backend/anomaly/**`)
- **Shared:** Database schema (request changes, don't modify directly)

---

**If you need to modify a file that's in the "DO NOT TOUCH" list, coordinate with your teammate first.**

**End of UI Master Prompt**
