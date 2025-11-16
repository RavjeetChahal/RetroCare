/**
 * Comprehensive test suite for anomaly detection service
 * 
 * Tests cover:
 * - Normal flow: first call with healthy patient
 * - Edge cases: sick patient, missing data, errors
 * - Anomaly detection: various score thresholds
 * - Database interactions
 * 
 * Run with: npx tsx backend/anomaly/anomalyService.test.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import { checkVoiceAnomaly, isAnomalyServiceAvailable } from './anomalyService';
import { getSupabaseClient } from '../supabase/client';
import { getVoiceBaseline, saveVoiceBaseline } from '../supabase/voiceBaseline';
import { createCallLog } from '../supabase/callLogs';
import { createPatient, deletePatient } from '../supabase/patients';
import { logger } from '../utils/logger';

// Mock data helpers
const TEST_PATIENT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_CAREGIVER_ID = '00000000-0000-0000-0000-000000000002';

// Test audio URL (public test audio file)
const TEST_AUDIO_URL = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

/**
 * Helper to create a test patient
 */
async function createTestPatient(flags: string[] = []): Promise<string> {
  const supabase = getSupabaseClient();
  
  // First create a caregiver if needed
  const { data: existingCaregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('id', TEST_CAREGIVER_ID)
    .single();
  
  if (!existingCaregiver) {
    await supabase
      .from('caregivers')
      .insert({
        id: TEST_CAREGIVER_ID,
        clerk_id: 'test-clerk-id',
        name: 'Test Caregiver',
        timezone: 'America/New_York',
        phone: '+15551234567',
      });
  }
  
  // Create patient
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', TEST_PATIENT_ID)
    .single();
  
  if (existingPatient) {
    await supabase
      .from('patients')
      .update({ flags })
      .eq('id', TEST_PATIENT_ID);
  } else {
    await supabase
      .from('patients')
      .insert({
        id: TEST_PATIENT_ID,
        caregiver_id: TEST_CAREGIVER_ID,
        name: 'Test Patient',
        age: 75,
        phone: '+15559876543',
        timezone: 'America/New_York',
        meds: [],
        conditions: [],
        call_schedule: [],
        voice_choice: 'test-voice-id',
        flags,
      });
  }
  
  return TEST_PATIENT_ID;
}

/**
 * Helper to cleanup test data
 */
async function cleanupTestData(): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Delete anomaly logs
  await supabase
    .from('voice_anomaly_logs')
    .delete()
    .eq('patient_id', TEST_PATIENT_ID);
  
  // Delete call logs
  await supabase
    .from('call_logs')
    .delete()
    .eq('patient_id', TEST_PATIENT_ID);
  
  // Delete voice baseline
  await supabase
    .from('patient_voice_baseline')
    .delete()
    .eq('patient_id', TEST_PATIENT_ID);
  
  // Delete patient
  await supabase
    .from('patients')
    .delete()
    .eq('id', TEST_PATIENT_ID);
}

/**
 * Test runner helper
 */
async function runTest(
  name: string,
  testFn: () => Promise<boolean | { passed: boolean; error?: string; details?: any }>
): Promise<void> {
  try {
    const result = await testFn();
    const passed = typeof result === 'boolean' ? result : result.passed;
    const error = typeof result === 'object' ? result.error : undefined;
    const details = typeof result === 'object' ? result.details : undefined;
    
    testResults.push({ name, passed, error, details });
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  } catch (error: any) {
    testResults.push({ name, passed: false, error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * TEST SUITE
 */

async function test1_FirstCallHealthyPatient(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]); // No flags = healthy
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  if (!result.success) {
    return false;
  }
  
  // Should store baseline and return score 0
  const baseline = await getVoiceBaseline(patientId);
  const hasBaseline = baseline?.embedding !== null;
  
  return (
    result.anomalyScore === 0 &&
    result.rawSimilarity === 1.0 &&
    result.alertType === null &&
    hasBaseline
  );
}

async function test2_FirstCallSickPatient(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient(['sick', 'fever']); // Sick flags
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  if (!result.success) {
    return false;
  }
  
  // Should NOT store baseline when patient is sick
  const baseline = await getVoiceBaseline(patientId);
  const hasNoBaseline = !baseline || baseline.embedding === null;
  
  return (
    result.anomalyScore === 0 &&
    hasNoBaseline
  );
}

async function test3_SecondCallWithBaseline(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // First call - creates baseline
  const firstResult = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  if (!firstResult.success) {
    return false;
  }
  
  // Create a call log to simulate second call
  await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    outcome: 'answered',
    transcript: 'Test transcript',
  });
  
  // Second call - should compare against baseline
  const secondResult = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  return (
    secondResult.success &&
    secondResult.anomalyScore >= 0 &&
    secondResult.rawSimilarity >= 0 &&
    secondResult.rawSimilarity <= 1
  );
}

async function test4_MissingAudioUrl(): Promise<{ passed: boolean; error?: string }> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  try {
    const result = await checkVoiceAnomaly(patientId, undefined, '');
    return {
      passed: !result.success && !!result.error,
      error: result.error,
    };
  } catch (error: any) {
    return {
      passed: true, // Expected to throw
      error: error.message,
    };
  }
}

