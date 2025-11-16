import { useEffect } from 'react';
import { ClerkLoaded, SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing } from '../../styles/tokens';
import { getCaregiverByClerkId } from '../../utils/dashboardService';
import { MeteorBackground } from '../../components/ui/MeteorBackground';

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
    <LinearGradient
      colors={['#030712', '#040a1c', '#01040f']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <MeteorBackground count={36} />
      <ClerkLoaded>
        <SignedOut>
          <View style={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.tag}>RetroCare Portal</Text>
              <Text style={styles.heading}>Care without chaos.</Text>
              <Text style={styles.subheading}>
                Sign in or create an account to orchestrate patient calls, review summaries, and act on
                flags inside one cinematic surface.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Access your workspace</Text>
                <Text style={styles.cardSubtitle}>Choose how you would like to continue.</Text>
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
              <Text style={styles.hint}>
                RetroCare accounts are invite-only for caregiver teams. Need access? Reach out to your
                RetroCare admin.
              </Text>
            </View>
          </View>
        </SignedOut>

        <SignedIn>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your workspace...</Text>
          </View>
        </SignedIn>
      </ClerkLoaded>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: '#020617',
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
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
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  subheading: {
    fontSize: 16,
    color: 'rgba(226,232,240,0.8)',
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
  cardHeader: {
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 16,
    color: 'rgba(226,232,240,0.7)',
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    paddingVertical: spacing.lg,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  hint: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    marginTop: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});

