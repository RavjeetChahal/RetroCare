import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import type { Patient, CallLog } from '../../backend/supabase/types';
import {
  getCaregiverByClerkId,
  fetchPatientsForCaregiver,
  fetchTodaysCallLogs,
} from '../../utils/dashboardService';
import { colors, spacing } from '../../styles/tokens';

// Mock data for demonstration
const MOCK_PATIENT = {
  id: 'mock-1',
  name: 'Margaret Chen',
  age: 78,
  phone: '+1 (555) 123-4567',
};

const MOCK_MOODS = [
  { id: 'happy', emoji: '😊', label: 'Good', color: '#6CD98B' },
  { id: 'neutral', emoji: '😐', label: 'Okay', color: '#FFD84D' },
  { id: 'sad', emoji: '😔', label: 'Not Well', color: '#FF7A7A' },
];

const MOCK_MEDS = [
  { id: '1', name: 'Lisinopril 10mg', time: '8:00 AM', taken: true },
  { id: '2', name: 'Metformin 500mg', time: '8:00 AM', taken: true },
  { id: '3', name: 'Atorvastatin 20mg', time: '9:00 PM', taken: false },
];

const MOCK_CALLS = [
  {
    id: '1',
    time: '9:15 AM',
    caller: 'Dr. Smith',
    summary: 'Routine check-in. Patient feeling well, no concerns.',
    status: 'completed',
  },
  {
    id: '2',
    time: '2:30 PM',
    caller: 'Nurse Julie',
    summary: 'Medication reminder. Patient confirmed all meds taken.',
    status: 'completed',
  },
  {
    id: '3',
    time: '6:45 PM',
    caller: 'Family Member',
    summary: 'Brief conversation, patient seemed tired but responsive.',
    status: 'partial',
  },
];

const MOCK_FLAGS = [
  { id: '1', label: 'Missed evening medication', priority: 1, type: 'critical' },
  { id: '2', label: 'Below target sleep hours', priority: 2, type: 'warning' },
];

const MOCK_SLEEP = {
  hours: 6.5,
  target: 8,
};

