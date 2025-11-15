import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../styles/tokens';

const routes = [
  { label: 'Auth', href: '/auth' as const },
  { label: 'Onboarding', href: '/onboarding' as const },
  { label: 'Dashboard', href: '/dashboard' as const },
  { label: 'Calendar', href: '/calendar' as const },
  { label: 'Patient Management', href: '/patient' as const },
  { label: 'Voice Preview', href: '/voice-preview' as const },
] as const;

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RetroCare</Text>
      <Text style={styles.subtitle}>
        Select a module below to open its placeholder screen. Each module will be expanded in
        later phases.
      </Text>
      <View style={styles.links}>
        {routes.map((route) => (
          <Link key={route.href} href={route.href} style={styles.link}>
            <Text style={styles.linkText}>{route.label}</Text>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  links: {
    gap: spacing.md,
  },
  link: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 16,
  },
  linkText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
});

