# Test Audio Examples for Embed Endpoint

## Small Test Audio Files

### Option 1: Use a Small Test Audio from Common Sources

**Short test audio (1-2 seconds):**
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
    "sample_rate": 16000
  }'
```

**Very short beep sound:**
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
    "sample_rate": 16000
  }'
```

### Option 2: Use a VAPI Recording URL

If you have a VAPI call recording URL from a previous call, use that:
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "YOUR_VAPI_RECORDING_URL_HERE",
    "sample_rate": 16000
  }'
```

### Option 3: Create a Small Test Audio File

If you want to create your own small test file:

**Using ffmpeg (creates a 2-second sine wave):**
```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=2" -ar 16000 test_audio.wav
```

Then upload it somewhere (like GitHub, Dropbox, or a temporary file hosting service) and use that URL.

### Option 4: Use a GitHub Raw File

If you upload a small audio file to your GitHub repo:
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/test_audio.wav",
    "sample_rate": 16000
  }'
```

## Expected Response

**Success (when model is loaded):**
```json
{
  "embedding": [0.123, -0.456, 0.789, ...],
  "snr": 18.5,
  "sample_rate": 16000
}
```

**Error (model not loaded):**
```json
{
  "detail": "Model not loaded. Error: ..."
}
```
Status: 503

**Error (invalid audio URL):**
```json
{
  "detail": "Failed to extract embedding: ..."
}
```
Status: 500

## Quick Test Command

Test with a small audio file:
```bash
curl -X POST https://retrocare-python.onrender.com/embed \
  -H "Content-Type: application/json" \
  -d '{"audio_url":"https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav","sample_rate":16000}' \
  | python3 -m json.tool
```


