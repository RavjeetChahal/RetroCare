# RetroCare Voice Anomaly Detection Service

Python microservice for voice embedding extraction and anomaly detection using SpeechBrain's ECAPA-TDNN model.

## Setup

1. **Create virtual environment (recommended):**
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or: venv\Scripts\activate  # On Windows
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

**Note:** If you get "externally-managed-environment" error, use a virtual environment (step 1).

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Run the service:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # On macOS/Linux

# Run with Python
python main.py

# Or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Note:** Always activate the virtual environment before running the service.

## API Endpoints

### `GET /health`
Health check endpoint.

### `POST /embed`
Extract voice embedding from audio URL.

**Request:**
```json
{
  "audio_url": "https://example.com/audio.mp3",
  "sample_rate": 16000
}
```

**Response:**
```json
{
  "embedding": [0.123, ...],
  "snr": 18.5,
  "sample_rate": 16000
}
```

### `POST /compare`
Compare baseline and current embeddings.

**Request:**
```json
{
  "baseline": [0.123, ...],
  "current": [0.456, ...],
  "snr": 18.5,
  "hour": 14
}
```

**Response:**
```json
{
  "score": 0.65,
  "raw_similarity": 0.35,
  "normalized": 0.65,
  "snr": 18.5
}
```

## Model

Uses SpeechBrain's ECAPA-TDNN model (`speechbrain/spkrec-ecapa-voxceleb`) for speaker verification. The model is downloaded automatically on first run and cached in `models/ecapa/`.

## Development

- Model loads on startup for performance
- Embeddings are 192-dimensional vectors
- Audio is resampled to 16kHz if needed
- SNR computation uses spectral analysis

## Docker (Optional)

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

