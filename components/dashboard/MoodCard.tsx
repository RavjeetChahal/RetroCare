import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { fetchTodaysMood, updateTodaysMood, type Mood } from '../../utils/moodService';
import { colors, spacing } from '../../styles/tokens';

export function MoodCard() {
  const { selectedPatient } = usePatientStore();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch today's mood for selected patient
  const {
    data: todaysMood,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mood', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return null;
      return fetchTodaysMood(selectedPatient.id);
    },
    enabled: !!selectedPatient?.id,
  });

  // Mutation to update mood
  const updateMoodMutation = useMutation({
    mutationFn: async (mood: Mood) => {
      if (!selectedPatient?.id) throw new Error('No patient selected');
      return updateTodaysMood(selectedPatient.id, mood);
    },
    onSuccess: () => {
      // Invalidate and refetch mood data
      queryClient.invalidateQueries({ queryKey: ['mood', selectedPatient?.id] });
    },
  });

  const handleMoodSelect = async (mood: Mood) => {
    if (!selectedPatient?.id || isUpdating) return;

    setIsUpdating(true);
    try {
      await updateMoodMutation.mutateAsync(mood);
    } catch (error) {
      console.error('Failed to update mood:', error);
      // You could show an error toast here
    } finally {
      setIsUpdating(false);
    }
  };

  if (!selectedPatient) {
    return null;
  }

  const moods: { value: Mood; emoji: string; label: string; color: string; bgColor: string }[] = [
    {
      value: 'happy',
      emoji: '😊',
      label: 'Happy',
      color: '#10b981', // green-500
      bgColor: 'rgba(16, 185, 129, 0.15)', // green tint
    },
    {
      value: 'neutral',
      emoji: '😐',
      label: 'Neutral',
      color: '#eab308', // yellow-500
      bgColor: 'rgba(234, 179, 8, 0.15)', // yellow tint
    },
    {
      value: 'sad',
      emoji: '😔',
      label: 'Sad',
      color: '#ef4444', // red-500
      bgColor: 'rgba(239, 68, 68, 0.15)', // red tint
    },
  ];

  const selectedMood = todaysMood?.mood || null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Mood</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Failed to load mood</Text>
        ) : (
          <View style={styles.moodContainer}>
            {moods.map((mood) => {
              const isSelected = selectedMood === mood.value;
              return (
                <Pressable
                  key={mood.value}
                  style={[
                    styles.moodPill,
                    {
                      backgroundColor: isSelected ? mood.bgColor : colors.card,
                      borderColor: isSelected ? mood.color : '#334155',
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleMoodSelect(mood.value)}
                  disabled={isUpdating}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text
                    style={[
                      styles.moodLabel,
                      { color: isSelected ? mood.color : colors.textSecondary },
                    ]}
                  >
                    {mood.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  moodContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  moodPill: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    gap: spacing.xs,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});

