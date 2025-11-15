import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import type { CallLog, Patient } from '../../backend/supabase/types';
import { colors, spacing } from '../../styles/tokens';
import { formatWeekRange, getWeekEnd, getWeekStart } from '../../utils/weekUtils';
import { CallLogCard } from './CallLogCard';

type WeekCalendarProps = {
  weekStart: Date;
  patients: Patient[];
  callLogs: CallLog[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
};

export function WeekCalendar({
  weekStart,
  patients,
  callLogs,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: WeekCalendarProps) {
  const weekEnd = getWeekEnd(weekStart);
  const weekRange = formatWeekRange(weekStart, weekEnd);

  // Group call logs by patient
  const logsWithPatients = callLogs.map((log) => {
    const patient = patients.find((p) => p.id === log.patient_id);
    return { log, patientName: patient?.name };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly View</Text>
        <Text style={styles.weekRange}>{weekRange}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.button} onPress={onPreviousWeek}>
          <Text style={styles.buttonText}>← Previous</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onToday}>
          <Text style={styles.buttonText}>Today</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onNextWeek}>
          <Text style={styles.buttonText}>Next →</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.logsContainer} showsVerticalScrollIndicator={false}>
        {logsWithPatients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No call logs for this week</Text>
          </View>
        ) : (
          logsWithPatients.map(({ log, patientName }) => (
            <CallLogCard key={log.id} log={log} patientName={patientName} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  weekRange: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});

