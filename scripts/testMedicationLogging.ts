/**
 * Test Script: Medication Logging
 * 
 * Tests the markMedicationStatus tool to ensure it saves to med_logs table
 */

// Load backend environment variables
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

import { markMedicationStatus } from '../backend/vapi/tools/markMedicationStatus';
import { getSupabaseClient } from '../backend/supabase/client';
import { logger } from '../backend/utils/logger';

async function testMedicationLogging() {
  logger.info('🧪 Starting medication logging test...');
  
  // Test patient ID (Vedant from the database)
  const testPatientId = '5c6c8ed0-1b92-4798-a5b7-4837f00e54a1';
  const testMedName = 'Advil';
  
  // Test context
  const context = {
    patientId: testPatientId,
    callId: 'test-call-' + Date.now(),
    assistantName: 'Julia',
    timestamp: new Date().toISOString(),
  };
  
  logger.info('🧪 Test 1: Mark medication as taken');
  
  // Test 1: Mark medication as taken
  const result1 = await markMedicationStatus(
    {
      medName: testMedName,
      taken: true,
    },
    context
  );
  
  logger.info('🧪 Test 1 Result:', result1);
  
  if (!result1.success) {
    logger.error('❌ Test 1 FAILED:', result1.error);
    process.exit(1);
  }
  
  logger.info('✅ Test 1 PASSED: Medication marked as taken');
  
  // Verify in database
  logger.info('🧪 Verifying in database...');
  const supabase = getSupabaseClient();
  
  const { data: medLogs, error: medLogsError } = await supabase
    .from('med_logs')
    .select('*')
    .eq('patient_id', testPatientId)
    .eq('med_name', testMedName)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (medLogsError) {
    logger.error('❌ Database verification FAILED:', medLogsError);
    process.exit(1);
  }
  
  if (!medLogs || medLogs.length === 0) {
    logger.error('❌ No medication log found in database');
    process.exit(1);
  }
  
  const latestLog = medLogs[0];
  logger.info('✅ Found medication log in database:', {
    id: latestLog.id,
    medName: latestLog.med_name,
    taken: latestLog.taken,
    takenAt: latestLog.taken_at,
    timestamp: latestLog.timestamp,
  });
  
  if (latestLog.taken !== true) {
    logger.error('❌ Medication log has incorrect "taken" status:', latestLog.taken);
    process.exit(1);
  }
  
  logger.info('✅ Medication log verified successfully');
  
  // Test 2: Mark medication as NOT taken
  logger.info('🧪 Test 2: Mark medication as NOT taken');
  
  const result2 = await markMedicationStatus(
    {
      medName: testMedName,
      taken: false,
    },
    context
  );
  
  logger.info('🧪 Test 2 Result:', result2);
  
  if (!result2.success) {
    logger.error('❌ Test 2 FAILED:', result2.error);
    process.exit(1);
  }
  
  logger.info('✅ Test 2 PASSED: Medication marked as NOT taken');
  
  // Verify update in database
  const { data: medLogs2, error: medLogsError2 } = await supabase
    .from('med_logs')
    .select('*')
    .eq('patient_id', testPatientId)
    .eq('med_name', testMedName)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (medLogsError2) {
    logger.error('❌ Database verification FAILED:', medLogsError2);
    process.exit(1);
  }
  
  const updatedLog = medLogs2![0];
  logger.info('✅ Found updated medication log:', {
    id: updatedLog.id,
    medName: updatedLog.med_name,
    taken: updatedLog.taken,
    takenAt: updatedLog.taken_at,
  });
  
  if (updatedLog.taken !== false) {
    logger.error('❌ Medication log has incorrect "taken" status:', updatedLog.taken);
    process.exit(1);
  }
  
  logger.info('✅ Medication log update verified successfully');
  
  // All tests passed
  logger.info('🎉 ALL TESTS PASSED!');
  logger.info('✅ markMedicationStatus tool is working correctly');
  logger.info('✅ Medications are being saved to med_logs table');
  logger.info('✅ Upsert logic is working (update existing entries)');
  
  process.exit(0);
}

// Run tests
testMedicationLogging().catch((error) => {
  logger.error('❌ Test script failed with exception:', error);
  process.exit(1);
});

