import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { colors } from '../styles/tokens';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  useEffect(() => {
    if (!isUserLoaded) return;

    // ALWAYS redirect to /auth first - let /auth handle routing for signed-in users
    // This ensures the app always starts at /auth, never directly to onboarding
    // /auth will check if user is signed in and route to dashboard/onboarding accordingly
    router.replace('/auth');
  }, [isUserLoaded, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

