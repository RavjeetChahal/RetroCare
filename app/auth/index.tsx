import { useEffect } from 'react';
import { ClerkLoaded, SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing } from '../../styles/tokens';
import { getCaregiverByClerkId } from '../../utils/dashboardService';

export default function AuthScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  // Check if caregiver exists (onboarding complete)
  const { data: caregiver } = useQuery({
    queryKey: ['caregiver', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await getCaregiverByClerkId(user.id);
      } catch {
        return null;
      }
    },
    enabled: !!user?.id && isLoaded,
  });

  // Redirect signed-in users
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    if (caregiver) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [user, isLoaded, caregiver, router]);

  return (
    <View style={styles.container}>
      <ClerkLoaded>
        <SignedOut>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>RetroCare</Text>
              <Text style={styles.subtitle}>
                Sign in or create an account to manage caregiver dashboards, patients, and call schedules.
              </Text>
            </View>
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
          </View>
        </SignedOut>

        <SignedIn>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SignedIn>
      </ClerkLoaded>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

