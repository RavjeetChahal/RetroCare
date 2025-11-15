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
  fetchTodaysCallLogs,
  fetchCallLogsForPatients,
} from '../../utils/dashboardService';
import { getWeekStart, getWeekEnd, getPreviousWeek, getNextWeek } from '../../utils/weekUtils';
import { TodaySummary } from '../../components/dashboard/TodaySummary';
import { WeekCalendar } from '../../components/dashboard/WeekCalendar';
import { colors, spacing } from '../../styles/tokens';

type ViewMode = 'today' | 'week';

export default function DashboardScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());

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
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ['patients', caregiver?.id],
    queryFn: async () => {
      if (!caregiver?.id) return [];
      return fetchPatientsForCaregiver(caregiver.id);
    },
    enabled: !!caregiver?.id,
  });

  // Fetch today's call logs
  const {
    data: todaysLogs = [],
    isLoading: isLoadingTodaysLogs,
    refetch: refetchTodaysLogs,
  } = useQuery({
    queryKey: ['callLogs', 'today', patients.map((p) => p.id)],
    queryFn: async () => {
      if (patients.length === 0) return [];
      const patientIds = patients.map((p) => p.id);
      return fetchTodaysCallLogs(patientIds);
    },
    enabled: patients.length > 0,
  });

  // Fetch week's call logs
  const {
    data: weekLogs = [],
    isLoading: isLoadingWeekLogs,
    refetch: refetchWeekLogs,
  } = useQuery({
    queryKey: ['callLogs', 'week', currentWeek.toISOString(), patients.map((p) => p.id)],
    queryFn: async () => {
      if (patients.length === 0) return [];
      const patientIds = patients.map((p) => p.id);
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = getWeekEnd(currentWeek);
      return fetchCallLogsForPatients(patientIds, weekStart, weekEnd);
    },
    enabled: patients.length > 0 && viewMode === 'week',
  });

  const isLoading = isLoadingCaregiver || isLoadingPatients || isLoadingTodaysLogs;
  const isRefreshing = isLoadingWeekLogs && viewMode === 'week';

  const handleRefresh = useCallback(() => {
    refetchPatients();
    refetchTodaysLogs();
    if (viewMode === 'week') {
      refetchWeekLogs();
    }
  }, [refetchPatients, refetchTodaysLogs, refetchWeekLogs, viewMode]);

  const handlePreviousWeek = () => {
    setCurrentWeek(getPreviousWeek(currentWeek));
  };

  const handleNextWeek = () => {
    setCurrentWeek(getNextWeek(currentWeek));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const handleCallNow = async () => {
    if (patients.length === 0) {
      alert('No patients available to call');
      return;
    }

    // For now, call the first patient. In a full implementation, you'd show a patient selector
    const patientToCall = patients[0];

    try {
      const { callNow } = await import('../../utils/apiService');
      const result = await callNow(patientToCall.id);

      if (result.success) {
        alert(`Call initiated successfully! Call ID: ${result.callId || 'N/A'}`);
        // Refresh data
        handleRefresh();
      } else {
        alert(`Call failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error making call: ${error.message}`);
      console.error('Call now error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  if (caregiverError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error loading dashboard. Please complete onboarding first.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push('/onboarding')}>
          <Text style={styles.buttonText}>Go to Onboarding</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (patients.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>No Patients</Text>
        <Text style={styles.emptyText}>
          You haven't added any patients yet. Complete onboarding to get started.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push('/onboarding')}>
          <Text style={styles.buttonText}>Add Patient</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>
            {patients.length} {patients.length === 1 ? 'patient' : 'patients'}
          </Text>
        </View>
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleButton, viewMode === 'today' && styles.toggleButtonActive]}
          onPress={() => setViewMode('today')}
        >
          <Text
            style={[styles.toggleText, viewMode === 'today' && styles.toggleTextActive]}
          >
            Today
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === 'week' && styles.toggleButtonActive]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
            Week
          </Text>
        </Pressable>
      </View>

      {/* Call Now Button */}
      <Pressable style={styles.callNowButton} onPress={handleCallNow}>
        <Text style={styles.callNowText}>📞 Call Now</Text>
      </Pressable>

      {/* Content */}
      {viewMode === 'today' ? (
        <TodaySummary patients={patients} callLogs={todaysLogs} />
      ) : (
        <WeekCalendar
          weekStart={getWeekStart(currentWeek)}
          patients={patients}
          callLogs={weekLogs}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  signOutButton: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  signOutText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.accent,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.background,
  },
  callNowButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  callNowText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