async function test5_InvalidAudioUrl(): Promise<{ passed: boolean; error?: string }> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  const result = await checkVoiceAnomaly(
    patientId,
    undefined,
    'https://invalid-url-that-does-not-exist.com/audio.wav'
  );
  
  return {
    passed: !result.success && !!result.error,
    error: result.error,
  };
}

async function test6_HealthFlagsCheck(): Promise<boolean> {
  await cleanupTestData();
  const supabase = getSupabaseClient();
  const patientId = await createTestPatient([]);
  
  // Add health flag indicating sickness
  await supabase
    .from('health_flags')
    .insert({
      patient_id: patientId,
      flag: 'feeling unwell',
      source: 'assistant',
      resolved: false,
    });
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  // Should not store baseline when health flag indicates sickness
  const baseline = await getVoiceBaseline(patientId);
  const hasNoBaseline = !baseline || baseline.embedding === null;
  
  // Cleanup health flag
  await supabase
    .from('health_flags')
    .delete()
    .eq('patient_id', patientId);
  
  return hasNoBaseline && result.success;
}

async function test7_NonExistentPatient(): Promise<{ passed: boolean; error?: string }> {
  const fakePatientId = '99999999-9999-9999-9999-999999999999';
  
  const result = await checkVoiceAnomaly(fakePatientId, undefined, TEST_AUDIO_URL);
  
  return {
    passed: !result.success,
    error: result.error,
  };
}

async function test8_BaselineRetrieval(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // Create baseline manually
  const testEmbedding = Array(192).fill(0).map(() => Math.random());
  await saveVoiceBaseline(patientId, testEmbedding, null);
  
  // First call should use existing baseline
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  return result.success && result.anomalyScore >= 0;
}

async function test9_MultipleCallsSamePatient(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // First call
  const firstResult = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  if (!firstResult.success) return false;
  
  // Create call log
  const callLog1 = await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    outcome: 'answered',
    transcript: 'First call',
  });
  
  // Second call
  const secondResult = await checkVoiceAnomaly(patientId, callLog1.id, TEST_AUDIO_URL);
  if (!secondResult.success) return false;
  
  // Third call
  const callLog2 = await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    outcome: 'answered',
    transcript: 'Second call',
  });
  
  const thirdResult = await checkVoiceAnomaly(patientId, callLog2.id, TEST_AUDIO_URL);
  
  return (
    firstResult.anomalyScore === 0 && // First call is baseline
    secondResult.anomalyScore >= 0 &&
    thirdResult.success &&
    thirdResult.anomalyScore >= 0
  );
}

async function test10_AlertThresholds(): Promise<{ passed: boolean; details?: any }> {
  // This test checks that alert types are determined correctly
  // Note: We can't easily control the anomaly score without mocking,
  // but we can verify the logic exists
  
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // Create baseline
  await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  // Create call log
  await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    outcome: 'answered',
    transcript: 'Test',
  });
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  // Verify alert type logic
  let alertTypeCorrect = true;
  if (result.anomalyScore > 0.40 && result.alertType !== 'emergency') {
    alertTypeCorrect = false;
  } else if (result.anomalyScore > 0.25 && result.anomalyScore <= 0.40 && result.alertType !== 'warning') {
    alertTypeCorrect = false;
  } else if (result.anomalyScore <= 0.25 && result.alertType !== null) {
    alertTypeCorrect = false;
  }
  
  return {
    passed: alertTypeCorrect,
    details: {
      anomalyScore: result.anomalyScore,
      alertType: result.alertType,
    },
  };
}

async function test11_EmptyFlagsArray(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]); // Empty flags = healthy
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  const baseline = await getVoiceBaseline(patientId);
  
  return result.success && baseline?.embedding !== null;
}

async function test12_ResolvedHealthFlags(): Promise<boolean> {
  await cleanupTestData();
  const supabase = getSupabaseClient();
  const patientId = await createTestPatient([]);
  
  // Add resolved health flag (should not prevent baseline storage)
  await supabase
    .from('health_flags')
    .insert({
      patient_id: patientId,
      flag: 'was sick but recovered',
      source: 'assistant',
      resolved: true, // Resolved = healthy
      resolved_at: new Date().toISOString(),
    });
  
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  const baseline = await getVoiceBaseline(patientId);
  
  // Cleanup
  await supabase
    .from('health_flags')
    .delete()
    .eq('patient_id', patientId);
  
  return result.success && baseline?.embedding !== null;
}

async function test13_NoCallLogsButBaselineExists(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // Create baseline manually
  const testEmbedding = Array(192).fill(0).map(() => Math.random());
  await saveVoiceBaseline(patientId, testEmbedding, null);
  
  // Check anomaly (no call logs exist)
  const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  return result.success && result.anomalyScore >= 0;
}

