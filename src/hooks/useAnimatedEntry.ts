import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

interface AnimatedEntryOptions {
  delay?: number;
  duration?: number;
  type?: 'fadeIn' | 'slideUp' | 'slideRight' | 'scaleIn';
}

export const useAnimatedEntry = (options: AnimatedEntryOptions = {}) => {
  const { delay = 0, duration = 300, type = 'fadeIn' } = options;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(type === 'slideUp' ? 20 : 0);
  const translateX = useSharedValue(type === 'slideRight' ? -20 : 0);
  const scaleValue = useSharedValue(type === 'scaleIn' ? 0.9 : 1);

  useEffect(() => {
    const timingConfig = { duration, easing: Easing.out(Easing.cubic) };

    opacity.value = withDelay(delay, withTiming(1, timingConfig));

    if (type === 'slideUp') {
      translateY.value = withDelay(delay, withTiming(0, timingConfig));
    } else if (type === 'slideRight') {
      translateX.value = withDelay(delay, withTiming(0, timingConfig));
    } else if (type === 'scaleIn') {
      scaleValue.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 150 }));
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scaleValue.value },
    ],
  }));

  return animatedStyle;
};

// Stagger helper - returns delay for item at index
export const staggerDelay = (index: number, baseDelay = 50): number => {
  return index * baseDelay;
};
