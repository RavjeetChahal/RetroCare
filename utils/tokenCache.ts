import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token cache that uses sessionStorage on web (clears when tab closes)
 * and SecureStore on native (we'll clear it on app start)
 */
export const tokenCache = {
  getToken: async (key: string) => {
    if (Platform.OS === 'web') {
      // Use sessionStorage on web - automatically clears when tab closes
      return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  saveToken: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      // Use sessionStorage on web - automatically clears when tab closes
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, value);
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  clearAll: async () => {
    if (Platform.OS === 'web') {
      // Clear all sessionStorage items
      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
      }
      return;
    }
    // On native, we need to clear SecureStore items
    // Clerk uses specific keys, but we'll clear common ones
    const clerkKeys = [
      '__clerk_db_jwt',
      '__clerk_client_jwt',
      '__clerk_db_session',
      '__clerk_client_session',
    ];
    for (const key of clerkKeys) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore errors if key doesn't exist
      }
    }
  },
};

