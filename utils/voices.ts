export type VoiceOption = {
  id: string;
  name: string;
  description: string;
  style: 'Warm' | 'Energetic' | 'Calm' | 'Compassionate' | 'Upbeat';
};

export const VOICE_SAMPLE_SCRIPT =
  'Hi, this is RetroCare. My name is Julia. How are you feeling today? Did you take your meds?';

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Julia',
    description: 'Warm, reassuring, and friendly for daily check-ins.',
    style: 'Warm',
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Noah',
    description: 'Calm tone ideal for medication reminders.',
    style: 'Calm',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Bella',
    description: 'Upbeat and conversational voice for mood check-ins.',
    style: 'Upbeat',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Elli',
    description: 'Compassionate voice suited for sensitive conversations.',
    style: 'Compassionate',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'Antoni',
    description: 'Energetic tone for schedule confirmations.',
    style: 'Energetic',
  },
];

