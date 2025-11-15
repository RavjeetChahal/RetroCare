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
      sleepQuality,
      summary,
      flags,
    } = parameters;
    
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
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      sleep_quality: sleepQuality as string || null,
      summary: summary as string || null,
      flags: (flags as unknown[]) || [],
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

