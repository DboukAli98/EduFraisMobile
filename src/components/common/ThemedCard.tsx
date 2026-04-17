import React, { useCallback } from 'react';
import { View, Pressable, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

type CardVariant = 'default' | 'elevated' | 'outlined';

interface ThemedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: CardVariant;
  padding?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ThemedCard: React.FC<ThemedCardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
  padding,
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (onPress) {
      scale.value = withTiming(0.98, { duration: 100 });
    }
  }, [onPress, scale]);

  const handlePressOut = useCallback(() => {
    if (onPress) {
      scale.value = withTiming(1, { duration: 100 });
    }
  }, [onPress, scale]);

  const getVariantStyle = (): ViewStyle => {
    const base: ViewStyle = {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      padding: padding ?? theme.spacing.lg,
    };

    switch (variant) {
      case 'default':
        return { ...base, ...theme.shadows.sm };
      case 'elevated':
        return { ...base, ...theme.shadows.md };
      case 'outlined':
        return {
          ...base,
          borderWidth: 1,
          borderColor: theme.colors.borderLight,
        };
      default:
        return base;
    }
  };

  const cardStyle = getVariantStyle();

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animatedStyle, cardStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

export default ThemedCard;
