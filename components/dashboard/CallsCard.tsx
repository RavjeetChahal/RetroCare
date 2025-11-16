import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysCalls, type CallListItem } from '../../utils/callService';
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

/**
 * Get status icon and color based on call status
 */
function getStatusDisplay(status: CallListItem['status']) {
  switch (status) {
    case 'picked_up':
      return {
        icon: '📞',
        iconColor: '#10b981', // green
        bgColor: 'rgba(16, 185, 129, 0.15)',
      };
    case 'missed':
      return {
        icon: '📵',
        iconColor: '#ef4444', // red
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'neutral':
      return {
        icon: '📞',
        iconColor: '#eab308', // yellow
        bgColor: 'rgba(234, 179, 8, 0.15)',
      };
  }
}

export function CallsCard() {
  const { selectedPatient } = usePatientStore();

  // Fetch today's calls for selected patient
  const {
    data: todaysCalls = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['calls', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      return fetchTodaysCalls(selectedPatient.id);
    },
    enabled: !!selectedPatient?.id,
  });

  if (!selectedPatient) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Today's Calls</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Failed to load calls</Text>
        ) : todaysCalls.length === 0 ? (
          <Text style={styles.emptyText}>No calls today</Text>
        ) : (
          <View style={styles.callsList}>
            {todaysCalls.map((call: CallListItem) => {
              const statusDisplay = getStatusDisplay(call.status);
              const timeStr = formatTime12h(call.timestamp);
              const summary = call.summary || 'No summary available';

              return (
                <View key={call.id} style={styles.callItem}>
                  <View
                    style={[
                      styles.statusIcon,
                      { backgroundColor: statusDisplay.bgColor },
                    ]}
                  >
                    <Text style={[styles.iconEmoji, { color: statusDisplay.iconColor }]}>
                      {statusDisplay.icon}
                    </Text>
                  </View>
                  <View style={styles.callContent}>
                    <View style={styles.callHeader}>
                      <Text style={styles.callTime}>{timeStr}</Text>
                    </View>
                    <Text style={styles.callSummary} numberOfLines={2}>
                      {summary}
                    </Text>
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  callsList: {
    gap: spacing.md,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 20,
  },
  callContent: {
    flex: 1,
    gap: spacing.xs,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  callTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  callSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

