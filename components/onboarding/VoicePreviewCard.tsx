import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../../styles/tokens';
import { VoiceOption } from '../../utils/voices';

type VoicePreviewCardProps = {
  voice: VoiceOption;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onSelect: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
};

export function VoicePreviewCard({
  voice,
  isSelected,
  isPlaying,
  isLoading,
  onSelect,
  onPreview,
}: VoicePreviewCardProps) {
  return (
    <Pressable
      style={[styles.card, isSelected ? styles.cardSelected : undefined]}
      onPress={() => onSelect(voice.id)}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{voice.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{voice.style}</Text>
        </View>
      </View>
      <Text style={styles.description}>{voice.description}</Text>
      <Pressable
        style={[styles.previewButton, isPlaying ? styles.previewButtonActive : undefined]}
        onPress={() => onPreview(voice.id)}
      >
        {isLoading ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.previewButtonText}>{isPlaying ? 'Stop' : 'Play preview'}</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#0f1b36',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
  },
  previewButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  previewButtonActive: {
    backgroundColor: colors.accent,
  },
  previewButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});

