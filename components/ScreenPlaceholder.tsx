import { StyleSheet, Text, View } from 'react-native';

type ScreenPlaceholderProps = {
  title: string;
  description?: string;
};

export function ScreenPlaceholder({ title, description }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0d1b2a',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f5f5f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#c7c7c7',
    textAlign: 'center',
  },
});

