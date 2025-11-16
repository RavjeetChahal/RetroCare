/**
 * GPT-based Mood Analysis from Call Transcripts
 * 
 * Uses OpenAI GPT to infer mood from call transcripts
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';

export type Mood = 'good' | 'neutral' | 'bad' | null;

export interface SentimentResult {
  score: number; // 0.0 to 1.0
  mood: Mood;
  confidence: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set - GPT mood inference will be disabled');
    return null;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Infer mood from transcript using GPT
 * 
 * @param transcript - Call transcript text
 * @param callAnswered - Whether the call was answered
 * @returns SentimentResult with GPT-inferred mood
 */
export async function computeMoodFromTranscriptGPT(
  transcript: string | null | undefined,
  callAnswered: boolean
): Promise<SentimentResult> {
  // If call was not answered, mood is null
  if (!callAnswered || !transcript || transcript.trim().length === 0) {
    return {
      score: 0.5,
      mood: null,
      confidence: 0.0,
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    // Fallback to keyword-based if OpenAI is not configured
    logger.warn('OpenAI client not available, falling back to keyword-based mood analysis');
    const { computeMoodFromTranscript } = await import('./moodAnalyzer');
    return computeMoodFromTranscript(transcript, callAnswered);
  }

  try {
    const prompt = `Analyze the emotional state and mood of the patient from this call transcript. 
Consider the tone, word choice, and overall sentiment expressed by the patient.

Transcript:
"${transcript}"

Respond with ONLY a JSON object in this exact format:
{
  "mood": "good" | "neutral" | "bad",
  "score": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Where:
- mood: "good" for positive/happy, "neutral" for neutral/calm, "bad" for negative/sad/stressed
- score: 0.0 (very negative) to 1.0 (very positive), 0.5 is neutral
- confidence: How confident you are in the assessment (0.0-1.0)
- reasoning: Brief explanation of your assessment

Respond with ONLY the JSON object, no other text.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: 'You are a healthcare assistant analyzing patient mood from call transcripts. Respond with only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from GPT');
    }

    // Extract JSON from response (handle cases where GPT adds extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in GPT response');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize result
    const mood = result.mood === 'good' || result.mood === 'neutral' || result.mood === 'bad' 
      ? result.mood 
      : 'neutral';
    const score = Math.max(0, Math.min(1, Number(result.score) || 0.5));
    const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0.5));

    logger.info('GPT mood inference completed', {
      mood,
      score,
      confidence,
      reasoning: result.reasoning,
      transcriptLength: transcript.length,
    });

    return {
      score,
      mood,
      confidence,
    };
  } catch (error: any) {
    logger.error('Error in GPT mood inference', {
      error: error.message,
      transcriptLength: transcript.length,
      stack: error.stack,
    });

    // Fallback to keyword-based analysis if GPT fails
    logger.warn('Falling back to keyword-based mood analysis');
    const { computeMoodFromTranscript } = await import('./moodAnalyzer');
    return computeMoodFromTranscript(transcript, callAnswered);
  }
}

