# RetroCare Voice Anomaly Detection — Backend/Python Master Prompt

**This document is the single source of truth for backend and Python microservice development on the Voice Anomaly Detection feature.**

**Status:** Phase 6 — Voice Anomaly Detection Backend Implementation

**Your Teammate:** Working on UI components (see `ANOMALY_UI_MASTERPROMPT.md`)

---

## 🎯 OVERVIEW

You are building the **Python microservice and Node.js backend integration** for RetroCare's Voice Anomaly Detection feature. Your teammate is working on the UI components. You will work on **backend/Python only** to ensure zero merge conflicts.

### What Voice Anomaly Detection Does

The system analyzes voice patterns from patient calls to detect potential health issues:
- **Baseline**: Captures patient's normal voice during onboarding (or first successful call)
- **Comparison**: Analyzes each new call against baseline using ECAPA-TDNN embeddings
- **Scoring**: Returns anomaly score 0.0 (normal) → 1.0 (very different)
- **Alerts**: Backend determines alert type and saves to database for UI to display

---

## 🚫 STRICT BOUNDARIES — DO NOT TOUCH

### ❌ **DO NOT MODIFY THESE FILES/DIRECTORIES:**

1. **Frontend UI Components** (teammate's work):
   - `/app/anomaly/**` (entire directory)
   - `/components/anomaly/**` (entire directory)
   - `/app/dashboard/index.tsx` (teammate may modify for UI)
   - `/utils/anomalyService.ts` (frontend API client)
   - `/hooks/useAnomalyAlerts.ts` (frontend hook)

2. **Core MVP Files** (unless explicitly needed):
   - `/backend/scheduler/callScheduler.ts` (only add anomaly check integration point)
   - `/backend/vapi/client.ts` (only if needed for audio extraction)
   - `/backend/elevenlabs/**` (don't modify)
   - `/app/**` (frontend routes - teammate's domain)

### ✅ **YOUR WORK AREA — SAFE TO MODIFY:**

1. **Python Microservice:**
   - `/python/anomaly-service/**` (entire directory - CREATE NEW)
   - All Python files

2. **Backend Integration:**
   - `/backend/anomaly/**` (entire directory - CREATE NEW)
   - `/backend/routes/callRoutes.ts` (add anomaly check after call completes)
   - `/backend/server.ts` (register anomaly routes)
   - `/backend/supabase/schema.sql` (add voice_anomaly_logs table)
   - `/backend/supabase/**` (add anomaly log CRUD functions)

---

## 📋 PHASE 6 BACKEND REQUIREMENTS

### **PHASE 6.1: Python Microservice Setup**

**Directory:** `/python/anomaly-service/` (CREATE NEW)

**Files to Create:**
```
/python/anomaly-service/
  main.py                 # FastAPI app with endpoints
  requirements.txt        # Dependencies
  .env.example           # Environment variables
  README.md              # Setup instructions
  /utils/
    audio.py             # Embedding extraction, SNR computation
    scoring.py            # Similarity, anomaly scoring, normalization
  /models/               # Cached model weights (optional)
```

**Dependencies (`requirements.txt`):**
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
torch>=2.0.0
speechbrain>=0.5.16
numpy>=1.24.0
pydantic>=2.5.0
librosa>=0.10.1
scipy>=1.11.0
python-multipart>=0.0.6
aiohttp>=3.9.0
```

**Environment Variables:**
```bash
# .env.example
PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:19006
```

---

### **PHASE 6.2: Embedding Extraction (Python)**

**File:** `/python/anomaly-service/utils/audio.py`

**Requirements:**
1. **Load ECAPA-TDNN Model:**
   ```python
   from speechbrain.pretrained import EncoderClassifier
   
   # Load globally on startup
   model = EncoderClassifier.from_hparams(
       source="speechbrain/spkrec-ecapa-voxceleb",
       savedir="models/ecapa"
   )
   ```

2. **Extract Embedding:**
   ```python
   def get_embedding(audio_waveform: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
       """
       Extract voice embedding from audio waveform.
       Returns: 192-dimensional embedding vector
       """
       # Normalize audio
       # Extract embedding using model
       # Return normalized embedding
   ```

3. **Compute SNR:**
   ```python
   def compute_snr(audio: np.ndarray, sample_rate: int = 16000) -> float:
       """
       Compute signal-to-noise ratio in dB.
       Returns: SNR value (typically 0-30 dB)
       """
       # Use librosa for noise estimation
       # Return SNR in dB
   ```

4. **Audio Loading Helper:**
   ```python
   def load_audio_from_url(url: str) -> tuple[np.ndarray, int]:
       """
       Download and load audio from URL.
       Returns: (waveform, sample_rate)
       """
       # Download audio file
       # Load with librosa
       # Resample to 16kHz if needed
   ```

---

### **PHASE 6.3: Similarity & Anomaly Scoring (Python)**

**File:** `/python/anomaly-service/utils/scoring.py`

**Requirements:**

1. **Cosine Similarity:**
   ```python
   def cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
       """
       Compute cosine similarity between two embeddings.
       Returns: value between -1 and 1 (typically 0 to 1 for normalized embeddings)
       """
       # dot(a, b) / (||a|| * ||b||)
   ```

2. **Anomaly Score Conversion:**
   ```python
   def similarity_to_anomaly(similarity: float) -> float:
       """
       Convert similarity to anomaly score.
       similarity: 1.0 (identical) → 0.0 (very different)
       Returns: 0.0 (normal) → 1.0 (anomaly)
       """
       return 1.0 - similarity
   ```

3. **Noise Normalization:**
   ```python
   def apply_noise_normalization(anomaly_score: float, snr: float) -> float:
       """
       Adjust anomaly score based on signal quality.
       Low SNR (noisy audio) → reduce anomaly score
       """
       if snr < 15.0:  # Low quality audio
           # Reduce anomaly by 15-25%
           reduction = 0.20 * (15.0 - snr) / 15.0
           return max(0.0, anomaly_score - reduction)
       return anomaly_score
   ```

4. **Time-of-Day Compensation (Optional):**
   ```python
   def apply_time_compensation(anomaly_score: float, hour: int) -> float:
       """
       Adjust for natural voice variations by time of day.
       Morning/evening voices may naturally differ.
       """
       # Smooth thresholds for morning (6-9) and evening (18-21)
       # Reduce anomaly by 5-10% during these windows
   ```

5. **Multi-Sample Baseline Averaging (Optional):**
   ```python
   def average_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
       """
       Average multiple baseline embeddings for more stable comparison.
       """
       # Return mean embedding
   ```

---

### **PHASE 6.4: FastAPI Endpoints (Python)**

**File:** `/python/anomaly-service/main.py`

**Endpoints to Implement:**

1. **POST /embed**
   ```python
   @app.post("/embed")
   async def extract_embedding(request: EmbedRequest):
       """
       Extract embedding from audio URL.
       
       Request:
       {
         "audio_url": "https://...",
         "sample_rate": 16000 (optional)
       }
       
       Response:
       {
         "embedding": [0.123, ...],  # 192-dim array
         "snr": 18.5,
         "sample_rate": 16000
       }
       """
       # Download audio
       # Load waveform
       # Compute embedding
       # Compute SNR
       # Return JSON
   ```

2. **POST /compare**
   ```python
   @app.post("/compare")
   async def compare_embeddings(request: CompareRequest):
       """
       Compare baseline and current embeddings.
       
       Request:
       {
         "baseline": [0.123, ...],  # 192-dim array
         "current": [0.456, ...],   # 192-dim array
         "snr": 18.5,
         "hour": 14 (optional, for time compensation)
       }
       
       Response:
       {
         "score": 0.65,              # anomaly score 0.0→1.0
         "raw_similarity": 0.35,     # cosine similarity
         "normalized": 0.65,         # after noise/time adjustments
         "snr": 18.5
       }
       """
       # Compute cosine similarity
       # Convert to anomaly score
       # Apply noise normalization
       # Apply time compensation (if hour provided)
       # Return JSON
   ```

3. **Health Check:**
   ```python
   @app.get("/health")
   async def health_check():
       return {"status": "ok", "service": "anomaly-detection"}
   ```

**Pydantic Models:**
```python
from pydantic import BaseModel, HttpUrl
from typing import List

class EmbedRequest(BaseModel):
    audio_url: HttpUrl
    sample_rate: int = 16000

class EmbedResponse(BaseModel):
    embedding: List[float]
    snr: float
    sample_rate: int

class CompareRequest(BaseModel):
    baseline: List[float]
    current: List[float]
    snr: float
    hour: int | None = None

class CompareResponse(BaseModel):
    score: float
    raw_similarity: float
    normalized: float
    snr: float
```

**CORS Configuration:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specific origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### **PHASE 6.5: Database Schema**

**File:** `/backend/supabase/schema.sql` (ADD TO EXISTING)

Add this table:

```sql
-- Voice Anomaly Detection Logs
create table if not exists voice_anomaly_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  call_log_id uuid references call_logs(id) on delete set null,
  timestamp timestamptz not null default now(),
  anomaly_score float not null check (anomaly_score >= 0 and anomaly_score <= 1),
  raw_similarity float,
  normalized_score float,
  snr float,
  baseline_embedding_url text, -- URL to stored baseline embedding (S3, Supabase Storage, etc.)
  current_embedding_url text,   -- URL to current call embedding
  alert_sent boolean default false,
  alert_type text check (alert_type in ('warning', 'emergency', null)),
  notes text,
  created_at timestamptz default now()
);

-- Index for fast patient queries
create index if not exists idx_voice_anomaly_patient_id on voice_anomaly_logs(patient_id);
create index if not exists idx_voice_anomaly_timestamp on voice_anomaly_logs(timestamp desc);
```

**Note:** You'll need to store embeddings somewhere (Supabase Storage, S3, or local filesystem). Document your choice.

---

### **PHASE 6.6: Supabase Anomaly Log Functions**

**File:** `/backend/supabase/anomalyLogs.ts` (CREATE NEW)

**Functions to Implement:**

```typescript
import { getSupabaseClient } from './client';
import { logger } from '../../utils';

export interface VoiceAnomalyLog {
  id: string;
  patient_id: string;
  call_log_id: string | null;
  timestamp: string;
  anomaly_score: number;
  raw_similarity: number | null;
  normalized_score: number | null;
  snr: number;
  baseline_embedding_url: string | null;
  current_embedding_url: string | null;
  alert_sent: boolean;
  alert_type: 'warning' | 'emergency' | null;
  notes: string | null;
}

export interface NewAnomalyLog {
  patient_id: string;
  call_log_id?: string;
  anomaly_score: number;
  raw_similarity?: number;
  normalized_score?: number;
  snr: number;
  baseline_embedding_url?: string;
  current_embedding_url?: string;
  alert_type?: 'warning' | 'emergency' | null;
}

export async function createAnomalyLog(input: NewAnomalyLog): Promise<VoiceAnomalyLog> {
  // Insert into voice_anomaly_logs table
}

export async function getAnomalyLogsForPatient(patientId: string): Promise<VoiceAnomalyLog[]> {
  // Fetch all logs for a patient, ordered by timestamp desc
}

export async function getRecentAnomalyLogs(patientIds: string[], days: number = 7): Promise<VoiceAnomalyLog[]> {
  // Fetch recent logs for multiple patients
}

export async function updateAnomalyLog(id: string, updates: Partial<NewAnomalyLog>): Promise<VoiceAnomalyLog> {
  // Update log (e.g., mark alert_sent, add notes)
}
```

---

### **PHASE 6.7: Python Service Client (Node.js)**

**File:** `/backend/anomaly/pythonClient.ts` (CREATE NEW)

Create a TypeScript client to call the Python microservice:

```typescript
import axios from 'axios';
import { logger } from '../../utils';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export interface EmbeddingResponse {
  embedding: number[];
  snr: number;
  sample_rate: number;
}

export interface CompareResponse {
  score: number;
  raw_similarity: number;
  normalized: number;
  snr: number;
}

export async function extractEmbedding(audioUrl: string): Promise<EmbeddingResponse> {
  // POST to Python service /embed
}

export async function compareEmbeddings(
  baseline: number[],
  current: number[],
  snr: number,
  hour?: number
): Promise<CompareResponse> {
  // POST to Python service /compare
}
```

---

### **PHASE 6.8: Anomaly Detection Service (Node.js)**

**File:** `/backend/anomaly/anomalyService.ts` (CREATE NEW)

**Core Logic:**

```typescript
import { extractEmbedding, compareEmbeddings } from './pythonClient';
import { getSupabaseClient } from '../supabase/client';
import { createAnomalyLog, getAnomalyLogsForPatient } from '../supabase/anomalyLogs';
import { logger } from '../../utils';

export interface AnomalyCheckResult {
  success: boolean;
  anomalyScore: number;
  rawSimilarity: number;
  normalizedScore: number;
  snr: number;
  alertType: 'warning' | 'emergency' | null;
  logId?: string;
  error?: string;
}

/**
 * Check voice anomaly for a patient after a call
 */
export async function checkVoiceAnomaly(
  patientId: string,
  callLogId: string,
  audioUrl: string
): Promise<AnomalyCheckResult> {
  try {
    // 1. Get or create baseline embedding
    const baselineEmbedding = await getOrCreateBaseline(patientId);
    
    // 2. Extract current call embedding
    const { embedding: currentEmbedding, snr } = await extractEmbedding(audioUrl);
    
    // 3. Compare embeddings
    const hour = new Date().getHours();
    const comparison = await compareEmbeddings(
      baselineEmbedding,
      currentEmbedding,
      snr,
      hour
    );
    
    // 4. Determine alert type
    const alertType = determineAlertType(comparison.score);
    
    // 5. Save anomaly log
    const log = await createAnomalyLog({
      patient_id: patientId,
      call_log_id: callLogId,
      anomaly_score: comparison.score,
      raw_similarity: comparison.raw_similarity,
      normalized_score: comparison.normalized,
      snr: comparison.snr,
      alert_type: alertType,
      // Store embedding URLs (implement storage solution)
      baseline_embedding_url: null, // TODO: Store baseline
      current_embedding_url: null,  // TODO: Store current
    });
    
    // 6. Send alert if needed (optional - can be handled separately)
    if (alertType) {
      await sendAnomalyAlert(patientId, comparison.score, alertType);
    }
    
    return {
      success: true,
      anomalyScore: comparison.score,
      rawSimilarity: comparison.raw_similarity,
      normalizedScore: comparison.normalized,
      snr: comparison.snr,
      alertType,
      logId: log.id,
    };
  } catch (error: any) {
    logger.error('Anomaly check failed', error);
    return {
      success: false,
      anomalyScore: 0,
      rawSimilarity: 0,
      normalizedScore: 0,
      snr: 0,
      alertType: null,
      error: error.message,
    };
  }
}

/**
 * Get baseline embedding for patient (or create from first call)
 */
async function getOrCreateBaseline(patientId: string): Promise<number[]> {
  // Check if baseline exists in database
  // If not, use first successful call as baseline
  // Store baseline for future use
}

/**
 * Determine alert type based on anomaly score
 */
function determineAlertType(score: number): 'warning' | 'emergency' | null {
  if (score > 0.40) return 'emergency';
  if (score > 0.25) return 'warning';
  return null;
}

/**
 * Send alert notification (optional - implement notification system)
 */
async function sendAnomalyAlert(
  patientId: string,
  score: number,
  type: 'warning' | 'emergency'
): Promise<void> {
  // TODO: Implement notification (email, push, etc.)
  logger.info('Anomaly alert', { patientId, score, type });
}
```

---

### **PHASE 6.9: REST API Endpoints (Node.js)**

**File:** `/backend/anomaly/anomalyController.ts` (CREATE NEW)

**Endpoints:**

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../utils';
import { checkVoiceAnomaly } from './anomalyService';
import { getAnomalyLogsForPatient } from '../supabase/anomalyLogs';

const router = Router();

/**
 * POST /api/anomaly-check
 * Check voice anomaly for a patient after a call
 */
router.post('/anomaly-check', async (req: Request, res: Response) => {
  try {
    const { patientId, callLogId, audioUrl } = req.body;
    
    if (!patientId || !audioUrl) {
      return res.status(400).json({ error: 'patientId and audioUrl are required' });
    }
    
    const result = await checkVoiceAnomaly(patientId, callLogId, audioUrl);
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error in anomaly-check endpoint', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/anomaly-logs/:patientId
 * Get anomaly logs for a patient
 */
router.get('/anomaly-logs/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    const logs = await getAnomalyLogsForPatient(patientId);
    
    res.json({ logs });
  } catch (error: any) {
    logger.error('Error fetching anomaly logs', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
```

**Register Routes in `backend/server.ts`:**
```typescript
import anomalyRoutes from './anomaly/anomalyController';

// ... existing code ...

app.use('/api', anomalyRoutes);
```

---

### **PHASE 6.10: Integration with Call Flow**

**File:** `/backend/routes/callRoutes.ts` (MODIFY EXISTING)

**Add anomaly check after successful call:**

```typescript
// After call completes successfully (around line 82-90)
if (result.success) {
  // Create call log entry
  const callLog = await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    summary: result.callId
      ? `Manual call completed. Call ID: ${result.callId}`
      : 'Manual call completed',
  });
  
  // NEW: Check for voice anomaly (if audio URL available from VAPI)
  // VAPI may provide audio recording URL in call status
  try {
    const callStatus = await getCallStatus(result.callId!);
    if (callStatus.recordingUrl || callStatus.transcriptUrl) {
      // Trigger anomaly check asynchronously (don't block response)
      checkVoiceAnomaly(patientId, callLog.id, callStatus.recordingUrl)
        .catch(err => logger.error('Anomaly check failed', err));
    }
  } catch (error) {
    logger.warn('Could not check anomaly - audio not available', error);
  }
}
```

**Also update `/backend/scheduler/callScheduler.ts`** to check anomalies after scheduled calls.

---

### **PHASE 6.11: Baseline Capture Strategy**

**Decision Point:** When to capture baseline?

**Option A: During Onboarding (Recommended)**
- Add voice recording step to onboarding
- Extract baseline embedding immediately
- Store in database or storage

**Option B: First Successful Call**
- Use first successful call as baseline
- Extract embedding after first call
- Store for future comparisons

**Implementation:**
```typescript
// In anomalyService.ts
async function getOrCreateBaseline(patientId: string): Promise<number[]> {
  const supabase = getSupabaseClient();
  
  // Check if baseline exists
  const { data: existing } = await supabase
    .from('patients')
    .select('baseline_embedding_url')
    .eq('id', patientId)
    .single();
  
  if (existing?.baseline_embedding_url) {
    // Load baseline from storage
    const baseline = await loadEmbeddingFromUrl(existing.baseline_embedding_url);
    return baseline;
  }
  
  // No baseline - use first call as baseline (or return null and skip check)
  return null; // Or throw error to indicate baseline needed
}
```

**Add to patients table (optional):**
```sql
alter table patients add column if not exists baseline_embedding_url text;
```

---

## 🔧 TECHNICAL DECISIONS

### **Audio Storage:**
- **Option 1:** Supabase Storage (recommended for simplicity)
- **Option 2:** AWS S3
- **Option 3:** Local filesystem (not recommended for production)

### **Embedding Storage:**
- Store as JSON arrays in database (simple but large)
- Store as files in storage (recommended)
- Store as base64 in database (not recommended)

### **Python Service Deployment:**
- Run locally during development
- Docker container for production
- Environment variable: `PYTHON_SERVICE_URL`

---

## 📝 ENVIRONMENT VARIABLES

**Node Backend (`.env`):**
```bash
# Python Anomaly Service
PYTHON_SERVICE_URL=http://localhost:8000

# Supabase (existing)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Storage (if using Supabase Storage)
SUPABASE_STORAGE_BUCKET=voice-recordings
```

**Python Service (`.env`):**
```bash
PORT=8000
CORS_ORIGINS=http://localhost:3000
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Python Microservice:
- [ ] Create `/python/anomaly-service/` directory
- [ ] Set up `requirements.txt`
- [ ] Implement `utils/audio.py` (embedding extraction, SNR)
- [ ] Implement `utils/scoring.py` (similarity, anomaly scoring)
- [ ] Implement FastAPI endpoints (`/embed`, `/compare`)
- [ ] Add CORS middleware
- [ ] Test endpoints independently
- [ ] Create Dockerfile (optional)

### Node Backend Integration:
- [ ] Add `voice_anomaly_logs` table to schema
- [ ] Create `/backend/supabase/anomalyLogs.ts`
- [ ] Create `/backend/anomaly/pythonClient.ts`
- [ ] Create `/backend/anomaly/anomalyService.ts`
- [ ] Create `/backend/anomaly/anomalyController.ts`
- [ ] Register routes in `server.ts`
- [ ] Integrate with call completion flow
- [ ] Implement baseline capture strategy
- [ ] Test end-to-end flow

### Integration Testing:
- [ ] Test Python service endpoints
- [ ] Test Node → Python communication
- [ ] Test database writes/reads
- [ ] Test with real VAPI call audio (if available)
- [ ] Test alert threshold logic

---

## 🚨 IMPORTANT NOTES

1. **Audio Source:** VAPI may provide audio recording URLs. Check VAPI API docs for how to retrieve call recordings.

2. **Baseline Strategy:** Decide early whether to capture during onboarding or use first call. This affects onboarding flow.

3. **Error Handling:** Anomaly detection should not break call flow. Wrap in try-catch and log errors.

4. **Performance:** Python service should cache model on startup. Consider async processing for anomaly checks.

5. **Storage:** Plan for embedding storage early. Supabase Storage is recommended.

6. **Teammate Coordination:** UI teammate will call your endpoints. Ensure API contract matches `ANOMALY_COORDINATION.md`.

---

## 📞 COORDINATION WITH UI TEAMMATE

- **You Provide:**
  - `POST /api/anomaly-check` endpoint
  - `GET /api/anomaly-logs/:patientId` endpoint
  - Database table for anomaly logs

- **Teammate Provides:**
  - UI components to display anomalies
  - Frontend API client (calls your endpoints)

- **Shared:**
  - API contract (see `ANOMALY_COORDINATION.md`)
  - Database schema (you implement, teammate uses)

---

**End of Backend Master Prompt**

