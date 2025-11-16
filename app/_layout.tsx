import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '../styles/tokens';

export default function RootLayout() {
  const containerStyle = [
    styles.container,
    Platform.OS === 'web' && styles.webContainer,
  ];

  return (
    <View style={containerStyle}>
      <StatusBar style="light" />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webContainer: {
    width: '100%',
    height: '100%',
  },
});

