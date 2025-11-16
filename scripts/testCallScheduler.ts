/**
 * Manual Test Script for Call Scheduler
 * 
 * This script allows you to manually test the call scheduler with real database queries.
 * It simulates different times and checks which patients would be called.
 * 
 * Usage: tsx scripts/testCallScheduler.ts [time] [timezone]
 * Example: tsx scripts/testCallScheduler.ts "2024-01-15T09:00:00Z" "UTC"
 */

import dotenv from 'dotenv';
import path from 'path';
import { getSupabaseClient } from '../backend/supabase/client';
import { shouldCallNow, getLocalHour } from '../backend/scheduler/timeUtils';
import { getPatientsDueForCalls } from '../backend/scheduler/callScheduler';
import type { Patient } from '../backend/supabase/types';

// Load environment variables
const envPath = path.join(__dirname, '..', 'backend', '.env');
dotenv.config({ path: envPath });

async function testScheduler(testTime?: string, testTimezone?: string) {
  console.log('🧪 Call Scheduler Test Suite\n');
  console.log('='.repeat(60));
  
  // Override Date if test time provided
  const OriginalDate = Date;
  let dateOverride: Date | null = null;
  
  if (testTime) {
    dateOverride = new Date(testTime);
    // Override Date constructor and static methods
    (global as any).Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0 && dateOverride) {
          super(dateOverride);
        } else {
          super(...args);
        }
      }
      static now() {
        return dateOverride ? dateOverride.getTime() : OriginalDate.now();
      }
    } as any;
    // Copy static methods
    Object.setPrototypeOf((global as any).Date, OriginalDate);
    Object.getOwnPropertyNames(OriginalDate).forEach(name => {
      if (name !== 'prototype' && name !== 'length' && name !== 'name') {
        (global as any).Date[name] = (OriginalDate as any)[name];
      }
    });
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Test 1: Get all patients with schedules
    console.log('\n📋 Test 1: Fetching all patients with call schedules...');
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .not('call_schedule', 'eq', '[]');
    
    if (error) {
      console.error('❌ Error fetching patients:', error);
      return;
    }
    
    console.log(`✅ Found ${patients?.length || 0} patients with schedules\n`);
    
    if (!patients || patients.length === 0) {
      console.log('⚠️  No patients found. Please add patients with call schedules to test.');
      return;
    }
    
    // Test 2: Test time matching for each patient
    console.log('📋 Test 2: Testing time matching for each patient...\n');
    
    const now = testTime ? new Date(testTime) : new Date();
    const testTz = testTimezone || 'UTC';
    
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Test timezone: ${testTz}`);
    console.log(`Local hour in ${testTz}: ${getLocalHour(testTz, now)}\n`);
  
  patients.forEach((patient: Patient) => {
    const schedule = Array.isArray(patient.call_schedule) ? patient.call_schedule : [];
    const shouldCall = shouldCallNow(schedule, patient.timezone, now);
    const localHour = getLocalHour(patient.timezone, now);
    
    console.log(`Patient: ${patient.name}`);
    console.log(`  ID: ${patient.id}`);
    console.log(`  Timezone: ${patient.timezone}`);
    console.log(`  Schedule: ${schedule.join(', ') || 'None'}`);
    console.log(`  Local hour: ${localHour}`);
    console.log(`  Should call now: ${shouldCall ? '✅ YES' : '❌ NO'}`);
    
    if (patient.last_call_at) {
      const lastCall = new Date(patient.last_call_at);
      const hoursAgo = (now.getTime() - lastCall.getTime()) / (1000 * 60 * 60);
      console.log(`  Last call: ${lastCall.toISOString()} (${hoursAgo.toFixed(2)} hours ago)`);
      
      if (hoursAgo < 1 && shouldCall) {
        console.log(`  ⚠️  Would be skipped (called within last hour)`);
      }
    } else {
      console.log(`  Last call: Never`);
    }
    console.log('');
  });
  
    // Test 3: Get patients actually due for calls
    console.log('📋 Test 3: Getting patients due for calls (with duplicate prevention)...\n');
    
    const duePatients = await getPatientsDueForCalls();
    
    console.log(`✅ Found ${duePatients.length} patients due for calls:\n`);
    
    if (duePatients.length === 0) {
      console.log('  No patients are due for calls at this time.');
    } else {
      duePatients.forEach((patient) => {
        console.log(`  - ${patient.name} (${patient.id})`);
        console.log(`    Phone: ${patient.phone}`);
        console.log(`    Schedule: ${patient.call_schedule.join(', ')}`);
        console.log(`    Timezone: ${patient.timezone}`);
        console.log('');
      });
    }
    // Test 4: Test various time scenarios
    console.log('📋 Test 4: Testing various time scenarios...\n');
    
    const testScenarios = [
      { time: '2024-01-15T09:00:00Z', desc: '9 AM UTC' },
      { time: '2024-01-15T14:00:00Z', desc: '2 PM UTC' },
      { time: '2024-01-15T00:00:00Z', desc: 'Midnight UTC' },
      { time: '2024-01-15T23:00:00Z', desc: '11 PM UTC' },
    ];
    
    testScenarios.forEach(({ time, desc }) => {
      console.log(`Scenario: ${desc} (${time})`);
      const scenarioDate = new Date(time);
      patients.slice(0, 3).forEach((patient: Patient) => {
        const schedule = Array.isArray(patient.call_schedule) ? patient.call_schedule : [];
        const localHour = getLocalHour(patient.timezone, scenarioDate);
        const shouldCall = schedule.includes(localHour);
        
        console.log(`  ${patient.name}: Local ${localHour}, Schedule ${schedule.join(', ')}, Should call: ${shouldCall ? '✅' : '❌'}`);
      });
      console.log('');
    });
    
    console.log('='.repeat(60));
    console.log('✅ Test suite completed!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Restore original Date
    if (testTime) {
      (global as any).Date = OriginalDate;
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const testTime = process.argv[2];
  const testTimezone = process.argv[3];
  
  testScheduler(testTime, testTimezone).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

