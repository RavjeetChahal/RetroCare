/**
 * VAPI Tool: storeDailyCheckIn
 * 
 * Stores or updates daily check-in information
 */

import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../supabase/client';
import type { ToolContext } from './index';
import type { DailyCheckIn } from '../../supabase/types';

export async function storeDailyCheckIn(
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const {
      sleepHours,
      sleep_hours,
      sleepQuality,
      sleep_quality,
      summary,
      flags,
      mood,
    } = parameters;
    
    // Handle both camelCase and snake_case parameter names
    const sleepHoursValue = sleepHours || sleep_hours;
    const sleepQualityValue = sleepQuality || sleep_quality;
    
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Check if daily check-in already exists
    const { data: existing } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('patient_id', context.patientId)
      .eq('date', today)
      .single();
    
    const checkInData: Partial<DailyCheckIn> = {
      patient_id: context.patientId,
      date: today,
      sleep_hours: sleepHoursValue ? Number(sleepHoursValue) : null,
      sleep_quality: sleepQualityValue as string || null,
      summary: summary as string || null,
      flags: (flags as unknown[]) || [],
      mood: mood as 'good' | 'neutral' | 'bad' | null || null,
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
        patientId: context.patientId,
        date: today,
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
        patientId: context.patientId,
        date: today,
      });
    }
    
    return { success: true, result: { message: 'Daily check-in stored' } };
  } catch (error: any) {
    logger.error('Error storing daily check-in', {
      error: error.message,
      patientId: context.patientId,
    });
    return { success: false, error: error.message };
  }
}

