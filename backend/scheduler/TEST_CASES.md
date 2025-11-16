# Call Scheduler Test Cases

This document describes comprehensive test cases for the call scheduler system.

## Overview

The call scheduler runs every hour at :00 (e.g., 09:00, 10:00, 11:00) and checks which patients need to be called based on:
1. Their `call_schedule` array (e.g., `["09:00", "14:00", "19:00"]`)
2. Their timezone
3. Whether they've been called in the last hour (duplicate prevention)

## Test Categories

### 1. Time Matching - Basic Cases

#### Test 1.1: Exact Hour Matching
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["09:00"]`, timezone `UTC`
- **Expected**: Should call ✅

#### Test 1.2: Different Hour
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["10:00"]`, timezone `UTC`
- **Expected**: Should NOT call ❌

#### Test 1.3: Multiple Scheduled Times
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["08:00", "09:00", "10:00", "14:00", "19:00"]`, timezone `UTC`
- **Expected**: Should call ✅

#### Test 1.4: Empty Schedule
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `[]`, timezone `UTC`
- **Expected**: Should NOT call ❌

### 2. Timezone Edge Cases

#### Test 2.1: EST Patient at 9 AM EST
- **Setup**: Current time is 14:00 UTC (9 AM EST)
- **Patient**: Schedule `["09:00"]`, timezone `America/New_York`
- **Expected**: Should call ✅

#### Test 2.2: PST Patient at 6 AM PST
- **Setup**: Current time is 14:00 UTC (6 AM PST)
- **Patient**: Schedule `["06:00"]`, timezone `America/Los_Angeles`
- **Expected**: Should call ✅

#### Test 2.3: DST Spring Forward
- **Setup**: Current time is 07:00 UTC on March 10, 2024 (3 AM EDT after spring forward)
- **Patient**: Schedule `["03:00"]`, timezone `America/New_York`
- **Expected**: Should call ✅
- **Note**: Tests that DST transition is handled correctly

#### Test 2.4: DST Fall Back
- **Setup**: Current time is 06:00 UTC on November 3, 2024 (1 AM EST after fall back)
- **Patient**: Schedule `["01:00"]`, timezone `America/New_York`
- **Expected**: Should call ✅

#### Test 2.5: Midnight (00:00)
- **Setup**: Current time is 00:00 UTC
- **Patient**: Schedule `["00:00"]`, timezone `UTC`
- **Expected**: Should call ✅

#### Test 2.6: Late Night (23:00)
- **Setup**: Current time is 23:00 UTC
- **Patient**: Schedule `["23:00"]`, timezone `UTC`
- **Expected**: Should call ✅

### 3. Duplicate Call Prevention

#### Test 3.1: Called Within Last Hour
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["09:00"]`, `last_call_at` = `08:30 UTC` (30 minutes ago)
- **Expected**: Should NOT call ❌ (prevent duplicate)

