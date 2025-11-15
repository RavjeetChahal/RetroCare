# Voice Anomaly Detection — Implementation Summary

**Quick reference for understanding the split between Backend and UI work.**

---

## 📋 ORIGINAL PROMPT vs. REFINED PROMPTS

### **Original Prompt Structure:**
- Phase 1-4: Python microservice setup
- Phase 5: Node backend integration
- Phase 6: File structure

### **Refined Split:**

**Backend Developer (`ANOMALY_BACKEND_MASTERPROMPT.md`):**
- ✅ Python microservice (FastAPI)
- ✅ Node backend integration (`/backend/anomaly/**`)
- ✅ Database schema
- ✅ REST API endpoints
- ✅ Integration with call flow
- ✅ Baseline capture strategy

**Frontend Developer (`ANOMALY_UI_MASTERPROMPT.md`):**
- ✅ UI components and screens
- ✅ Frontend API client
- ✅ Dashboard integration
- ✅ React hooks
- ✅ Navigation

---

## 🔄 KEY CHANGES FROM ORIGINAL

### **1. Clearer Separation of Concerns**

**Original:** Mixed backend and frontend responsibilities
**Refined:** 
- Backend handles all Python/Node/DB work
- Frontend handles all UI/React work
- Clear boundaries prevent merge conflicts

### **2. Integration Points Clarified**

**Original:** Vague about when/how anomaly checks happen
**Refined:**
- Backend integrates anomaly check after VAPI calls complete
- Backend provides REST endpoints for frontend to consume
- Frontend calls backend endpoints, displays results

### **3. Baseline Capture Strategy**

**Original:** Not specified
**Refined:**
- Two options: during onboarding or first call
- Backend implements the chosen strategy
- Frontend may need to add recording step to onboarding (if Option A)

### **4. Audio Source Clarification**

**Original:** Assumed audio URLs available
**Refined:**
- Backend must check VAPI API for audio recording URLs
- May need to handle cases where audio isn't available
- Error handling for missing audio

### **5. Database Schema Ownership**

**Original:** Unclear who adds schema
**Refined:**
- Backend developer adds `voice_anomaly_logs` table
- Frontend developer requests it (SQL provided in UI prompt)
- Clear handoff process

---

## 🎯 WORKFLOW

### **Backend Developer Flow:**

1. **Setup Python Service**
   - Create `/python/anomaly-service/`
   - Implement embedding extraction
   - Implement similarity scoring
   - Create FastAPI endpoints

2. **Node Integration**
   - Create `/backend/anomaly/` module
   - Add database schema
   - Create Python client
   - Create anomaly service
   - Create REST endpoints

3. **Integration**
   - Hook into call completion flow
   - Test end-to-end
   - Provide API endpoints to frontend

### **Frontend Developer Flow:**

1. **API Client**
   - Create `/utils/anomalyService.ts`
   - Call backend endpoints

2. **Components**
   - Create anomaly dashboard
   - Create badge components
   - Create detail views

3. **Integration**
   - Add to dashboard
   - Add navigation
   - Test with backend

---

## 🔌 API CONTRACT (Shared)

Both developers must agree on this contract:

### **POST /api/anomaly-check**
```typescript
Request: { patientId: string, callLogId?: string, audioUrl?: string }
Response: {
  success: boolean,
  anomalyScore: number,
  rawSimilarity: number,
  normalizedScore: number,
  snr: number,
  alertType: 'warning' | 'emergency' | null,
  logId?: string
}
```

### **GET /api/anomaly-logs/:patientId**
```typescript
Response: {
  logs: Array<{
    id: string,
    patientId: string,
    callLogId?: string,
    timestamp: string,
    anomalyScore: number,
    rawSimilarity: number,
    normalizedScore: number,
    snr: number,
    alertSent: boolean,
    alertType: 'warning' | 'emergency' | null,
    notes?: string
  }>
}
```

---

## 📁 FILE STRUCTURE

```
RetroCare/
├── python/
│   └── anomaly-service/          # Backend Developer
│       ├── main.py
│       ├── requirements.txt
│       └── utils/
│           ├── audio.py
│           └── scoring.py
│
├── backend/
│   ├── anomaly/                   # Backend Developer
│   │   ├── pythonClient.ts
│   │   ├── anomalyService.ts
│   │   └── anomalyController.ts
│   └── supabase/
│       ├── schema.sql             # Backend Developer (adds table)
│       └── anomalyLogs.ts         # Backend Developer
│
├── app/
│   └── anomaly/                    # Frontend Developer
│       └── index.tsx
│
├── components/
│   └── anomaly/                   # Frontend Developer
│       ├── AnomalyBadge.tsx
│       └── AnomalyDetailCard.tsx
│
├── utils/
│   └── anomalyService.ts          # Frontend Developer
│
└── hooks/
    └── useAnomalyAlerts.ts        # Frontend Developer
```

---

## ✅ COORDINATION CHECKLIST

### **Before Starting:**
- [ ] Both developers read their respective master prompts
- [ ] Both developers read `ANOMALY_COORDINATION.md`
- [ ] Agree on API contract
- [ ] Agree on baseline capture strategy
- [ ] Agree on audio storage solution

### **During Development:**
- [ ] Backend: Implement Python service first
- [ ] Backend: Test Python endpoints independently
- [ ] Backend: Implement Node integration
- [ ] Backend: Test Node → Python communication
- [ ] Frontend: Use mock data until backend ready
- [ ] Frontend: Test with real API once available
- [ ] Both: Communicate blockers immediately

### **Before Merging:**
- [ ] Backend: All endpoints tested and working
- [ ] Frontend: All components tested
- [ ] Both: Integration tested together
- [ ] Both: No merge conflicts
- [ ] Both: Code reviewed

---

## 🚨 COMMON PITFALLS TO AVOID

1. **Backend modifying frontend files** → Use only `/backend/**` and `/python/**`
2. **Frontend modifying backend files** → Use only `/app/**`, `/components/**`, `/utils/**` (frontend)
3. **Both modifying schema.sql** → Backend owns it, frontend requests changes
4. **API contract mismatch** → Refer to `ANOMALY_COORDINATION.md` always
5. **Missing error handling** → Both should handle API errors gracefully

---

## 📞 COMMUNICATION PROTOCOL

1. **API Changes:** Backend notifies Frontend before changing response format
2. **Schema Changes:** Frontend requests, Backend implements
3. **Blockers:** Communicate immediately via preferred channel
4. **Testing:** Coordinate integration testing session

---

**Last Updated:** Phase 6 Implementation Start

