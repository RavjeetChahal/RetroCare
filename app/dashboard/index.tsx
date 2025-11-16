import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
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

  const patientIds = useMemo(() => patients.map((p) => p.id), [patients]);

  useRealtimeSync({
    caregiverId: caregiver?.id,
    patientId: selectedPatient?.id,
    patientIds,
  });

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
      <LinearGradient
        colors={['#030712', '#050d27', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.stateWrapper}>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Dashboard unavailable</Text>
            <Text style={styles.stateText}>
              Error loading dashboard. Please complete onboarding first.
            </Text>
            <Pressable style={styles.button} onPress={() => router.push('/onboarding')}>
              <Text style={styles.buttonText}>Go to Onboarding</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (isLoading) {
    return (
      <LinearGradient
        colors={['#030712', '#050d27', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.stateWrapper}>
          <View style={[styles.stateCard, styles.loadingState]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (patients.length === 0) {
    return (
      <LinearGradient
        colors={['#030712', '#050d27', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.stateWrapper}>
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>No Patients Yet</Text>
            <Text style={styles.emptyText}>
              You haven't added any patients yet. Complete onboarding to get started.
            </Text>
            <Pressable style={styles.button} onPress={() => router.push('/onboarding')}>
              <Text style={styles.buttonText}>Add Patient</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#030712', '#050d27', '#020617']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topActions}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {patients.length > 0 && <PatientHeader patients={patients} />}

        {selectedPatient && <MoodCard />}

        {selectedPatient && <MedsCard />}

        {selectedPatient && <CallsCard />}

        {selectedPatient && <FlagsCard />}

        {selectedPatient && <SleepCard />}

        <View style={styles.actionsStack}>
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

          <Pressable style={styles.patientHistoryButton} onPress={handlePatientHistory}>
            <Text style={styles.patientHistoryText}>Patient History</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  topActions: {
    width: '100%',
    alignItems: 'flex-end',
  },
  signOutButton: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    minWidth: 130,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  signOutText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionsStack: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  callNowButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
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
    borderWidth: 1.5,
    borderColor: 'rgba(56,189,248,0.4)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  patientHistoryText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stateWrapper: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  stateCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
  },
  loadingState: {
    alignItems: 'center',
  },
  stateTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
