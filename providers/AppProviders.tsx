import { PropsWithChildren, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '../utils';

export const AppProviders = ({ children }: PropsWithChildren) => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const publishableKey =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error('Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in .env.local');
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} afterSignOutUrl="/">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
};

