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
        router.replace('/dashboard');
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
    padding: spacing.lg,
    borderRadius: 16,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
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
  },
});

