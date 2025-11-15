import { StyleSheet, Text, View } from 'react-native';
import type { CallLog } from '../../backend/supabase/types';
import { colors, spacing } from '../../styles/tokens';
import { formatDate, formatTime } from '../../utils/weekUtils';

type CallLogCardProps = {
  log: CallLog;
  patientName?: string;
};

export function CallLogCard({ log, patientName }: CallLogCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          {patientName && <Text style={styles.patientName}>{patientName}</Text>}
          <Text style={styles.date}>{formatDate(log.timestamp)}</Text>
        </View>
        <Text style={styles.time}>{formatTime(log.timestamp)}</Text>
      </View>

      <View style={styles.content}>
        {log.mood && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Mood:</Text>
            <Text style={styles.value}>{log.mood}</Text>
          </View>
        )}

        {log.sleep_quality && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Sleep Quality:</Text>
            <Text style={styles.value}>{log.sleep_quality}</Text>
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

        {log.summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Summary:</Text>
            <Text style={styles.summary}>{log.summary}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  time: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    minWidth: 100,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
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
  summaryContainer: {
    marginTop: spacing.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  summary: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});

