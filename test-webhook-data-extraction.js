const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWebhookDataExtraction() {
  console.log('🧪 Testing Webhook Data Extraction\n');
  console.log('='.repeat(60));
  
  const patientName = 'god';
  const patientId = '82760e9d-75bc-4239-947b-e1d61d680a0f';
  
  console.log(`\n📊 Current Database State for Patient "${patientName}"\n`);
  
  // Get current counts
  const tables = [
    { name: 'call_logs', query: supabase.from('call_logs').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
    { name: 'mood_logs', query: supabase.from('mood_logs').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
    { name: 'med_logs', query: supabase.from('med_logs').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
    { name: 'flags', query: supabase.from('flags').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
    { name: 'sleep_logs', query: supabase.from('sleep_logs').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
    { name: 'daily_checkins', query: supabase.from('daily_checkins').select('id', { count: 'exact', head: true }).eq('patient_id', patientId) },
  ];
  
  const beforeCounts = {};
  
  for (const table of tables) {
    const { count, error } = await table.query;
    if (error) {
      console.log(`   ❌ ${table.name}: Error - ${error.message}`);
      beforeCounts[table.name] = -1;
    } else {
      beforeCounts[table.name] = count || 0;
      console.log(`   ${table.name}: ${count || 0} record(s)`);
    }
  }
  
  // Get most recent call log if any
  const { data: recentCallLog } = await supabase
    .from('call_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (recentCallLog) {
    console.log(`\n📞 Most Recent Call Log:`);
    console.log(`   ID: ${recentCallLog.id}`);
    console.log(`   Timestamp: ${new Date(recentCallLog.timestamp).toLocaleString()}`);
    console.log(`   Outcome: ${recentCallLog.outcome || 'null'}`);
    console.log(`   Summary: ${recentCallLog.summary || 'null'}`);
    console.log(`   Mood: ${recentCallLog.mood || 'null'}`);
    console.log(`   Sleep Hours: ${recentCallLog.sleep_hours || 'null'}`);
    console.log(`   Sleep Quality: ${recentCallLog.sleep_quality || 'null'}`);
    console.log(`   Medications: ${recentCallLog.meds_taken ? JSON.stringify(recentCallLog.meds_taken) : 'null'}`);
    console.log(`   Flags: ${recentCallLog.flags ? JSON.stringify(recentCallLog.flags) : 'null'}`);
    console.log(`   Has Transcript: ${recentCallLog.transcript ? 'Yes (' + recentCallLog.transcript.length + ' chars)' : 'No'}`);
  } else {
    console.log(`\n⚠️  No call logs found for this patient`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Summary:\n');
  console.log('BEFORE CALL STATE:');
  Object.entries(beforeCounts).forEach(([table, count]) => {
    const status = count > 0 ? '✅' : '❌';
    console.log(`   ${status} ${table}: ${count} record(s)`);
  });
  
  console.log('\n🔍 Analysis:');
  
  if (beforeCounts['call_logs'] === 0) {
    console.log('   ❌ NO CALL LOGS - Webhook is not creating call_logs entries');
    console.log('      → Check if webhook is being called');
    console.log('      → Check if patient lookup is working');
    console.log('      → Check webhook logs for errors');
  } else {
    console.log('   ✅ Call logs exist - webhook is being called');
    
    if (recentCallLog) {
      if (!recentCallLog.summary) {
        console.log('   ❌ Call log missing summary - summary extraction not working');
      } else {
        console.log('   ✅ Call log has summary');
      }
      
      if (!recentCallLog.mood) {
        console.log('   ❌ Call log missing mood - mood extraction not working');
      } else {
        console.log('   ✅ Call log has mood');
      }
      
      if (beforeCounts['mood_logs'] === 0 && recentCallLog.mood) {
        console.log('   ❌ Mood exists in call_logs but NOT in mood_logs table');
        console.log('      → Individual table saving is not working');
      }
      
      if (beforeCounts['med_logs'] === 0 && recentCallLog.meds_taken && Array.isArray(recentCallLog.meds_taken) && recentCallLog.meds_taken.length > 0) {
        console.log('   ❌ Medications exist in call_logs but NOT in med_logs table');
        console.log('      → Individual table saving is not working');
      }
      
      if (beforeCounts['flags'] === 0 && recentCallLog.flags && Array.isArray(recentCallLog.flags) && recentCallLog.flags.length > 0) {
        console.log('   ❌ Flags exist in call_logs but NOT in flags table');
        console.log('      → Individual table saving is not working');
      }
      
      if (beforeCounts['sleep_logs'] === 0 && recentCallLog.sleep_hours) {
        console.log('   ❌ Sleep hours exist in call_logs but NOT in sleep_logs table');
        console.log('      → Individual table saving is not working');
      }
    }
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Make a new call');
  console.log('   2. Wait for webhook to process (usually 1-5 seconds)');
  console.log('   3. Run this test again to see AFTER state');
  console.log('   4. Check backend logs for webhook processing details');
  console.log('\n');
}

testWebhookDataExtraction().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});

