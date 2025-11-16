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
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
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
          onPress={handleSignIn}
          disabled={!isLoaded || isSubmitting}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Signing in...' : 'Continue'}</Text>
        </Pressable>
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

