import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysSleep, getSleepQualityDisplay, type SleepData } from '../../utils/sleepService';
import { colors, spacing } from '../../styles/tokens';

export function SleepCard() {
  const { selectedPatient } = usePatientStore();

  // Fetch today's sleep data for selected patient
  const {
    data: sleepData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sleep', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return null;
      return fetchTodaysSleep(selectedPatient.id);
    },
    enabled: !!selectedPatient?.id,
  });

  if (!selectedPatient) {
    return null;
  }

  const hasSleepData = sleepData && (sleepData.hours !== null || sleepData.quality !== null);
  const qualityDisplay = getSleepQualityDisplay(sleepData?.quality ?? null);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sleep Quality</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Failed to load sleep data</Text>
        ) : !hasSleepData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyText}>No sleep data reported today</Text>
          </View>
        ) : (
          <View style={styles.sleepContent}>
            {/* Sleep Hours */}
            {sleepData?.hours !== null && sleepData?.hours !== undefined && (
              <View style={styles.sleepSection}>
                <View style={styles.sleepHeader}>
                  <Text style={styles.sleepEmoji}>⏰</Text>
                  <Text style={styles.sleepLabel}>Hours Slept</Text>
                </View>
                <View style={styles.hoursContainer}>
                  <Text style={styles.hoursValue}>{sleepData.hours.toFixed(1)}</Text>
                  <Text style={styles.hoursUnit}>hrs</Text>
                </View>
              </View>
            )}

            {/* Sleep Quality */}
            {sleepData?.quality && (
              <View style={styles.sleepSection}>
                <View style={styles.sleepHeader}>
                  <Text style={styles.sleepEmoji}>{qualityDisplay.emoji}</Text>
                  <Text style={styles.sleepLabel}>Quality</Text>
                </View>
                <View
                  style={[
                    styles.qualityBadge,
                    {
                      backgroundColor: qualityDisplay.color + '20', // 20% opacity
                      borderColor: qualityDisplay.color,
                    },
                  ]}
                >
                  <Text style={[styles.qualityText, { color: qualityDisplay.color }]}>
                    {qualityDisplay.label}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  sleepContent: {
    gap: spacing.lg,
  },
  sleepSection: {
    gap: spacing.sm,
  },
  sleepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sleepEmoji: {
    fontSize: 20,
  },
  sleepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    paddingLeft: spacing.md + spacing.sm + 4, // Align with label
  },
  hoursValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hoursUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  qualityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: spacing.md + spacing.sm + 4, // Align with label
  },
  qualityText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

