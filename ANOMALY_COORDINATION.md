# Voice Anomaly Detection — Team Coordination Guide

**Quick reference for coordinating Python microservice (Backend) and UI (Frontend) work.**

---

## 👥 TEAM ROLES

### **Backend Developer (Python Microservice)**

- **Work Area:** `/python/anomaly-service/**`, `/backend/anomaly/**`
- **Master Prompt:** `ANOMALY_BACKEND_MASTERPROMPT.md`
- **Deliverables:**
  - Python FastAPI service with `/embed` and `/compare` endpoints
  - Node backend integration (`/backend/anomaly/**`)
  - Database schema updates for `voice_anomaly_logs` table
  - API endpoints: `POST /api/anomaly-check`, `GET /api/anomaly-logs/:patientId`
  - Integration with call completion flow

### **Frontend Developer (UI)**

- **Work Area:** `/app/anomaly/**`, `/components/anomaly/**`, dashboard modifications
- **Master Prompt:** `ANOMALY_UI_MASTERPROMPT.md`
- **Deliverables:**
  - Anomaly dashboard screen
  - Anomaly badge components
  - Dashboard integration (alerts, badges)
  - Frontend API client (`/utils/anomalyService.ts`)

---

## 🚧 FILE OWNERSHIP

### Backend Developer Owns:

```
/python/anomaly-service/**          (entire directory)
/backend/anomaly/**                 (entire directory)
/backend/supabase/schema.sql        (add voice_anomaly_logs table)
/backend/routes/**                  (may add anomaly routes)
```

### Frontend Developer Owns:

```
/app/anomaly/**                     (entire directory)
/components/anomaly/**              (entire directory)
/utils/anomalyService.ts            (new file)
/hooks/useAnomalyAlerts.ts          (new file)
/app/dashboard/index.tsx            (modify for anomaly UI)
/app/index.tsx                      (add navigation link)
```

### Shared (Coordinate Changes):

```
/backend/supabase/schema.sql        (Frontend requests, Backend implements)
.env                                (may need PYTHON_SERVICE_URL)
```

---

## 📋 HANDOFF CHECKLIST

### Backend → Frontend:

- [ ] `voice_anomaly_logs` table created in Supabase
- [ ] `POST /api/anomaly-check` endpoint working
- [ ] `GET /api/anomaly-logs/:patientId` endpoint working
- [ ] Environment variable `EXPO_PUBLIC_API_URL` set
- [ ] Test data available for UI testing

### Frontend → Backend:

- [ ] UI components ready for integration
- [ ] Frontend API client ready (`/utils/anomalyService.ts`)
- [ ] Design feedback on API response format (if needed)

---

## 🔌 API CONTRACT

### Backend Provides:

**POST /api/anomaly-check**

```typescript
Request: { patientId: string, callLogId?: string }
Response: {
  success: boolean,
  anomalyScore: number,      // 0.0 to 1.0
  rawSimilarity: number,      // cosine similarity
  normalizedScore: number,   // after adjustments
  snr: number,               // signal-to-noise ratio
  alertType?: 'warning' | 'emergency' | null,
  logId?: string
}
```

**GET /api/anomaly-logs/:patientId**

```typescript
Response: {
  logs: Array<{
    id: string;
    patientId: string;
    callLogId?: string;
    timestamp: string;
    anomalyScore: number;
    rawSimilarity: number;
    normalizedScore: number;
    snr: number;
    alertSent: boolean;
    alertType?: "warning" | "emergency";
    notes?: string;
  }>;
}
```

---

## 🗄️ DATABASE SCHEMA

**Backend Developer:** Add this table to `backend/supabase/schema.sql`:

```sql
create table if not exists voice_anomaly_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  call_log_id uuid references call_logs(id) on delete set null,
  timestamp timestamptz not null default now(),
  anomaly_score float not null,
  raw_similarity float,
  normalized_score float,
  snr float,
  baseline_embedding_url text,
  current_embedding_url text,
  alert_sent boolean default false,
  alert_type text,
  notes text
);
```

---

## 🧪 TESTING COORDINATION

### Backend Testing:

- Test Python service endpoints independently
- Test Node → Python integration
- Test database writes/reads

### Frontend Testing:

- Use mock data until backend ready
- Test with real API once endpoints available
- Coordinate integration testing together

---

## 📞 COMMUNICATION PROTOCOL

1. **Before modifying shared files:** Check with teammate
2. **Database changes:** Frontend requests, Backend implements
3. **API changes:** Backend notifies Frontend of response format changes
4. **Blockers:** Communicate immediately

---

## ✅ MERGE CONFLICT PREVENTION

- **Backend:** Work in `/python/**` and `/backend/anomaly/**` only
- **Frontend:** Work in `/app/anomaly/**` and `/components/anomaly/**` only
- **Shared:** Coordinate on schema changes and environment variables
- **Git:** Use feature branches, communicate before merging

---

**Last Updated:** Phase 6 — Voice Anomaly Detection Implementation
