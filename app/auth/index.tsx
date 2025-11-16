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
  // This determines if user should go to dashboard (existing account) or onboarding (new account)
  const { data: caregiver, isLoading: isLoadingCaregiver, error: caregiverError } = useQuery({
    queryKey: ['caregiver', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const caregiverData = await getCaregiverByClerkId(user.id);
        // If caregiver exists, they've completed onboarding - they have an account
        return caregiverData;
      } catch (error: any) {
        // If error is "not found" or similar, caregiver doesn't exist (new user)
        // This is expected for new users - they'll go to onboarding
        if (error?.code === 'PGRST116' || error?.message?.includes('No rows')) {
          return null;
        }
        // For other errors, log but still return null (will route to onboarding)
        console.warn('Error checking caregiver:', error);
        return null;
      }
    },
    enabled: !!user?.id && isLoaded,
    retry: false, // Don't retry if caregiver doesn't exist
  });

  // Redirect signed-in users based on whether they have an account
  useEffect(() => {
    // Wait for Clerk and caregiver check to complete
    if (!isLoaded || !user || isLoadingCaregiver) return;
    
    // If caregiver exists in Supabase = existing account with completed onboarding
    // Route to dashboard which will load patients from Supabase
    if (caregiver) {
      router.replace('/dashboard');
    } else {
      // No caregiver found = new user creating account
      // Route to onboarding to create caregiver and patient records
      router.replace('/onboarding');
    }
  }, [user, isLoaded, caregiver, isLoadingCaregiver, router]);

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

