/**
 * Daily Check-In Aggregator
 * 
 * Aggregates call data into daily check-ins
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../supabase/client';
import { getDailyMood } from '../sentiment';
import type { DailyCheckIn } from '../supabase/types';

export interface DailyCheckInData {
  mood: 'good' | 'neutral' | 'bad' | null;
  sleepHours: number | null;
  sleepQuality: string | null;
  medsTaken: Array<{ medName: string; taken: boolean; timestamp: string }>;
  flags: string[];
  summary: string | null;
}

/**
 * Aggregate or update daily check-in from call data
 * Idempotent - safe to run multiple times
 */
export async function aggregateDailyCheckIn(
  patientId: string,
  callLogId: string,
  callData: DailyCheckInData
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Get all answered calls for today
    const { data: todayCalls } = await supabase
      .from('call_logs')
      .select('mood, timestamp, outcome, meds_taken, flags, summary, sleep_hours, sleep_quality')
      .eq('patient_id', patientId)
      .eq('outcome', 'answered')
      .gte('timestamp', `${today}T00:00:00`)
      .lt('timestamp', `${today}T23:59:59`);
    
    // Compute daily mood (most recent answered call's mood, or neutral)
    const dailyMood = getDailyMood(
      new Date(today),
      (todayCalls || []).map(c => ({
        mood: c.mood,
        timestamp: c.timestamp,
        outcome: c.outcome,
      }))
    );
    
    // Aggregate meds taken from all calls today
    const allMedsTaken: Array<{ medName: string; taken: boolean; timestamp: string }> = [];
    (todayCalls || []).forEach(call => {
      if (Array.isArray(call.meds_taken)) {
        allMedsTaken.push(...call.meds_taken);
      }
    });
    
    // Aggregate flags from all calls today
    const allFlags = new Set<string>();
    (todayCalls || []).forEach(call => {
      if (Array.isArray(call.flags)) {
        call.flags.forEach(flag => allFlags.add(String(flag)));
      }
    });
    
    // Use most recent sleep data
    let latestSleepHours: number | null = null;
    let latestSleepQuality: string | null = null;
    (todayCalls || []).forEach(call => {
      if (call.sleep_hours !== null) {
        latestSleepHours = call.sleep_hours;
      }
      if (call.sleep_quality) {
        latestSleepQuality = call.sleep_quality;
      }
    });
    
    // Use most recent summary
    let latestSummary: string | null = null;
    (todayCalls || []).forEach(call => {
      if (call.summary) {
        latestSummary = call.summary;
      }
    });
    
    // Check if daily check-in exists
    const { data: existing } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('patient_id', patientId)
      .eq('date', today)
      .single();
    
    const checkInData: Partial<DailyCheckIn> = {
      patient_id: patientId,
      date: today,
      mood: dailyMood,
      sleep_hours: latestSleepHours || callData.sleepHours,
      sleep_quality: (latestSleepQuality || callData.sleepQuality) as DailyCheckIn['sleep_quality'],
      meds_taken: allMedsTaken.length > 0 ? allMedsTaken : callData.medsTaken,
      flags: Array.from(allFlags).length > 0 ? Array.from(allFlags) : callData.flags,
      summary: latestSummary || callData.summary,
      updated_at: new Date().toISOString(),
    };
    
    if (existing) {
      // Update existing check-in
      const { error } = await supabase
        .from('daily_checkins')
        .update(checkInData)
        .eq('id', existing.id);
      
      if (error) throw error;
      
      logger.info('Updated daily check-in', {
        patientId,
        date: today,
        mood: dailyMood,
      });
    } else {
      // Create new check-in
      const { error } = await supabase
        .from('daily_checkins')
        .insert({
          ...checkInData,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      logger.info('Created daily check-in', {
        patientId,
        date: today,
        mood: dailyMood,
      });
    }
  } catch (error: any) {
    logger.error('Error aggregating daily check-in', {
      error: error.message,
      patientId,
      callLogId,
    });
    throw error;
  }
}

