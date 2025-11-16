import { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Patient, CallLog } from '../../backend/supabase/types';
import {
  getCaregiverByClerkId,
  fetchPatientsForCaregiver,
  fetchCallLogsForPatients,
} from '../../utils/dashboardService';
import {
  getWeekStart,
  getWeekEnd,
  getPreviousWeek,
  getNextWeek,
  formatWeekRange,
} from '../../utils/weekUtils';
import { CallLogCard } from '../../components/dashboard/CallLogCard';
import { colors, spacing } from '../../styles/tokens';

export default function CalendarScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Fetch caregiver ID
  const {
    data: caregiver,
    isLoading: isLoadingCaregiver,
    error: caregiverError,
  } = useQuery({
    queryKey: ['caregiver', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      return getCaregiverByClerkId(user.id);
    },
    enabled: !!user?.id,
  });

  // Fetch patients
  const {
    data: patients = [],
    isLoading: isLoadingPatients,
  } = useQuery({
    queryKey: ['patients', caregiver?.id],
    queryFn: async () => {
      if (!caregiver?.id) return [];
      return fetchPatientsForCaregiver(caregiver.id);
    },
    enabled: !!caregiver?.id,
  });

  // Fetch week's call logs
  const weekStart = getWeekStart(currentWeek);
  const weekEnd = getWeekEnd(currentWeek);
  const weekRange = formatWeekRange(weekStart, weekEnd);

  const {
    data: weekLogs = [],
    isLoading: isLoadingWeekLogs,
    refetch: refetchWeekLogs,
  } = useQuery({
    queryKey: ['callLogs', 'week', currentWeek.toISOString(), patients.map((p) => p.id)],
    queryFn: async () => {
      if (patients.length === 0) return [];
      const patientIds = patients.map((p) => p.id);
      return fetchCallLogsForPatients(patientIds, weekStart, weekEnd);
    },
    enabled: patients.length > 0,
  });

  const handlePreviousWeek = useCallback(() => {
    setCurrentWeek(getPreviousWeek(currentWeek));
  }, [currentWeek]);

  const handleNextWeek = useCallback(() => {
    setCurrentWeek(getNextWeek(currentWeek));
  }, [currentWeek]);

  const handleGoToCurrentWeek = useCallback(() => {
    setCurrentWeek(new Date());
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchWeekLogs();
    setRefreshing(false);
  }, [refetchWeekLogs]);

  // Group call logs by patient
  const logsWithPatients = weekLogs.map((log) => {
    const patient = patients.find((p) => p.id === log.patient_id);
    return { log, patientName: patient?.name };
  });

  // Sort by timestamp (most recent first)
  logsWithPatients.sort((a, b) => {
    const dateA = new Date(a.log.timestamp).getTime();
    const dateB = new Date(b.log.timestamp).getTime();
    return dateB - dateA;
  });

  if (caregiverError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading caregiver data</Text>
        <Pressable style={styles.button} onPress={handleGoBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isLoading = isLoadingCaregiver || isLoadingPatients || isLoadingWeekLogs;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Calendar View</Text>
        <Text style={styles.weekRange}>{weekRange}</Text>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekControls}>
        <Pressable style={styles.navButton} onPress={handlePreviousWeek}>
          <Text style={styles.navButtonText}>← Previous Week</Text>
        </Pressable>
        <Pressable style={styles.todayButton} onPress={handleGoToCurrentWeek}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={handleNextWeek}>
          <Text style={styles.navButtonText}>Next Week →</Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading call logs...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {logsWithPatients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No call logs for this week</Text>
              <Text style={styles.emptySubtext}>
                Call logs will appear here once calls are made
              </Text>
            </View>
          ) : (
            logsWithPatients.map(({ log, patientName }) => (
              <CallLogCard key={log.id} log={log} patientName={patientName} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signOutText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  weekRange: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  weekControls: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  navButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  todayButton: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  todayButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
