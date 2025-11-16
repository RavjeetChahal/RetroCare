import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysMedicationStatus, type MedicationStatus } from '../../utils/medService';
import { colors, spacing } from '../../styles/tokens';

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
  const {
    data: medicationStatus = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['medications', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      return fetchTodaysMedicationStatus(selectedPatient.id);
    },
    enabled: !!selectedPatient?.id,
  });

  if (!selectedPatient) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Meds Taken Today</Text>
        
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
                    med.taken && styles.medPillTaken,
                  ]}
                >
                  <Text
                    style={[
                      styles.medName,
                      med.taken && styles.medNameTaken,
                    ]}
                  >
                    {med.medName}
                  </Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  medPill: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  medPillTaken: {
    backgroundColor: '#1e293b',
    opacity: 0.6,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  medNameTaken: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  medTime: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
