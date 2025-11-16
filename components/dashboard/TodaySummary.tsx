import { StyleSheet, Text, View } from 'react-native';
import type { CallLog, Patient } from '../../backend/supabase/types';
import { colors, spacing } from '../../styles/tokens';
import { formatTime, isToday } from '../../utils/weekUtils';

type TodaySummaryProps = {
  patients: Patient[];
  callLogs: CallLog[];
};

export function TodaySummary({ patients, callLogs }: TodaySummaryProps) {
  const todaysLogs = callLogs.filter((log) => {
    const logDate = new Date(log.timestamp);
    return isToday(logDate);
  });

  const patientsWithLogs = todaysLogs.map((log) => {
    const patient = patients.find((p) => p.id === log.patient_id);
    return { log, patient };
  });

  if (todaysLogs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Today's Summary</Text>
        <Text style={styles.emptyText}>No calls logged today</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Summary</Text>
      <View style={styles.logsContainer}>
        {patientsWithLogs.map(({ log, patient }) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.patientName}>{patient?.name || 'Unknown Patient'}</Text>
              <Text style={styles.time}>{formatTime(log.timestamp)}</Text>
            </View>
            {log.mood && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Mood:</Text>
                <Text style={styles.value}>{log.mood}</Text>
              </View>
            )}
            {log.sleep_quality && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Sleep:</Text>
                <Text style={styles.value}>
                  {log.sleep_quality}
                  {log.sleep_hours && ` (${log.sleep_hours} hrs)`}
                </Text>
              </View>
            )}
            {log.meds_taken && Array.isArray(log.meds_taken) && log.meds_taken.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Meds:</Text>
                <Text style={styles.value}>
                  {log.meds_taken
                    .map((med: any) => `${med.medName} ${med.taken ? '✓' : '✗'}`)
                    .join(', ')}
                </Text>
              </View>
            )}
            {log.flags && Array.isArray(log.flags) && log.flags.length > 0 && (
              <View style={styles.flagsContainer}>
                {log.flags.map((flag, idx) => (
                  <View key={idx} style={styles.flag}>
                    <Text style={styles.flagText}>{String(flag)}</Text>
                  </View>
                ))}
              </View>
            )}
            {log.summary && <Text style={styles.summary}>{log.summary}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  logsContainer: {
    gap: spacing.md,
  },
  logCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  time: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  flag: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  flagText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '600',
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});

