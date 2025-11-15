/**
 * Mood Analysis from Call Transcripts
 * 
 * Computes sentiment score and determines mood based on transcript analysis
 */

import { logger } from '../utils/logger';

export type Mood = 'good' | 'neutral' | 'bad' | null;

export interface SentimentResult {
  score: number; // 0.0 to 1.0
  mood: Mood;
  confidence: number;
}

/**
 * Simple keyword-based sentiment analysis
 * In production, you'd use a proper NLP library or API (e.g., AWS Comprehend, Google Cloud NLP)
 */
function analyzeSentiment(transcript: string): number {
  if (!transcript || transcript.trim().length === 0) {
    return 0.5; // Neutral if no transcript
  }

  const text = transcript.toLowerCase();
  
  // Positive indicators
  const positiveWords = [
    'good', 'great', 'excellent', 'fine', 'well', 'better', 'happy', 'glad',
    'feeling good', 'doing well', 'alright', 'okay', 'ok', 'yes', 'sure',
    'thank you', 'thanks', 'appreciate', 'wonderful', 'nice', 'pleased'
  ];
  
  // Negative indicators
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'sick', 'pain', 'hurt',
    'tired', 'exhausted', 'dizzy', 'nauseous', 'dizzy', 'confused', 'sad',
    'depressed', 'anxious', 'worried', 'scared', 'frightened', 'no', 'not',
    'can\'t', 'cannot', 'unable', 'difficult', 'hard', 'struggling'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) positiveCount += matches.length;
  });
  
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) negativeCount += matches.length;
  });
  
  // Calculate base score
  const total = positiveCount + negativeCount;
  if (total === 0) {
    return 0.5; // Neutral if no indicators found
  }
  
  let baseScore = positiveCount / total;
  
  // Adjust for intensity (exclamation marks, repeated words)
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  
  // More exclamations with positive words = higher score
  // More questions = slight uncertainty (move toward neutral)
  if (positiveCount > negativeCount && exclamationCount > 0) {
    baseScore = Math.min(1.0, baseScore + 0.1);
  }
  if (questionCount > 3) {
    baseScore = baseScore * 0.9; // Slight reduction for uncertainty
  }
  
  return Math.max(0.0, Math.min(1.0, baseScore));
}

/**
 * Determine mood from sentiment score
 * 
 * Rules:
 * - score >= 0.66: "good"
 * - 0.33 <= score < 0.66: "neutral"
 * - score < 0.33: "bad"
 * - If transcript is empty or call not answered: null
 */
export function computeMoodFromTranscript(
  transcript: string | null | undefined,
  callAnswered: boolean
): SentimentResult {
  // If call was not answered, mood is null
  if (!callAnswered || !transcript || transcript.trim().length === 0) {
    return {
      score: 0.5,
      mood: null,
      confidence: 0.0,
    };
  }
  
  const score = analyzeSentiment(transcript);
  
  let mood: Mood;
  if (score >= 0.66) {
    mood = 'good';
  } else if (score >= 0.33) {
    mood = 'neutral';
  } else {
    mood = 'bad';
  }
  
  // Confidence based on how far from thresholds
  let confidence = 0.5;
  if (score >= 0.8 || score <= 0.2) {
    confidence = 0.9; // High confidence for extreme scores
  } else if (score >= 0.66 || score <= 0.33) {
    confidence = 0.7; // Medium-high confidence
  } else {
    confidence = 0.5; // Medium confidence near thresholds
  }
  
  logger.info('Mood computed from transcript', {
    score,
    mood,
    confidence,
    transcriptLength: transcript.length,
  });
  
  return {
    score,
    mood,
    confidence,
  };
}

/**
 * Get daily mood for a patient
 * Returns the most recent mood from an answered call on the given date
 * OR "neutral" if no calls answered that day
 * 
 * IMPORTANT: Never let missed calls count as "bad"
 */
export function getDailyMood(
  date: Date,
  callLogs: Array<{ mood: Mood; timestamp: string; outcome: string | null }>
): Mood {
  const dateStr = date.toISOString().split('T')[0];
  
  // Filter to answered calls on this date with non-null mood
  const answeredCalls = callLogs.filter(
    (log) =>
      log.outcome === 'answered' &&
      log.mood !== null &&
      log.timestamp.startsWith(dateStr)
  );
  
  if (answeredCalls.length === 0) {
    // No answered calls today -> return "neutral" (not null, as per requirements)
    // This ensures missed calls don't count as "bad"
    return 'neutral';
  }
  
  // Sort by timestamp (most recent first) and return the most recent mood
  answeredCalls.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return answeredCalls[0].mood || 'neutral';
}