#### Test 3.2: Called Over an Hour Ago
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["09:00"]`, `last_call_at` = `07:30 UTC` (1.5 hours ago)
- **Expected**: Should call ✅

#### Test 3.3: Never Called Before
- **Setup**: Current time is 09:00 UTC
- **Patient**: Schedule `["09:00"]`, `last_call_at` = `null`
- **Expected**: Should call ✅

### 4. Multiple Patients Scenarios

#### Test 4.1: Multiple Patients, Same Timezone
- **Setup**: Current time is 09:00 UTC
- **Patients**:
  - Patient A: Schedule `["09:00"]`, timezone `UTC`
  - Patient B: Schedule `["10:00"]`, timezone `UTC`
  - Patient C: Schedule `["09:00", "14:00"]`, timezone `UTC`
- **Expected**: Patient A and C should be called ✅

#### Test 4.2: Multiple Patients, Different Timezones
- **Setup**: Current time is 14:00 UTC
- **Patients**:
  - Patient A: Schedule `["09:00"]`, timezone `America/New_York` (9 AM EST = 14:00 UTC)
  - Patient B: Schedule `["06:00"]`, timezone `America/Los_Angeles` (6 AM PST = 14:00 UTC)
  - Patient C: Schedule `["14:00"]`, timezone `UTC`
- **Expected**: All three should be called ✅

#### Test 4.3: Filter Empty Schedules
- **Setup**: Current time is 09:00 UTC
- **Patients**:
  - Patient A: Schedule `["09:00"]`
  - Patient B: Schedule `[]`
  - Patient C: Schedule `null`
- **Expected**: Only Patient A should be called ✅

### 5. Hourly Execution Timing

#### Test 5.1: Exact :00 Minute
- **Setup**: Current time is 09:00:00 UTC
- **Expected**: Should trigger ✅

#### Test 5.2: :30 Minutes Past Hour
- **Setup**: Current time is 09:30:00 UTC
- **Expected**: Should still match hour "09:00" ✅
- **Note**: Cron runs at :00, but time matching uses hour component

#### Test 5.3: Hour Boundary Transition
- **Setup**: Current time transitions from 09:59:59 to 10:00:00 UTC
- **Expected**: 
  - At 09:59:59: Should match "09:00" ✅
  - At 10:00:00: Should match "10:00" ✅

### 6. Schedule Format Validation

#### Test 6.1: Valid Formats
- Valid: `["09:00"]`, `["09:00", "14:00"]`, `["00:00", "23:00"]`
- **Expected**: Should work correctly ✅

#### Test 6.2: Invalid Formats
- Invalid: `["9:00"]` (missing leading zero), `["09:30"]` (not on hour), `["25:00"]` (invalid hour)
- **Expected**: Should not match ❌

### 7. Real-World Scenarios

#### Test 7.1: Caregiver Schedules Multiple Daily Calls
- **Setup**: Patient scheduled for `["08:00", "12:00", "18:00"]`
- **Test**: At each scheduled time
- **Expected**: Should call at each time ✅

#### Test 7.2: Patients Across Multiple Timezones
- **Setup**: 
  - Patient in EST: `["09:00"]`
  - Patient in PST: `["06:00"]`
  - Patient in UTC: `["14:00"]`
- **Test**: At 14:00 UTC
- **Expected**: All three should be called ✅

#### Test 7.3: Edge Case - Midnight Call
- **Setup**: Patient scheduled for `["00:00"]`
- **Test**: At midnight
- **Expected**: Should call ✅

#### Test 7.4: Edge Case - Late Night Call
- **Setup**: Patient scheduled for `["23:00"]`
- **Test**: At 11 PM
- **Expected**: Should call ✅

### 8. Error Handling

#### Test 8.1: Database Error
- **Setup**: Simulate database connection failure
- **Expected**: Should return empty array, not crash ✅

#### Test 8.2: Null Schedule
- **Setup**: Patient with `call_schedule = null`
- **Expected**: Should skip patient ✅

#### Test 8.3: Non-Array Schedule
- **Setup**: Patient with `call_schedule = "09:00"` (string instead of array)
- **Expected**: Should skip patient ✅

### 9. Performance and Concurrency

#### Test 9.1: Large Number of Patients
- **Setup**: 100 patients with schedules
- **Expected**: Should process efficiently (< 1 second) ✅

#### Test 9.2: Concurrent Calls
- **Setup**: Multiple patients due at same time
- **Expected**: Should handle parallel calls correctly ✅

## Running Tests

### Manual Testing Script
```bash
npm run test:scheduler
```

### With Custom Time
```bash
tsx scripts/testCallScheduler.ts "2024-01-15T09:00:00Z" "UTC"
```

### Unit Tests (when implemented)
```bash
tsx backend/scheduler/callScheduler.test.ts
```

## Test Data Setup

To test with real data, create test patients:

```sql
-- Patient in EST, scheduled for 9 AM and 2 PM EST
INSERT INTO patients (caregiver_id, name, age, phone, timezone, call_schedule, voice_choice)
VALUES (
  'caregiver-id',
  'Test Patient EST',
  75,
  '+1234567890',
  'America/New_York',
  '["09:00", "14:00"]'::jsonb,
  'assistant-id'
);

-- Patient in PST, scheduled for 6 AM and 6 PM PST
INSERT INTO patients (caregiver_id, name, age, phone, timezone, call_schedule, voice_choice)
VALUES (
  'caregiver-id',
  'Test Patient PST',
  80,
  '+1234567891',
  'America/Los_Angeles',
  '["06:00", "18:00"]'::jsonb,
  'assistant-id'
);
```

## Expected Behavior Summary

1. **Scheduler runs every hour at :00** (cron: `0 * * * *`)
2. **Checks each patient's schedule** against current hour in their timezone
3. **Prevents duplicate calls** if called within last hour
4. **Handles timezones correctly** including DST transitions
5. **Processes multiple patients** in parallel
6. **Handles errors gracefully** without crashing

