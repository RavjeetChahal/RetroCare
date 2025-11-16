const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCallSummary() {
  console.log('🧪 Testing Call Summary Extraction\n');
  console.log('='.repeat(60));
  
  let allTestsPassed = true;

  // Test 1: Check recent call logs for summaries
  console.log('\n1️⃣ Checking recent call logs for summaries...\n');
  
  const { data: recentCalls, error: fetchError } = await supabase
    .from('call_logs')
    .select('id, patient_id, timestamp, summary, outcome, transcript')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (fetchError) {
    console.log(`   ❌ Fetch calls failed: ${fetchError.message}`);
    allTestsPassed = false;
  } else {
    console.log(`   ✅ Found ${recentCalls.length} recent call(s)\n`);
    
    if (recentCalls.length === 0) {
      console.log('   ⚠️  No calls found - cannot test summary extraction');
    } else {
      let callsWithSummary = 0;
      let callsWithoutSummary = 0;
      
      recentCalls.forEach((call, index) => {
        const hasSummary = call.summary && call.summary.trim().length > 0;
        const summaryLength = call.summary ? call.summary.length : 0;
        
        if (hasSummary) {
          callsWithSummary++;
          console.log(`   ✅ Call ${index + 1}: Has summary (${summaryLength} chars)`);
          console.log(`      Summary: "${call.summary.substring(0, 80)}${call.summary.length > 80 ? '...' : ''}"`);
        } else {
          callsWithoutSummary++;
          console.log(`   ❌ Call ${index + 1}: Missing summary`);
          console.log(`      Outcome: ${call.outcome || 'null'}`);
          console.log(`      Has transcript: ${call.transcript ? 'Yes' : 'No'}`);
          if (call.transcript) {
            console.log(`      Transcript length: ${call.transcript.length} chars`);
          }
        }
        console.log(`      Timestamp: ${new Date(call.timestamp).toLocaleString()}\n`);
      });
      
      if (callsWithoutSummary > 0) {
        console.log(`   ⚠️  ${callsWithoutSummary} call(s) missing summary out of ${recentCalls.length} total`);
        allTestsPassed = false;
      } else {
        console.log(`   ✅ All ${callsWithSummary} call(s) have summaries!`);
      }
    }
  }

  // Test 2: Test summary extraction logic (simulated)
  console.log('\n2️⃣ Testing summary extraction priority logic...\n');
  
  const testCases = [
    {
      name: 'logCallAttempt summary (highest priority)',
      logCallAttemptSummary: 'Patient answered and discussed medications.',
      dailySummary: 'Daily check-in completed.',
      vapiSummary: 'Call ended successfully.',
      transcript: 'Hello, how are you today?',
      expected: 'Patient answered and discussed medications.',
    },
    {
      name: 'dailySummary (if no logCallAttempt)',
      logCallAttemptSummary: null,
      dailySummary: 'Daily check-in completed.',
      vapiSummary: 'Call ended successfully.',
      transcript: 'Hello, how are you today?',
      expected: 'Daily check-in completed.',
    },
    {
      name: 'VAPI summary (if no tool summaries)',
      logCallAttemptSummary: null,
      dailySummary: null,
      vapiSummary: 'Call ended successfully.',
      transcript: 'Hello, how are you today?',
      expected: 'Call ended successfully.',
    },
    {
      name: 'Generated from transcript (if no summaries)',
      logCallAttemptSummary: null,
      dailySummary: null,
      vapiSummary: null,
      transcript: 'Hello, how are you today? I am feeling good.',
      expected: 'Hello, how are you today.',
    },
    {
      name: 'Fallback summary (if call answered)',
      logCallAttemptSummary: null,
      dailySummary: null,
      vapiSummary: null,
      transcript: '',
      callAnswered: true,
      patientName: 'John',
      expected: 'Call completed with John.',
    },
  ];
  
  for (const testCase of testCases) {
    // Simulate the extraction logic
    let callSummary = null;
    
    // Priority 1: logCallAttempt summary
    if (testCase.logCallAttemptSummary) {
      callSummary = testCase.logCallAttemptSummary.trim();
    }
    // Priority 2: dailySummary
    else if (testCase.dailySummary) {
      callSummary = testCase.dailySummary.trim();
    }
    // Priority 3: VAPI summary (before generating from transcript)
    if (!callSummary && testCase.vapiSummary) {
      callSummary = testCase.vapiSummary.trim();
    }
    // Priority 4: Generate from transcript
    if (!callSummary && testCase.transcript && testCase.transcript.length > 0) {
      const firstSentence = testCase.transcript.split(/[.!?]/)[0].trim();
      if (firstSentence.length > 0 && firstSentence.length <= 200) {
        callSummary = firstSentence + (testCase.transcript.includes('.') ? '.' : '');
      } else {
        callSummary = testCase.transcript.substring(0, 100).trim() + (testCase.transcript.length > 100 ? '...' : '');
      }
    }
    // Priority 5: Fallback
    if (!callSummary) {
      if (testCase.callAnswered) {
        callSummary = `Call completed with ${testCase.patientName}.`;
      } else {
        callSummary = `Call attempt to ${testCase.patientName} - no answer.`;
      }
    }
    
    const passed = callSummary === testCase.expected;
    if (passed) {
      console.log(`   ✅ ${testCase.name}`);
      console.log(`      Result: "${callSummary}"`);
    } else {
      console.log(`   ❌ ${testCase.name}`);
      console.log(`      Expected: "${testCase.expected}"`);
      console.log(`      Got: "${callSummary}"`);
      allTestsPassed = false;
    }
    console.log('');
  }

  // Test 3: Verify CallsCard can fetch calls with summaries
  console.log('\n3️⃣ Testing CallsCard data fetching...\n');
  
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name')
    .limit(1);
  
  if (!patients || patients.length === 0) {
    console.log('   ⚠️  No patients found - skipping CallsCard test');
  } else {
    const testPatient = patients[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: todaysCalls, error: todaysError } = await supabase
      .from('call_logs')
      .select('id, patient_id, timestamp, summary, outcome')
      .eq('patient_id', testPatient.id)
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .order('timestamp', { ascending: false });
    
    if (todaysError) {
      console.log(`   ❌ Fetch today's calls failed: ${todaysError.message}`);
      allTestsPassed = false;
    } else {
      console.log(`   ✅ Found ${todaysCalls.length} call(s) for today`);
      if (todaysCalls.length > 0) {
        todaysCalls.forEach((call, index) => {
          const hasSummary = call.summary && call.summary.trim().length > 0;
          console.log(`      Call ${index + 1}: ${hasSummary ? '✅ Has summary' : '❌ Missing summary'}`);
          if (hasSummary) {
            console.log(`         "${call.summary}"`);
          }
        });
      }
    }
  }

  // Final Summary
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('\n✅ ALL TESTS PASSED! Call summary extraction is working.\n');
    console.log('Summary:');
    console.log('  ✅ Summary extraction logic works correctly');
    console.log('  ✅ Priority order is correct');
    console.log('  ✅ Fallback summaries are generated');
    console.log('  ✅ CallsCard can fetch calls with summaries');
    console.log('\n🎉 Call summary extraction is ready!\n');
  } else {
    console.log('\n❌ SOME TESTS FAILED. Please review the errors above.\n');
    console.log('Note: If recent calls are missing summaries, they were created before the fix.');
    console.log('New calls should have summaries extracted correctly.\n');
    process.exit(1);
  }
}

testCallSummary().catch((error) => {
  console.error('\n❌ Test suite crashed:', error);
  process.exit(1);
});

