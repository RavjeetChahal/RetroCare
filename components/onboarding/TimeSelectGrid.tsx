import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../styles/tokens';
import { DEFAULT_TIME_SLOTS, formatTimeSlot } from '../../utils/timeSlots';

type TimeSelectGridProps = {
  selected: string[];
  onToggle: (slot: string) => void;
  slots?: string[];
};

export function TimeSelectGrid({ selected, onToggle, slots = DEFAULT_TIME_SLOTS }: TimeSelectGridProps) {
  return (
    <FlatList
      data={slots}
      numColumns={3}
      keyExtractor={(slot) => slot}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => {
        const isActive = selected.includes(item);
        return (
          <Pressable
            onPress={() => onToggle(item)}
            style={[styles.slot, isActive ? styles.slotActive : undefined]}
          >
            <Text style={[styles.slotText, isActive ? styles.slotTextActive : undefined]}>
              {formatTimeSlot(item)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  slot: {
    flex: 1,
    marginHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card,
    alignItems: 'center',
  },
  slotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  slotText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  slotTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
});

