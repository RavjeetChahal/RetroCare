# Anomaly Detection Test Suite

This document describes the comprehensive test suite for the voice anomaly detection feature.

## Overview

The test suite (`anomalyService.test.ts`) contains 18 test cases covering:
- ✅ Normal flow scenarios
- ✅ Edge cases and error handling
- ✅ Database interactions
- ✅ Health status checks
- ✅ Baseline storage logic
- ✅ Anomaly detection and alerting

## Prerequisites

1. **Python Anomaly Service**: The Python service must be running
   ```bash
   cd python/anomaly-service
   python main.py
   ```

2. **Database**: Supabase database must be accessible with proper environment variables set

3. **Environment Variables**: Ensure `.env` file contains:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PYTHON_SERVICE_URL` (defaults to `http://localhost:8000`)

## Running Tests

### Run All Tests
```bash
npm run test:anomaly
```

Or directly:
```bash
npx tsx backend/anomaly/anomalyService.test.ts
```

### Run Integration Tests
```bash
npm run test:anomaly-integration
```

## Test Cases

### 1. First Call with Healthy Patient ✅
**Purpose**: Verify baseline is stored on first call when patient is healthy
- Creates a patient with no flags
- Calls anomaly check
- Verifies baseline is stored
- Verifies anomaly score is 0 (it's the baseline)

### 2. First Call with Sick Patient ❌
**Purpose**: Verify baseline is NOT stored when patient is sick
- Creates a patient with sick flags (`['sick', 'fever']`)
- Calls anomaly check
- Verifies baseline is NOT stored
- Verifies function still succeeds

### 3. Second Call with Baseline ✅
**Purpose**: Verify subsequent calls compare against baseline
- Creates baseline on first call
- Creates a call log
- Calls anomaly check again
- Verifies comparison happens (score >= 0)

### 4. Missing Audio URL ⚠️
**Purpose**: Verify graceful handling of missing audio URL
- Calls anomaly check with empty audio URL
- Verifies function fails gracefully with error message

### 5. Invalid Audio URL ⚠️
**Purpose**: Verify graceful handling of invalid audio URL
- Calls anomaly check with non-existent URL
- Verifies function fails gracefully with error message

### 6. Health Flags Check ✅
**Purpose**: Verify unresolved health flags prevent baseline storage
- Creates patient with health flag indicating sickness
- Calls anomaly check
- Verifies baseline is NOT stored

### 7. Non-Existent Patient ⚠️
**Purpose**: Verify graceful handling of invalid patient ID
- Calls anomaly check with fake patient ID
- Verifies function fails gracefully

### 8. Baseline Retrieval ✅
**Purpose**: Verify existing baseline is retrieved correctly
- Manually creates baseline
- Calls anomaly check
- Verifies baseline is used for comparison

### 9. Multiple Calls Same Patient ✅
**Purpose**: Verify multiple calls work correctly
- Makes first call (creates baseline)
- Makes second call (compares)
- Makes third call (compares)
- Verifies all calls succeed

### 10. Alert Thresholds ✅
**Purpose**: Verify alert types are determined correctly
- Creates baseline
- Makes comparison call
- Verifies alert type matches score:
  - `score > 0.40` → `emergency`
  - `0.25 < score <= 0.40` → `warning`
  - `score <= 0.25` → `null`

### 11. Empty Flags Array ✅
**Purpose**: Verify empty flags treated as healthy
- Creates patient with empty flags array
- Verifies baseline is stored

### 12. Resolved Health Flags ✅
**Purpose**: Verify resolved flags don't prevent baseline storage
- Creates patient with resolved health flag
- Verifies baseline is stored (resolved = healthy)

### 13. Baseline Exists Without Call Logs ✅
**Purpose**: Verify baseline can exist independently
- Manually creates baseline
- Calls anomaly check without call logs
- Verifies baseline is used

### 14. Anomaly Log Creation ✅
**Purpose**: Verify anomaly logs are created correctly
- Creates baseline
- Creates call log
- Calls anomaly check
- Verifies anomaly log exists with correct data

### 15. Python Service Availability ✅
**Purpose**: Verify service availability check works
- Calls availability check
- Verifies boolean result

### 16. Embedding Storage Format ✅
**Purpose**: Verify embeddings stored in correct format
- Creates baseline
- Retrieves baseline
- Verifies embedding is valid array of numbers

### 17. Concurrent Calls ✅
**Purpose**: Verify concurrent calls handled correctly
- Makes two concurrent calls
- Verifies at least one succeeds
- Verifies baseline is created

### 18. Various Sick Flags ✅
**Purpose**: Verify all sick flag variations prevent baseline
- Tests multiple sick flag strings:
  - `sick`, `illness`, `feeling unwell`, `pain`, `fever`
  - `cough`, `cold`, `flu`, `infection`
- Verifies none allow baseline storage

## Test Output

The test suite provides:
- ✅/❌ Status for each test
- Error messages for failed tests
- Detailed summary with pass/fail counts
- Success rate percentage

## Expected Results

All tests should pass when:
- Python service is running
- Database is accessible
- Test data can be created/cleaned up

## Troubleshooting

### Tests Failing
1. **Check Python Service**: Ensure it's running on port 8000
2. **Check Database**: Verify Supabase connection
3. **Check Environment**: Ensure all env vars are set
4. **Check Permissions**: Ensure service role key has write access

### Common Issues
- **"Python service not available"**: Start the Python service
- **"Patient not found"**: Database connection issue
- **"Failed to extract embedding"**: Python service error or invalid audio URL

## Test Data Cleanup

The test suite automatically:
- Creates test patients/caregivers
- Creates test call logs
- Creates test baselines
- Cleans up all test data after tests complete

Test data uses specific UUIDs to avoid conflicts:
- Patient ID: `00000000-0000-0000-0000-000000000001`
- Caregiver ID: `00000000-0000-0000-0000-000000000002`

## Integration Tests

The integration test suite (`scripts/testAnomalyDetection.ts`) provides:
- Python service health check
- Database connectivity check
- End-to-end anomaly detection flow
- Real audio processing tests

Run with: `npm run test:anomaly-integration`

