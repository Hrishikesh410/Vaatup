import { useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

import { motion } from '@/theme/theme';

/**
 * Drives the shrink-on-press feedback shared by buttons and rows.
 *
 * Uses React Native's own `Animated` rather than Reanimated: this is a
 * two-keyframe scale that the built-in driver handles fine, and it keeps
 * `react-native-worklets` out of the runtime path.
 */
export function usePressScale() {
  // A lazy `useState` rather than a ref: the value is read while rendering
  // (it goes into a style), which refs are not meant for.
  const [scale] = useState(() => new Animated.Value(1));

  const animate = (toValue: number, duration: number) => {
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      // react-native-web has no native driver and warns when asked for one.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return {
    scale,
    onPressIn: () => animate(motion.pressScale, motion.pressIn),
    onPressOut: () => animate(1, motion.pressOut),
  };
}
