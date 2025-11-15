import { useCallback, useRef, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { fetchVoicePreview } from '../utils/elevenLabs';
import { arrayBufferToBase64 } from '../utils/buffer';

export function useVoicePreview() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setActiveVoiceId(null);
  }, []);

  const play = useCallback(
    async (voiceId: string, script: string) => {
      setError(null);
      if (loadingVoiceId) {
        return;
      }
      setLoadingVoiceId(voiceId);
      try {
        if (soundRef.current) {
          await stop();
        }

        const audioBuffer = await fetchVoicePreview(voiceId, script);
        const base64 = arrayBufferToBase64(audioBuffer);
        const cacheRoot =
          ((FileSystem as unknown as { cacheDirectory?: string }).cacheDirectory ??
            (FileSystem as unknown as { documentDirectory?: string }).documentDirectory) ?? '';
        if (!cacheRoot) {
          throw new Error('Unable to access device cache directory.');
        }
        const audioPath = `${cacheRoot}${voiceId}-preview.mp3`;
        await FileSystem.writeAsStringAsync(audioPath, base64, {
          encoding: 'base64',
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioPath },
          { shouldPlay: true },
          (status: AVPlaybackStatus) => {
            if ('didJustFinish' in status && status.didJustFinish) {
              setActiveVoiceId(null);
            }
          },
        );
        soundRef.current = sound;
        setActiveVoiceId(voiceId);
      } catch (err: any) {
        setError(err.message ?? 'Unable to play preview');
      } finally {
        setLoadingVoiceId(null);
      }
    },
    [loadingVoiceId, stop],
  );

  return {
    play,
    stop,
    error,
    activeVoiceId,
    loadingVoiceId,
  };
}

