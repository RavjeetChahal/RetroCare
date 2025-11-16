/**
 * Backfill Medication Data
 * 
 * This script backfills medication data for calls where the assistant
 * said "all medications taken" but didn't call the markMedicationStatus tool
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

import { getSupabaseClient } from '../backend/supabase/client';
import { logger } from '../backend/utils/logger';

async function backfillMedicationData() {
  logger.info('🔄 Starting medication data backfill...');
  
  const supabase = getSupabaseClient();
  
  // Get all call logs where meds_taken is empty but summary mentions medications
  const { data: callLogs, error: callLogsError } = await supabase
    .from('call_logs')
    .select('id, patient_id, timestamp, summary, meds_taken')
    .eq('outcome', 'answered')
    .order('timestamp', { ascending: false })
    .limit(50);
  
  if (callLogsError) {
    logger.error('❌ Failed to fetch call logs:', callLogsError);
    process.exit(1);
  }
  
  logger.info(`📋 Found ${callLogs?.length || 0} call logs to process`);
  
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const log of callLogs || []) {
    // Skip if already has meds_taken data
    if (log.meds_taken && Array.isArray(log.meds_taken) && log.meds_taken.length > 0) {
      skippedCount++;
      continue;
    }
    
    // Get patient medications
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('meds')
      .eq('id', log.patient_id)
      .single();
    
    if (patientError || !patient || !patient.meds || !Array.isArray(patient.meds)) {
      logger.warn(`⚠️ No medications found for patient ${log.patient_id}`);
      continue;
    }
    
    const summary = (log.summary || '').toLowerCase();
    
    // Check if summary mentions "all medications" or "taking medications"
    const mentionsAllMeds = 
      summary.includes('all medications') ||
      summary.includes('taking medications as prescribed') ||
      summary.includes('took all medications') ||
      summary.includes('taken all medications');
    
    if (!mentionsAllMeds) {
      // Skip if summary doesn't mention medications
      continue;
    }
    
    logger.info(`💊 Processing call ${log.id} for patient ${log.patient_id}`);
    logger.info(`   Summary: "${log.summary}"`);
    
    // Create med_logs entries for each medication (marking all as taken)
    const medLogs = patient.meds.map((medName: string) => ({
      patient_id: log.patient_id,
      med_name: medName,
      taken: true,
      taken_at: log.timestamp,
      timestamp: log.timestamp,
    }));
    
    // Check if logs already exist for this day
    const callDate = new Date(log.timestamp);
    callDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(callDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    for (const medLog of medLogs) {
      const { data: existing } = await supabase
        .from('med_logs')
        .select('id')
        .eq('patient_id', log.patient_id)
        .eq('med_name', medLog.med_name)
        .gte('timestamp', callDate.toISOString())
        .lt('timestamp', nextDate.toISOString())
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('med_logs')
          .update(medLog)
          .eq('id', existing.id);
        
        if (updateError) {
          logger.error(`❌ Failed to update med_log for ${medLog.med_name}:`, updateError);
        } else {
          logger.info(`✅ Updated med_log for ${medLog.med_name}`);
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('med_logs')
          .insert(medLog);
        
        if (insertError) {
          logger.error(`❌ Failed to insert med_log for ${medLog.med_name}:`, insertError);
        } else {
          logger.info(`✅ Inserted med_log for ${medLog.med_name}`);
        }
      }
    }
    
    // Update call_logs.meds_taken
    const medsTaken = patient.meds.map((medName: string) => ({
      medName,
      taken: true,
      timestamp: log.timestamp,
    }));
    
    const { error: updateError } = await supabase
      .from('call_logs')
      .update({ meds_taken: medsTaken })
      .eq('id', log.id);
    
    if (updateError) {
      logger.error(`❌ Failed to update call_logs.meds_taken:`, updateError);
    } else {
      logger.info(`✅ Updated call_logs.meds_taken for call ${log.id}`);
      processedCount++;
    }
  }
  
  logger.info('🎉 Backfill complete!');
  logger.info(`✅ Processed: ${processedCount} calls`);
  logger.info(`⏭️  Skipped: ${skippedCount} calls (already had data)`);
  
  process.exit(0);
}

// Run backfill
backfillMedicationData().catch((error) => {
  logger.error('❌ Backfill script failed:', error);
  process.exit(1);
});

