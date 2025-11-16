import { Meteors } from '@/components/ui/meteors';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type MeteorBackgroundProps = {
  count?: number;
};

const METEOR_STYLE_ID = 'meteor-effect-styles';
const METEOR_STYLES = `
@keyframes meteor {
  0% { transform: rotate(215deg) translateX(0); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: rotate(215deg) translateX(-500px); opacity: 0; }
}
`;

export function MeteorBackground({ count = 28 }: MeteorBackgroundProps) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    if (document.getElementById(METEOR_STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = METEOR_STYLE_ID;
    style.innerHTML = METEOR_STYLES;
    document.head.appendChild(style);
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <Meteors number={count} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
});

