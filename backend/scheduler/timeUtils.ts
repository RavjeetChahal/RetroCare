/**
 * Timezone-aware time utilities for scheduling
 */

/**
 * Convert UTC time to patient's local timezone and extract hour
 * Returns hour in format "HH:00" (e.g., "09:00", "14:00")
 */
export function getLocalHour(timezone: string): string {
  const now = new Date();
  
  // Convert to patient's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  
  return `${hour.padStart(2, '0')}:00`;
}

/**
 * Check if current local hour matches any time slot in schedule
 * Time slots are in format "HH:00" (e.g., "09:00", "14:00")
 */
export function isScheduledHour(timeSlot: string, timezone: string): boolean {
  const currentHour = getLocalHour(timezone);
  return timeSlot === currentHour;
}

/**
 * Parse time slot and validate format
 * Accepts "HH:00" format
 */
export function parseTimeSlot(timeSlot: string): { hour: number; minute: number } | null {
  const match = timeSlot.match(/^(\d{1,2}):00$/);
  if (!match) return null;
  
  const hour = parseInt(match[1], 10);
  
  if (hour < 0 || hour > 23) {
    return null;
  }
  
  return { hour, minute: 0 };
}

/**
 * Check if we should call a patient now based on their schedule and timezone
 */
export function shouldCallNow(callSchedule: string[], timezone: string): boolean {
  if (!callSchedule || callSchedule.length === 0) {
    return false;
  }
  
  const currentHour = getLocalHour(timezone);
  
  return callSchedule.includes(currentHour);
}

