import { useState, useCallback, useEffect } from 'react';
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
import type { Patient } from '../../backend/supabase/types';
import {
  getCaregiverByClerkId,
  fetchPatientsForCaregiver,
  fetchTodaysCallLogs,
} from '../../utils/dashboardService';
import { PatientHeader } from '../../components/dashboard/PatientHeader';
import { MoodCard } from '../../components/dashboard/MoodCard';
import { MedsCard } from '../../components/dashboard/MedsCard';
import { CallsCard } from '../../components/dashboard/CallsCard';
import { FlagsCard } from '../../components/dashboard/FlagsCard';
import { SleepCard } from '../../components/dashboard/SleepCard';
import { usePatientStore } from '../../hooks/usePatientStore';
import { colors, spacing } from '../../styles/tokens';

export default function DashboardScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isCallActive, setIsCallActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { setSelectedPatient } = usePatientStore();

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

  // Set first patient as default when patients load
  const { selectedPatient } = usePatientStore();
  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      setSelectedPatient(patients[0]);
    }
  }, [patients, selectedPatient, setSelectedPatient]);

  // Fetch today's call logs
  const {
    data: _todaysLogs = [],
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

  const isLoading = isLoadingCaregiver || isLoadingPatients || isLoadingTodaysLogs;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchPatients(), refetchTodaysLogs()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPatients, refetchTodaysLogs]);

  const handleCallNow = async () => {
    if (patients.length === 0) {
      alert('No patients available to call');
      return;
    }

    // For now, call the first patient. In a full implementation, you'd show a patient selector
    const patientToCall = patients[0];

    try {
      setIsCallActive(true);
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
    } finally {
      setTimeout(() => setIsCallActive(false), 300);
    }
  };

  const handlePatientHistory = () => {
    try {
      router.push('/calendar');
    } catch (error) {
      console.warn('Calendar route unavailable', error);
      alert('Calendar unavailable.');
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Top actions */}
      <View style={styles.topActions}>
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Patient Header - Phase 1 */}
      {patients.length > 0 && <PatientHeader patients={patients} />}

      {/* Mood Card - Phase 2 */}
      {selectedPatient && <MoodCard />}

      {/* Meds Card - Phase 3 */}
      {selectedPatient && <MedsCard />}

      {/* Calls Card - Phase 4 */}
      {selectedPatient && <CallsCard />}

      {/* Flags Card - Phase 5 */}
      {selectedPatient && <FlagsCard />}

      {/* Sleep Card - Phase 5 */}
      {selectedPatient && <SleepCard />}

      {/* Call Now Button */}
      <Pressable
        style={({ pressed }) => [
          styles.callNowButton,
          (pressed || isCallActive) && styles.callNowButtonActive,
        ]}
        onPress={handleCallNow}
        disabled={isCallActive}
      >
        <Text style={styles.callNowText}>{isCallActive ? 'Calling...' : '📞 Call Now'}</Text>
      </Pressable>

      {/* Patient History Button */}
      <Pressable style={styles.patientHistoryButton} onPress={handlePatientHistory}>
        <Text style={styles.patientHistoryText}>Patient History</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topActions: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  signOutButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    minWidth: 110,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  signOutText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  callNowButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  callNowButtonActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  callNowText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  patientHistoryButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  patientHistoryText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