async function test14_AnomalyLogCreation(): Promise<boolean> {
  await cleanupTestData();
  const supabase = getSupabaseClient();
  const patientId = await createTestPatient([]);
  
  // Create baseline
  await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  // Create call log
  const callLog = await createCallLog({
    patient_id: patientId,
    timestamp: new Date().toISOString(),
    outcome: 'answered',
    transcript: 'Test',
  });
  
  // Check anomaly
  const result = await checkVoiceAnomaly(patientId, callLog.id, TEST_AUDIO_URL);
  
  if (!result.success || !result.logId) {
    return false;
  }
  
  // Verify anomaly log was created
  const { data: anomalyLog } = await supabase
    .from('voice_anomaly_logs')
    .select('*')
    .eq('id', result.logId)
    .single();
  
  return (
    anomalyLog !== null &&
    anomalyLog.patient_id === patientId &&
    anomalyLog.call_log_id === callLog.id &&
    anomalyLog.anomaly_score === result.anomalyScore
  );
}

async function test15_PythonServiceAvailability(): Promise<boolean> {
  const isAvailable = await isAnomalyServiceAvailable();
  return typeof isAvailable === 'boolean';
}

async function test16_EmbeddingStorageFormat(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // Create baseline
  await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
  
  // Check baseline format
  const baseline = await getVoiceBaseline(patientId);
  if (!baseline?.embedding) {
    return false;
  }
  
  // Should be JSON string or array
  let embedding: number[];
  if (typeof baseline.embedding === 'string') {
    embedding = JSON.parse(baseline.embedding);
  } else {
    embedding = baseline.embedding;
  }
  
  return (
    Array.isArray(embedding) &&
    embedding.length > 0 &&
    embedding.every(val => typeof val === 'number')
  );
}

async function test17_ConcurrentCalls(): Promise<boolean> {
  await cleanupTestData();
  const patientId = await createTestPatient([]);
  
  // Simulate concurrent calls
  const promises = [
    checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL),
    checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL),
  ];
  
  const results = await Promise.all(promises);
  
  // At least one should succeed and create baseline
  const atLeastOneSuccess = results.some(r => r.success);
  const baseline = await getVoiceBaseline(patientId);
  
  return atLeastOneSuccess && baseline?.embedding !== null;
}

async function test18_VariousSickFlags(): Promise<boolean> {
  const sickFlags = [
    ['sick'],
    ['illness'],
    ['feeling unwell'],
    ['pain'],
    ['fever'],
    ['cough'],
    ['cold'],
    ['flu'],
    ['infection'],
  ];
  
  for (const flags of sickFlags) {
    await cleanupTestData();
    const patientId = await createTestPatient(flags);
    
    const result = await checkVoiceAnomaly(patientId, undefined, TEST_AUDIO_URL);
    const baseline = await getVoiceBaseline(patientId);
    
    // Should not store baseline for any sick flag
    if (baseline?.embedding !== null) {
      return false;
    }
  }
  
  return true;
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('\n🧪 RetroCare Anomaly Detection Test Suite\n');
  console.log('='.repeat(60));
  console.log('');
  
  // Check Python service first
  const pythonAvailable = await isAnomalyServiceAvailable();
  if (!pythonAvailable) {
    console.log('⚠️  Python anomaly service is not available');
    console.log('   Some tests may fail. Start it with:');
    console.log('   cd python/anomaly-service && python main.py\n');
  }
  
  // Run all tests
  await runTest('Test 1: First call with healthy patient stores baseline', test1_FirstCallHealthyPatient);
  await runTest('Test 2: First call with sick patient does NOT store baseline', test2_FirstCallSickPatient);
  await runTest('Test 3: Second call compares against baseline', test3_SecondCallWithBaseline);
  await runTest('Test 4: Missing audio URL handled gracefully', test4_MissingAudioUrl);
  await runTest('Test 5: Invalid audio URL handled gracefully', test5_InvalidAudioUrl);
  await runTest('Test 6: Health flags prevent baseline storage', test6_HealthFlagsCheck);
  await runTest('Test 7: Non-existent patient handled gracefully', test7_NonExistentPatient);
  await runTest('Test 8: Existing baseline is retrieved correctly', test8_BaselineRetrieval);
  await runTest('Test 9: Multiple calls for same patient', test9_MultipleCallsSamePatient);
  await runTest('Test 10: Alert thresholds work correctly', test10_AlertThresholds);
  await runTest('Test 11: Empty flags array treated as healthy', test11_EmptyFlagsArray);
  await runTest('Test 12: Resolved health flags don\'t prevent baseline', test12_ResolvedHealthFlags);
  await runTest('Test 13: Baseline exists without call logs', test13_NoCallLogsButBaselineExists);
  await runTest('Test 14: Anomaly log is created correctly', test14_AnomalyLogCreation);
  await runTest('Test 15: Python service availability check', test15_PythonServiceAvailability);
  await runTest('Test 16: Embedding stored in correct format', test16_EmbeddingStorageFormat);
  await runTest('Test 17: Concurrent calls handled correctly', test17_ConcurrentCalls);
  await runTest('Test 18: Various sick flags prevent baseline', test18_VariousSickFlags);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:');
    testResults
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Cleanup
  await cleanupTestData();
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

