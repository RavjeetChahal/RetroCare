import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysFlags, getFlagDisplay, type Flag } from '../../utils/flagService';
import { colors, spacing } from '../../styles/tokens';

/**
 * Format time to 12-hour format (e.g., "2:30 PM")
 */
function formatTime12h(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  } catch {
    return '';
  }
}

export function FlagsCard() {
  const { selectedPatient } = usePatientStore();

  // Fetch today's flags for selected patient
  const {
    data: todaysFlags = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['flags', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      return fetchTodaysFlags(selectedPatient.id);
    },
    enabled: !!selectedPatient?.id,
  });

  if (!selectedPatient) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Today's Flags</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Failed to load flags</Text>
        ) : todaysFlags.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyText}>No flags today</Text>
          </View>
        ) : (
          <View style={styles.flagsList}>
            {todaysFlags.map((flag: Flag) => {
              const display = getFlagDisplay(flag);
              const timeStr = formatTime12h(flag.timestamp);

              return (
                <View
                  key={flag.id}
                  style={[
                    styles.flagItem,
                    {
                      backgroundColor: display.bgColor,
                      borderColor: display.color,
                    },
                  ]}
                >
                  <View style={styles.flagHeader}>
                    <View style={styles.flagIconContainer}>
                      <Text style={styles.flagEmoji}>{display.emoji}</Text>
                    </View>
                    <View style={styles.flagContent}>
                      <Text style={[styles.flagLabel, { color: display.color }]}>
                        {display.label}
                      </Text>
                      <Text style={styles.flagTime}>{timeStr}</Text>
                    </View>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          backgroundColor: display.color,
                        },
                      ]}
                    >
                      <Text style={styles.severityText}>
                        {flag.severity === 'red' ? 'HIGH' : 'MED'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
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
  flagsList: {
    gap: spacing.md,
  },
  flagItem: {
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flagIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  flagEmoji: {
    fontSize: 24,
  },
  flagContent: {
    flex: 1,
    gap: spacing.xs,
  },
  flagLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  flagTime: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    flexShrink: 0,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

