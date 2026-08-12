import { PropsWithChildren, useMemo, useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, useClerk, useAuth } from '@clerk/clerk-expo';
import { tokenCache, logger } from '../utils';
// Import gesture handler - safe to import on all platforms, initialized in index.ts
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Component to handle auto-sign-out and cache clearing on app start
function AutoSignOut({ children }: PropsWithChildren) {
  const { signOut } = useClerk();
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const hasCleared = useRef(false);

  useEffect(() => {
    logger.debug('AutoSignOut effect triggered', {
      hasCleared: hasCleared.current,
      isLoaded,
      hasUser: Boolean(userId),
    });

    // Only run once on app start, and wait for Clerk to be loaded
    if (hasCleared.current || !isLoaded) {
      if (!isLoaded) {
        logger.debug('AutoSignOut waiting for Clerk to load...');
      }
      return;
    }
    hasCleared.current = true;

    // Clear cache and sign out when app starts
    const clearSession = async () => {
      logger.info('AutoSignOut: clearing session state', { hasUser: Boolean(userId) });
      try {
        // Clear React Query cache first
        queryClient.clear();
        logger.debug('AutoSignOut: React Query cache cleared');
        
        // Clear token cache
        await tokenCache.clearAll();
        logger.debug('AutoSignOut: token cache cleared');
        
        // Sign out user only if they're signed in
        if (userId) {
          try {
            logger.info('AutoSignOut: signing out existing user', { userId });
            await signOut();
            logger.info('AutoSignOut: sign-out complete');
          } catch (error) {
            // Ignore sign out errors - cache is already cleared
            logger.warn('AutoSignOut: sign-out attempt failed (ignored)', error);
          }
        } else {
          logger.debug('AutoSignOut: no existing user to sign out');
        }
      } catch (error) {
        // Ignore errors - cache might already be clear
        logger.warn('AutoSignOut: failed to clear session state (ignored)', error);
      }
    };

    clearSession();
  }, [signOut, queryClient, isLoaded, userId]);

  return <>{children}</>;
}

export const AppProviders = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    logger.info('AppProviders mounted', { platform: Platform.OS });
    return () => logger.info('AppProviders unmounted');
  }, []);

  // Configure React Query to not persist cache
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't persist queries - they'll be cleared on app restart
            staleTime: 0,
            gcTime: 0, // Previously cacheTime - no caching
            refetchOnMount: true,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  const publishableKey =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    logger.error('AppProviders: Missing Clerk publishable key');
    throw new Error('Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in .env.local');
  }

  logger.debug('AppProviders: Clerk publishable key detected', {
    length: publishableKey.length,
    suffix: publishableKey.slice(-4),
  });

  const content = (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AutoSignOut>{children}</AutoSignOut>
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  // Web: Use plain View (gesture handler not needed)
  if (Platform.OS === 'web') {
    const webStyle = {
      flex: 1,
      width: '100%',
      height: '100%',
      // @ts-expect-error - web-only CSS property
      minHeight: '100vh',
    };

    return (
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} afterSignOutUrl="/">
        <View style={webStyle}>
          {content}
        </View>
      </ClerkProvider>
    );
  }

  // Native: Use GestureHandlerRootView (already imported at top level)
  logger.debug('AppProviders: rendering native container');
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} afterSignOutUrl="/">
      <GestureHandlerRootView style={styles.nativeRoot}>
        {content}
      </GestureHandlerRootView>
    </ClerkProvider>
  );
};

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
  },
});

