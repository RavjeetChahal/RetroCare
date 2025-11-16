import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import { colors, spacing } from '../../styles/tokens';

export default function SignUpScreen() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded || !email || !password) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await signUp?.create({
        emailAddress: email.trim(),
        password,
      });

      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? 'Unable to create account.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !verificationCode) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result?.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        // New signups always go to onboarding
        router.replace('/onboarding');
      } else {
        setError('Verification incomplete. Please check the latest code and try again.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? 'Invalid code. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create your caregiver account</Text>
        {step === 'form' ? (
          <>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, !isLoaded ? styles.buttonDisabled : null]}
              onPress={handleSignUp}
              disabled={!isLoaded || isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Enter the 6-digit verification code sent to {email.trim()}.
            </Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="Verification code"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={verificationCode}
              onChangeText={setVerificationCode}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={styles.button}
              onPress={handleVerify}
              disabled={!verificationCode || isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: 20,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginTop: spacing.xs,
  },
});

