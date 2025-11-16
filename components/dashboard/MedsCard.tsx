import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysMedicationStatus, type MedicationStatus } from '../../utils/medService';
import { colors, spacing } from '../../styles/tokens';
import { Ionicons } from '@expo/vector-icons';

/**
 * Format time to 12-hour format (e.g., "2:30 PM")
 */
function formatTime12h(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '';
  
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

export function MedsCard() {
  const { selectedPatient } = usePatientStore();

  // Fetch today's medication status
  // Include today's date in query key to ensure it refreshes daily
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const {
    data: medicationStatus = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['medications', selectedPatient?.id, 'today', today],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const status = await fetchTodaysMedicationStatus(selectedPatient.id);
      console.log('[MedsCard] Fetched medication status:', status);
      return status;
    },
    enabled: !!selectedPatient?.id,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    staleTime: 0, // Always consider data stale to ensure fresh updates
  });

  if (!selectedPatient) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Med Status</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Failed to load medications</Text>
        ) : medicationStatus.length === 0 ? (
          <Text style={styles.emptyText}>No medications registered</Text>
        ) : (
          <View style={styles.medsContainer}>
            {medicationStatus.map((med: MedicationStatus) => {
              const timeStr = med.takenAt ? formatTime12h(med.takenAt) : '';
              
              return (
                <View
                  key={med.medName}
                  style={[
                    styles.medPill,
                    med.taken ? styles.medPillTaken : styles.medPillNotTaken,
                  ]}
                >
                  {med.taken ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" style={styles.checkIcon} />
                  ) : (
                    <Ionicons name="close-circle" size={20} color="#ef4444" style={styles.checkIcon} />
                  )}
                  <View style={styles.medInfo}>
                    <Text
                      style={[
                        styles.medName,
                        med.taken ? styles.medNameTaken : styles.medNameNotTaken,
                      ]}
                    >
                      {med.medName}
                    </Text>
                    <Text
                      style={[
                        styles.medStatus,
                        med.taken ? styles.medStatusTaken : styles.medStatusNotTaken,
                      ]}
                    >
                      {med.taken ? 'Taken' : 'Not Taken'}
                    </Text>
                  </View>
                  {timeStr && (
                    <Text style={styles.medTime}>{timeStr}</Text>
                  )}
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
  medsContainer: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  medPill: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 60,
  },
  medPillNotTaken: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)', // red tint
    borderColor: '#ef4444', // red-500
  },
  medPillTaken: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // green tint
    borderColor: '#10b981', // green-500
  },
  checkIcon: {
    marginRight: spacing.xs,
  },
  medInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs / 2,
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
  },
  medNameNotTaken: {
    color: '#ef4444', // red-500
  },
  medNameTaken: {
    color: '#10b981', // green-500
  },
  medStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  medStatusNotTaken: {
    color: '#ef4444', // red-500
  },
  medStatusTaken: {
    color: '#10b981', // green-500
  },
  medTime: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
});
