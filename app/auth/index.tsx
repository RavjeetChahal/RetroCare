import { ClerkLoaded, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../styles/tokens';

export default function AuthScreen() {
  return (
    <View style={styles.container}>
      <ClerkLoaded>
        <SignedOut>
          <Text style={styles.title}>RetroCare Access</Text>
          <Text style={styles.subtitle}>
            Sign in or create an account to manage caregiver dashboards, patients, and call
            schedules.
          </Text>
          <View style={styles.actions}>
            <Link href="/auth/sign-in" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </Pressable>
            </Link>
            <Link href="/auth/sign-up" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Create Account</Text>
              </Pressable>
            </Link>
          </View>
        </SignedOut>

        <SignedIn>
          <View style={styles.signedInCard}>
            <Text style={styles.title}>You are signed in</Text>
            <Text style={styles.subtitle}>
              Continue to onboarding or manage patients from the dashboard.
            </Text>
            <View style={styles.actions}>
              <Link href="/dashboard" asChild>
                <Pressable style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
                </Pressable>
              </Link>
              <Link href="/onboarding" asChild>
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Start Onboarding</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </SignedIn>
      </ClerkLoaded>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },
  signedInCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
});

