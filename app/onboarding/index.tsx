import { useEffect, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useOnboardingStore, CaregiverDetails } from '../../hooks/useOnboardingStore';
import { PatientForm } from '../../components/onboarding/PatientForm';
import { TimeSelectGrid } from '../../components/onboarding/TimeSelectGrid';
import { VoicePreviewCard } from '../../components/onboarding/VoicePreviewCard';
import { colors, spacing } from '../../styles/tokens';
import { VOICE_OPTIONS, getVoiceSampleScript } from '../../utils/voices';
import { useVoicePreview } from '../../hooks/useVoicePreview';
import { saveOnboarding } from '../../utils/onboardingService';
import { formatTimeSlot } from '../../utils/timeSlots';

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useUser();
  const {
    step,
    caregiver,
    patient,
    callSchedule,
    voiceChoice,
    setCaregiver,
    setPatient,
    addMed,
    removeMed,
    addCondition,
    removeCondition,
    toggleTimeSlot,
    setVoiceChoice,
    nextStep,
    prevStep,
    reset,
  } = useOnboardingStore();

  useEffect(() => {
    if (user) {
      setCaregiver({
        name: caregiver.name || user.fullName || '',
        phone: caregiver.phone || user.primaryPhoneNumber?.phoneNumber || '',
        timezone: caregiver.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setPatient({
        ...patient,
        timezone: patient.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { play, stop, activeVoiceId, loadingVoiceId, error: voiceError } = useVoicePreview();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Clerk user is not available.');
      }
      return saveOnboarding({
        clerkId: user.id,
        caregiver,
        patient,
        callSchedule,
        voiceChoice,
      });
    },
    onSuccess: () => {
      reset();
      router.replace('/dashboard');
    },
  });

  const validations = useMemo(
    () => [
      caregiver.name && caregiver.phone && caregiver.timezone,
      patient.name && patient.age && patient.phone && patient.timezone,
      callSchedule.length > 0,
      Boolean(voiceChoice),
      true,
    ],
    [caregiver, patient, callSchedule.length, voiceChoice],
  );

  const canContinue = validations[step];

  const handlePrimaryAction = () => {
    if (step < TOTAL_STEPS - 1) {
      if (canContinue) {
        nextStep();
      }
      return;
    }
    mutation.mutate();
  };

  const primaryLabel = step === TOTAL_STEPS - 1 ? 'Save & Finish' : 'Continue';
  const secondaryLabel = step === 0 ? 'Cancel' : 'Back';

  const handleSecondaryAction = () => {
    if (step === 0) {
      router.back();
      return;
    }
    prevStep();
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <CaregiverForm value={caregiver} onChange={setCaregiver} />;
      case 1:
        return (
          <PatientForm
            value={patient}
            onChange={setPatient}
            onAddMed={addMed}
            onRemoveMed={removeMed}
            onAddCondition={addCondition}
            onRemoveCondition={removeCondition}
          />
        );
      case 2:
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pick call times</Text>
            <Text style={styles.sectionSubtitle}>
              Select one or more times when RetroCare should call your patient.
            </Text>
            <TimeSelectGrid selected={callSchedule} onToggle={toggleTimeSlot} />
          </View>
        );
      case 3:
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview voices</Text>
            <Text style={styles.sectionSubtitle}>
              Tap preview to hear a sample, then choose the voice seniors will hear.
            </Text>
            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}
            <View style={styles.voiceList}>
              {VOICE_OPTIONS.map((voice) => {
                // Use assistantId if available, otherwise fall back to voice id
                const identifier = voice.assistantId || voice.id;
                return (
                  <VoicePreviewCard
                    key={voice.id}
                    voice={voice}
                    isSelected={(voice.assistantId || voice.id) === voiceChoice}
                    isPlaying={activeVoiceId === identifier}
                    isLoading={loadingVoiceId === identifier}
                    onSelect={(voiceId) => {
                    // Store the assistantId if available, otherwise use voice id
                    const voice = VOICE_OPTIONS.find(v => v.id === voiceId);
                    setVoiceChoice(voice?.assistantId || voiceId);
                  }}
                    onPreview={(previewId) => {
                      if (activeVoiceId === previewId) {
                        stop();
                      } else {
                        // Use assistantId for preview, fall back to voice id if no assistantId
                        // Generate personalized script with the voice's name
                        const script = getVoiceSampleScript(voice.name);
                        play(previewId, script);
                      }
                    }}
                  />
                );
              })}
            </View>
          </View>
        );
      case 4:
      default:
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review & confirm</Text>
            <SummaryRow label="Caregiver" value={`${caregiver.name} • ${caregiver.phone}`} />
            <SummaryRow label="Patient" value={`${patient.name} • ${patient.phone}`} />
            <SummaryRow label="Timezone" value={patient.timezone} />
            <SummaryRow
              label="Medications"
              value={patient.meds.length ? patient.meds.join(', ') : 'Not provided'}
            />
            <SummaryRow
              label="Conditions"
              value={patient.conditions.length ? patient.conditions.join(', ') : 'Not provided'}
            />
            <SummaryRow
              label="Call schedule"
              value={callSchedule.length ? callSchedule.map(formatTimeSlot).join(', ') : 'Not set'}
            />
            <SummaryRow
              label="Voice"
              value={VOICE_OPTIONS.find((voice) => (voice.assistantId || voice.id) === voiceChoice)?.name ?? 'Not selected'}
            />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Step {step + 1} of {TOTAL_STEPS}</Text>
          <Text style={styles.title}>{STEP_TITLES[step]}</Text>
        </View>
        {renderStep()}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={[styles.secondaryButton]} onPress={handleSecondaryAction}>
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            (!canContinue || mutation.isPending) && step !== TOTAL_STEPS - 1 ? styles.disabledButton : undefined,
          ]}
          onPress={handlePrimaryAction}
          disabled={(step < TOTAL_STEPS - 1 && !canContinue) || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const STEP_TITLES = [
  'Caregiver details',
  'Patient basics',
  'Call schedule',
  'Voice preview',
  'Review & submit',
];

const CaregiverForm = ({
  value,
  onChange,
}: {
  value: CaregiverDetails;
  onChange: (updates: Partial<CaregiverDetails>) => void;
}) => (
  <View style={styles.section}>
    <TextInputField
      label="Your name"
      placeholder="Alex Caregiver"
      value={value.name}
      onChangeText={(text) => onChange({ name: text })}
    />
    <TextInputField
      label="Phone number"
      placeholder="+1 555 222 3344"
      keyboardType="phone-pad"
      value={value.phone}
      onChangeText={(text) => onChange({ phone: text })}
    />
    <TextInputField
      label="Timezone"
      placeholder="America/Los_Angeles"
      value={value.timezone}
      onChangeText={(text) => onChange({ timezone: text })}
    />
  </View>
);

const TextInputField = ({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'phone-pad';
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      style={styles.input}
    />
  </View>
);

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progressHeader: {
    gap: spacing.xs,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
  },
  voiceList: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.card,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    flexBasis: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  summaryRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1f2a44',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#fca5a5',
  },
});