export default function PatientScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Fetch caregiver and patients
  const { data: caregiver, isLoading: isLoadingCaregiver } = useQuery({
    queryKey: ['caregiver', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await getCaregiverByClerkId(user.id);
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });

  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', caregiver?.id],
    queryFn: async () => {
      if (!caregiver?.id) return [];
      return fetchPatientsForCaregiver(caregiver.id);
    },
    enabled: !!caregiver?.id,
  });

  // Use first patient or mock data
  const displayPatient = patients.length > 0 ? patients[0] : MOCK_PATIENT;
  const patientName = patients.length > 0 ? patients[0].name : MOCK_PATIENT.name;

  const isLoading = isLoadingCaregiver || isLoadingPatients;

  const getSleepColor = (hours: number) => {
    if (hours >= 8) return '#6CD98B';
    if (hours >= 5) return '#FFD84D';
    return '#FF7A7A';
  };

  const getCallStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return { name: 'call' as const, color: '#6CD98B' };
      case 'partial':
        return { name: 'call-outline' as const, color: '#FFD84D' };
      case 'missed':
        return { name: 'call' as const, color: '#FF7A7A' };
      default:
        return { name: 'call-outline' as const, color: '#9AA0A6' };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Patient Greeting Card */}
      <View style={styles.glassCard}>
        <View style={styles.greetingHeader}>
          <Text style={styles.greetingText}>How is</Text>
          <Pressable style={styles.patientNameButton}>
            <Text style={styles.patientNameText}>{patientName}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.greetingText}>doing today?</Text>
        </View>
      </View>

      {/* Mood Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mood</Text>
        <View style={styles.moodContainer}>
          {MOCK_MOODS.map((mood) => (
            <Pressable
              key={mood.id}
              style={[
                styles.moodCard,
                selectedMood === mood.id && styles.moodCardSelected,
                { borderColor: selectedMood === mood.id ? mood.color : 'rgba(255, 255, 255, 0.08)' },
              ]}
              onPress={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text style={styles.moodLabel}>{mood.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Meds Taken Today */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meds Taken Today</Text>
        <View style={styles.glassCard}>
          {MOCK_MEDS.map((med) => (
            <View key={med.id} style={styles.medItem}>
              <View style={styles.medContent}>
                <Text
                  style={[
                    styles.medName,
                    med.taken && styles.medNameTaken,
                  ]}
                >
                  {med.name}
                </Text>
                <Text style={[styles.medTime, med.taken && styles.medTimeTaken]}>
                  {med.time}
                </Text>
              </View>
              {med.taken && (
                <Ionicons name="checkmark-circle" size={20} color="#6CD98B" />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Today's Calls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Calls</Text>
        <View style={styles.callsContainer}>
          {MOCK_CALLS.map((call) => {
            const statusIcon = getCallStatusIcon(call.status);
            return (
              <View key={call.id} style={styles.glassCard}>
                <View style={styles.callHeader}>
                  <View style={styles.callTimeContainer}>
                    <Text style={styles.callTime}>{call.time}</Text>
                    <Ionicons name={statusIcon.name} size={16} color={statusIcon.color} />
                  </View>
                  <Text style={styles.callerName}>{call.caller}</Text>
                </View>
                <Text style={styles.callSummary}>{call.summary}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Flags Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flags</Text>
        <View style={styles.flagsContainer}>
          {MOCK_FLAGS.map((flag) => (
            <View
              key={flag.id}
              style={[
                styles.glassCard,
                styles.flagCard,
                flag.type === 'critical' && styles.flagCardCritical,
                flag.type === 'warning' && styles.flagCardWarning,
              ]}
            >
              <Ionicons
                name="flag"
                size={20}
                color={flag.type === 'critical' ? '#FF7A7A' : '#FFD84D'}
              />
              <View style={styles.flagContent}>
                <Text style={styles.flagLabel}>{flag.label}</Text>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>P{flag.priority}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Sleep Quality */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep Quality</Text>
        <View style={styles.glassCard}>
          <View style={styles.sleepHeader}>
            <Ionicons name="bed" size={24} color="#8A59FF" />
            <Text style={styles.sleepHours}>{MOCK_SLEEP.hours} hours last night</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${(MOCK_SLEEP.hours / MOCK_SLEEP.target) * 100}%`,
                  backgroundColor: getSleepColor(MOCK_SLEEP.hours),
                },
              ]}
            />
          </View>
        </View>
      </View>
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
    paddingBottom: spacing.xl * 2,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 4,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  greetingText: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  patientNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(138, 89, 255, 0.15)',
  },
  patientNameText: {
    fontSize: 20,
    color: '#8A59FF',
    fontWeight: '700',
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  moodContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  moodCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
  },
  moodCardSelected: {
    backgroundColor: 'rgba(108, 217, 139, 0.15)',
    borderWidth: 2,
    shadowColor: '#6CD98B',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  moodEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  moodLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  medItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  medContent: {
    flex: 1,
  },
  medName: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  medNameTaken: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  medTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medTimeTaken: {
    opacity: 0.6,
  },
  callsContainer: {
    gap: spacing.md,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  callTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  callTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  callerName: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  callSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  flagsContainer: {
    gap: spacing.md,
  },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  flagCardCritical: {
    backgroundColor: 'rgba(255, 122, 122, 0.15)',
    borderColor: 'rgba(255, 122, 122, 0.3)',
  },
  flagCardWarning: {
    backgroundColor: 'rgba(255, 216, 77, 0.15)',
    borderColor: 'rgba(255, 216, 77, 0.3)',
  },
  flagContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sleepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sleepHours: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
    shadowColor: '#8A59FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
});
