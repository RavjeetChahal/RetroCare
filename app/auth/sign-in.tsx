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
import { useSignIn } from '@clerk/clerk-expo';
import { colors, spacing } from '../../styles/tokens';
import { MeteorBackground } from '../../components/ui/MeteorBackground';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded || !email || !password) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signIn?.create({
        identifier: email.trim(),
        password,
      });

      if (result?.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        // Redirect to /auth which will check caregiver status and route accordingly
        router.replace('/auth');
      } else {
        setError('Additional verification is required. Complete sign-in from the Clerk link sent.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? 'Unable to sign in. Double-check credentials.';
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
      <MeteorBackground />
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.tag}>RetroCare Portal</Text>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>
            Sign in to review patient check-ins, initiate calls, and keep care on track.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@retrocare.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, !isLoaded ? styles.buttonDisabled : null]}
            onPress={handleSignIn}
            disabled={!isLoaded || isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Signing in...' : 'Continue'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.xl,
    zIndex: 1,
  },
  hero: {
    gap: spacing.sm,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  subheading: {
    fontSize: 16,
    color: 'rgba(226,232,240,0.75)',
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: spacing.xl,
    borderRadius: 28,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 45,
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    color: 'rgba(226,232,240,0.8)',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 17,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    marginTop: spacing.xs,
  },
});

