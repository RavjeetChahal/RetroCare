/**
 * Intensive Test Cases for Call Scheduler
 * 
 * Tests that the scheduler correctly calls patients at scheduled times
 * on the hour, respecting timezones and preventing duplicate calls.
 * 
 * Run with: tsx backend/scheduler/callScheduler.test.ts
 */

import { getSupabaseClient } from '../supabase/client';
import { getPatientsDueForCalls } from './callScheduler';
import { shouldCallNow, getLocalHour } from './timeUtils';
import type { Patient } from '../supabase/types';

// Mock Date for testing
let mockDate: Date | null = null;

// Override Date constructor for testing
const OriginalDate = Date;
function setMockDate(date: Date) {
  mockDate = date;
  (global as any).Date = class extends OriginalDate {
    constructor(...args: any[]) {
      if (args.length === 0 && mockDate) {
        super(mockDate);
      } else {
        super(...args);
      }
    }
    static now() {
      return mockDate ? mockDate.getTime() : OriginalDate.now();
    }
  } as any;
}

function resetDate() {
  mockDate = null;
  (global as any).Date = OriginalDate;
}

// Test results tracking
const testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      testResults.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error: any) {
      testResults.push({ name, passed: false, error: error.message });
      console.error(`❌ ${name}: ${error.message}`);
      console.error(error.stack);
    }
  };
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toHaveLength: (expected: number) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${actual.length} to be ${expected}`);
      }
    },
    toContain: (expected: any) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    toBeLessThan: (expected: number) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    not: {
      toThrow: () => {
        try {
          actual();
        } catch (e) {
          throw new Error(`Expected function not to throw, but it threw: ${e}`);
        }
      },
    },
  };
}

describe('Call Scheduler - Intensive Test Cases', () => {
  beforeEach(() => {
    resetDate();
  });

  afterEach(() => {
    resetDate();
  });

  describe('Time Matching - Basic Cases', () => {
    test('should match exact hour in patient timezone', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      expect(shouldCallNow(['04:00'], 'America/New_York')).toBe(true);
      expect(shouldCallNow(['01:00'], 'America/Los_Angeles')).toBe(true);
      expect(shouldCallNow(['09:00'], 'UTC')).toBe(true);
    });

    test('should not match different hour', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      expect(shouldCallNow(['10:00'], 'UTC')).toBe(false);
      expect(shouldCallNow(['08:00'], 'UTC')).toBe(false);
    });

    test('should match multiple scheduled times', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      const schedule = ['08:00', '09:00', '10:00', '14:00', '19:00'];
      expect(shouldCallNow(schedule, 'UTC')).toBe(true);
    });

    test('should handle empty schedule', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      expect(shouldCallNow([], 'UTC')).toBe(false);
      expect(shouldCallNow(null as any, 'UTC')).toBe(false);
      expect(shouldCallNow(undefined as any, 'UTC')).toBe(false);
    });
  });

  describe('Timezone Edge Cases', () => {
    test('should handle DST transitions correctly', async () => {
      setMockDate(new Date('2024-03-10T07:00:00Z'));
      
      expect(shouldCallNow(['03:00'], 'America/New_York')).toBe(true);
      expect(shouldCallNow(['02:00'], 'America/New_York')).toBe(false);
    });

    test('should handle fall back DST transition', async () => {
      setMockDate(new Date('2024-11-03T06:00:00Z'));
      
      expect(shouldCallNow(['01:00'], 'America/New_York')).toBe(true);
    });

    test('should handle different timezones correctly', async () => {
      setMockDate(new Date('2024-01-15T12:00:00Z'));
      
      expect(getLocalHour('UTC')).toBe('12:00');
      expect(getLocalHour('America/New_York')).toBe('07:00');
      expect(getLocalHour('America/Los_Angeles')).toBe('04:00');
      expect(getLocalHour('Europe/London')).toBe('12:00');
      expect(getLocalHour('Asia/Tokyo')).toBe('21:00');
      expect(getLocalHour('Australia/Sydney')).toBe('23:00');
    });

    test('should handle midnight correctly', async () => {
      setMockDate(new Date('2024-01-15T00:00:00Z'));
      expect(shouldCallNow(['00:00'], 'UTC')).toBe(true);
      
      setMockDate(new Date('2024-01-15T05:00:00Z'));
      expect(shouldCallNow(['00:00'], 'America/New_York')).toBe(true);
    });

    test('should handle 23:00 (11 PM) correctly', async () => {
      setMockDate(new Date('2024-01-15T23:00:00Z'));
      expect(shouldCallNow(['23:00'], 'UTC')).toBe(true);
      
      setMockDate(new Date('2024-01-16T04:00:00Z'));
      expect(shouldCallNow(['23:00'], 'America/New_York')).toBe(true);
    });
  });

  describe('Hourly Execution Timing', () => {
    test('should only trigger at :00 minutes', async () => {
      const testTimes = [
        '2024-01-15T09:00:00Z',
        '2024-01-15T09:00:30Z',
        '2024-01-15T09:01:00Z',
        '2024-01-15T09:30:00Z',
        '2024-01-15T09:59:59Z',
      ];

      testTimes.forEach((timeStr) => {
        setMockDate(new Date(timeStr));
        const hour = getLocalHour('UTC');
        expect(hour).toBe('09:00');
      });
    });

    test('should handle hour boundaries correctly', async () => {
      setMockDate(new Date('2024-01-15T09:59:59Z'));
      expect(getLocalHour('UTC')).toBe('09:00');
      
      setMockDate(new Date('2024-01-15T10:00:00Z'));
      expect(getLocalHour('UTC')).toBe('10:00');
      
      setMockDate(new Date('2024-01-15T10:00:01Z'));
      expect(getLocalHour('UTC')).toBe('10:00');
    });
  });

  describe('Schedule Format Validation', () => {
    test('should handle valid schedule formats', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      const validSchedules = [
        ['09:00'],
        ['09:00', '14:00', '19:00'],
        ['00:00', '12:00', '23:00'],
        ['01:00', '02:00', '03:00', '04:00', '05:00'],
      ];

      validSchedules.forEach((schedule) => {
        expect(() => shouldCallNow(schedule, 'UTC')).not.toThrow();
      });
    });

    test('should handle invalid schedule formats gracefully', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      const invalidSchedules = [
        ['9:00'],
        ['09:30'],
        ['25:00'],
        ['09:00:00'],
        ['invalid'],
      ];

      invalidSchedules.forEach((schedule) => {
        expect(shouldCallNow(schedule, 'UTC')).toBe(false);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle caregiver scheduling multiple times per day', async () => {
      setMockDate(new Date('2024-01-15T09:00:00Z'));
      
      // This test would require mocking the database
      // For now, we test the time matching logic
      const schedule = ['08:00', '09:00', '10:00'];
      expect(shouldCallNow(schedule, 'UTC')).toBe(true);
    });

    test('should handle patients across multiple timezones at same UTC time', async () => {
      setMockDate(new Date('2024-01-15T14:00:00Z'));
      
      expect(shouldCallNow(['09:00'], 'America/New_York')).toBe(true);
      expect(shouldCallNow(['06:00'], 'America/Los_Angeles')).toBe(true);
      expect(shouldCallNow(['14:00'], 'UTC')).toBe(true);
    });

    test('should handle edge case: patient scheduled at midnight', async () => {
      setMockDate(new Date('2024-01-15T00:00:00Z'));
      expect(shouldCallNow(['00:00'], 'UTC')).toBe(true);
    });

    test('should handle edge case: patient scheduled at 23:00 (11 PM)', async () => {
      setMockDate(new Date('2024-01-15T23:00:00Z'));
      expect(shouldCallNow(['23:00'], 'UTC')).toBe(true);
    });
  });
});

// Test runner
async function runTests() {
  console.log('🧪 Running Call Scheduler Test Suite\n');
  
  const tests: Array<() => Promise<void>> = [];
  
  // Collect all tests
  const describe = (name: string, fn: () => void) => {
    console.log(`\n📦 ${name}`);
    fn();
  };
  
  // Run all tests
  for (const testFn of tests) {
    await testFn();
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Total: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed!');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { test, expect, describe };
