/**
 * Test script for voice anomaly detection
 * 
 * This script tests:
 * 1. Python service availability
 * 2. Database data availability
 * 3. Anomaly detection functionality
 * 
 * Run with: npx tsx scripts/testAnomalyDetection.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

import { checkPythonServiceHealth, extractEmbedding, compareEmbeddings } from '../backend/anomaly/pythonClient';
import { checkVoiceAnomaly, isAnomalyServiceAvailable } from '../backend/anomaly/anomalyService';
import { getSupabaseClient } from '../backend/supabase/client';
import { logger } from '../backend/utils/logger';

async function testPythonService() {
  console.log('\n=== Testing Python Service ===\n');
  
  try {
    const isAvailable = await checkPythonServiceHealth();
    if (isAvailable) {
      console.log('✅ Python service is running and healthy');
      return true;
    } else {
      console.log('❌ Python service is not available');
      console.log('   Make sure to start it with: cd python/anomaly-service && python main.py');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Error checking Python service:', error.message);
    return false;
  }
}

async function checkDatabaseData() {
  console.log('\n=== Checking Database Data ===\n');
  
  const supabase = getSupabaseClient();
  
  // Check patients
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name')
    .limit(5);
  
  if (patientsError) {
    console.log('❌ Error fetching patients:', patientsError.message);
    return false;
  }
  
  console.log(`✅ Found ${patients?.length || 0} patients`);
  if (patients && patients.length > 0) {
    console.log('   Sample patients:');
    patients.forEach((p: any) => console.log(`   - ${p.name} (${p.id.substring(0, 8)}...)`));
  }
  
  // Check call logs with transcripts
  const { data: callLogs, error: logsError } = await supabase
    .from('call_logs')
    .select('id, patient_id, timestamp, outcome, transcript, anomaly_score')
    .not('transcript', 'is', null)
    .neq('transcript', '')
    .eq('outcome', 'answered')
    .order('timestamp', { ascending: false })
    .limit(5);
  
  if (logsError) {
    console.log('❌ Error fetching call logs:', logsError.message);
    return false;
  }
  
  console.log(`\n✅ Found ${callLogs?.length || 0} answered calls with transcripts`);
  if (callLogs && callLogs.length > 0) {
    console.log('   Recent calls:');
    callLogs.forEach((log: any) => {
      const hasAnomaly = log.anomaly_score !== null;
      console.log(`   - ${new Date(log.timestamp).toLocaleString()} - ${hasAnomaly ? '✅' : '❌'} Anomaly checked: ${hasAnomaly}`);
    });
  } else {
    console.log('   ⚠️  No call logs with transcripts found');
    console.log('   Need answered calls with transcripts to test anomaly detection');
  }
  
  // Check voice_anomaly_logs table
  const { data: anomalyLogs, error: anomalyError } = await supabase
    .from('voice_anomaly_logs')
    .select('id, patient_id, timestamp, anomaly_score, alert_type')
    .limit(5);
  
  if (anomalyError) {
    if (anomalyError.code === '42P01') {
      console.log('\n⚠️  voice_anomaly_logs table does not exist');
      console.log('   Need to run migration to create this table');
    } else {
      console.log('❌ Error fetching anomaly logs:', anomalyError.message);
    }
  } else {
    console.log(`\n✅ Found ${anomalyLogs?.length || 0} anomaly logs`);
    if (anomalyLogs && anomalyLogs.length > 0) {
      console.log('   Recent anomaly logs:');
      anomalyLogs.forEach((log: any) => {
        console.log(`   - Score: ${log.anomaly_score?.toFixed(3)}, Alert: ${log.alert_type || 'none'}`);
      });
    }
  }
  
  return true;
}

async function testEmbeddingExtraction() {
  console.log('\n=== Testing Embedding Extraction ===\n');
  
  // Use a test audio URL (you can replace this with an actual VAPI recording URL)
  const testAudioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';
  
  try {
    console.log(`Testing with audio URL: ${testAudioUrl}`);
    const result = await extractEmbedding(testAudioUrl);
    
    console.log('✅ Embedding extraction successful');
    console.log(`   Embedding length: ${result.embedding.length}`);
    console.log(`   SNR: ${result.snr.toFixed(2)} dB`);
    console.log(`   Sample rate: ${result.sample_rate} Hz`);
    
    return result;
  } catch (error: any) {
    console.log('❌ Embedding extraction failed:', error.message);
    return null;
  }
}

async function testEmbeddingComparison() {
  console.log('\n=== Testing Embedding Comparison ===\n');
  
  // Create two dummy embeddings for testing
  const baseline = Array(192).fill(0).map(() => Math.random());
  const current = Array(192).fill(0).map(() => Math.random());
  const snr = 20.0;
  const hour = new Date().getHours();
  
  try {
    console.log('Testing comparison with dummy embeddings...');
    const result = await compareEmbeddings(baseline, current, snr, hour);
    
    console.log('✅ Embedding comparison successful');
    console.log(`   Anomaly score: ${result.score.toFixed(3)}`);
    console.log(`   Raw similarity: ${result.raw_similarity.toFixed(3)}`);
    console.log(`   Normalized score: ${result.normalized.toFixed(3)}`);
    console.log(`   SNR: ${result.snr.toFixed(2)} dB`);
    
    // Interpret score
    if (result.score <= 0.25) {
      console.log('   Status: ✅ Normal (score <= 0.25)');
    } else if (result.score <= 0.40) {
      console.log('   Status: ⚠️  Warning (0.25 < score <= 0.40)');
    } else if (result.score <= 0.70) {
      console.log('   Status: 🟠 High Alert (0.40 < score <= 0.70)');
    } else {
      console.log('   Status: 🔴 Emergency (score > 0.70)');
    }
    
    return result;
  } catch (error: any) {
    console.log('❌ Embedding comparison failed:', error.message);
    return null;
  }
}

async function testFullAnomalyCheck() {
  console.log('\n=== Testing Full Anomaly Check ===\n');
  
  const supabase = getSupabaseClient();
  
  // Get a patient with call logs
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name')
    .limit(1)
    .single();
  
  if (!patients) {
    console.log('❌ No patients found in database');
    return false;
  }
  
  const patientId = patients.id;
  console.log(`Testing with patient: ${patients.name} (${patientId.substring(0, 8)}...)`);
  
  // Check if we have a call log with audio URL
  // Note: VAPI recordings would be in the call_logs or we need to simulate
  const testAudioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';
  
  try {
    console.log(`Testing anomaly check with audio URL: ${testAudioUrl}`);
    const result = await checkVoiceAnomaly(patientId, undefined, testAudioUrl);
    
    if (result.success) {
      console.log('✅ Anomaly check successful');
      console.log(`   Anomaly score: ${result.anomalyScore.toFixed(3)}`);
      console.log(`   Raw similarity: ${result.rawSimilarity.toFixed(3)}`);
      console.log(`   Normalized score: ${result.normalizedScore.toFixed(3)}`);
      console.log(`   SNR: ${result.snr.toFixed(2)} dB`);
      console.log(`   Alert type: ${result.alertType || 'none'}`);
      if (result.logId) {
        console.log(`   Log ID: ${result.logId}`);
      }
    } else {
      console.log('❌ Anomaly check failed:', result.error);
    }
    
    return result.success;
  } catch (error: any) {
    console.log('❌ Error during anomaly check:', error.message);
    return false;
  }
}

async function checkVAPIAudioUrls() {
  console.log('\n=== Checking for VAPI Audio URLs ===\n');
  
  const supabase = getSupabaseClient();
  
  // Check call logs for any audio recording URLs
  // VAPI might store these in a separate field or we need to fetch from VAPI API
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('id, patient_id, timestamp, outcome, transcript')
    .eq('outcome', 'answered')
    .not('transcript', 'is', null)
    .limit(5);
  
  if (!callLogs || callLogs.length === 0) {
    console.log('⚠️  No answered calls with transcripts found');
    console.log('   To test anomaly detection, you need:');
    console.log('   1. A call that was answered');
    console.log('   2. An audio recording URL from VAPI');
    console.log('   3. The recording URL passed to checkVoiceAnomaly()');
    return false;
  }
  
  console.log(`✅ Found ${callLogs.length} answered calls`);
  console.log('   Note: Audio URLs need to be fetched from VAPI API');
  console.log('   VAPI stores recordings separately - check VAPI dashboard for recording URLs');
  
  return true;
}

async function main() {
  console.log('🔍 RetroCare Anomaly Detection Test Suite\n');
  console.log('=' .repeat(50));
  
  const results = {
    pythonService: false,
    databaseData: false,
    embeddingExtraction: false,
    embeddingComparison: false,
    fullAnomalyCheck: false,
  };
  
  // Test 1: Python service
  results.pythonService = await testPythonService();
  
  if (!results.pythonService) {
    console.log('\n⚠️  Python service is not running. Some tests will be skipped.');
    console.log('   To start it: cd python/anomaly-service && python main.py');
  }
  
  // Test 2: Database data
  results.databaseData = await checkDatabaseData();
  
  // Test 3: Embedding extraction (requires Python service)
  if (results.pythonService) {
    const embeddingResult = await testEmbeddingExtraction();
    results.embeddingExtraction = embeddingResult !== null;
  }
  
  // Test 4: Embedding comparison (requires Python service)
  if (results.pythonService) {
    results.embeddingComparison = await testEmbeddingComparison();
  }
  
  // Test 5: Full anomaly check (requires Python service and database)
  if (results.pythonService && results.databaseData) {
    results.fullAnomalyCheck = await testFullAnomalyCheck();
  }
  
  // Test 6: Check for VAPI audio URLs
  await checkVAPIAudioUrls();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary\n');
  console.log(`Python Service:        ${results.pythonService ? '✅' : '❌'}`);
  console.log(`Database Data:         ${results.databaseData ? '✅' : '❌'}`);
  console.log(`Embedding Extraction:  ${results.embeddingExtraction ? '✅' : '❌'}`);
  console.log(`Embedding Comparison:  ${results.embeddingComparison ? '✅' : '❌'}`);
  console.log(`Full Anomaly Check:    ${results.fullAnomalyCheck ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n✅ All tests passed! Anomaly detection is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
  
  console.log('\n' + '='.repeat(50));
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

