import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usePatientStore } from '../../hooks/usePatientStore';
import { getSupabaseClient } from '../../utils/supabaseClient';
import { colors, spacing } from '../../styles/tokens';

type Mood = 'good' | 'neutral' | 'bad' | null;

export function MoodCard() {
  const { selectedPatient } = usePatientStore();

  // Fetch today's mood from call logs (GPT-inferred)
  const {
    data: todaysMood,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mood', selectedPatient?.id, 'today'],
    queryFn: async () => {
      if (!selectedPatient?.id) return null;
      
      const supabase = getSupabaseClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get the most recent answered call's mood (which is GPT-inferred)
      const { data, error } = await supabase
        .from('call_logs')
        .select('mood')
        .eq('patient_id', selectedPatient.id)
        .eq('outcome', 'answered')
        .not('mood', 'is', null)
        .gte('timestamp', today.toISOString())
        .lt('timestamp', tomorrow.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching mood:', error);
        return null;
      }

      // Map from call_logs format (good/neutral/bad) to display format
      const moodMapping: Record<string, { word: string; color: string; bgColor: string }> = {
        'good': {
          word: 'Good',
          color: '#10b981', // green-500
          bgColor: 'rgba(16, 185, 129, 0.15)', // green tint
        },
        'neutral': {
          word: 'Neutral',
          color: '#eab308', // yellow-500
          bgColor: 'rgba(234, 179, 8, 0.15)', // yellow tint
        },
        'bad': {
          word: 'Bad',
          color: '#ef4444', // red-500
          bgColor: 'rgba(239, 68, 68, 0.15)', // red tint
        },
      };

      return data?.mood ? moodMapping[data.mood] || moodMapping['neutral'] : null;
    },
    enabled: !!selectedPatient?.id,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  if (!selectedPatient) {
    return null;
  }

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
        ) : todaysMood ? (
          <View style={styles.moodContainer}>
            <View
              style={[
                styles.moodDisplay,
                {
                  backgroundColor: todaysMood.bgColor,
                  borderColor: todaysMood.color,
                },
              ]}
            >
              <Text
                style={[
                  styles.moodWord,
                  { color: todaysMood.color },
                ]}
              >
                {todaysMood.word}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noMoodText}>No call data today</Text>
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
  },
  moodDisplay: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    alignSelf: 'flex-start',
  },
  moodWord: {
    fontSize: 18,
    fontWeight: '600',
  },
  noMoodText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
});

