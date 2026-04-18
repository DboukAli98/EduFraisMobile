import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

const AnimatedView = Animated.createAnimatedComponent(View);

const ThemedInput: React.FC<ThemedInputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  editable = true,
  multiline,
  ...rest
}) => {
  const { theme } = useTheme();
  const focusAnim = useSharedValue(0);

  const handleFocus = useCallback(
    (e: any) => {
      focusAnim.value = withTiming(1, { duration: 200 });
      rest.onFocus?.(e);
    },
    [focusAnim, rest.onFocus],
  );

  const handleBlur = useCallback(
    (e: any) => {
      focusAnim.value = withTiming(0, { duration: 200 });
      rest.onBlur?.(e);
    },
    [focusAnim, rest.onBlur],
  );

  const borderColor = error
    ? theme.colors.error
    : theme.colors.border;
  const focusBorderColor = error
    ? theme.colors.error
    : theme.colors.primary;

  const animatedBorderStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      focusAnim.value,
      [0, 1],
      [borderColor, focusBorderColor],
    );
    return { borderColor: color };
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <ThemedText
          variant="bodySmall"
          color={theme.colors.textSecondary}
          style={styles.label}
        >
          {label}
        </ThemedText>
      )}
      <AnimatedView
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.inputBackground,
            borderRadius: theme.borderRadius.lg,
          },
          animatedBorderStyle,
          multiline && styles.multiline,
          !editable && { opacity: 0.6 },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.body.fontFamily,
              fontSize: theme.typography.body.fontSize,
              letterSpacing: theme.typography.body.letterSpacing,
              fontWeight: theme.typography.body.fontWeight,
            },
            multiline && styles.multilineInput,
          ]}
          placeholderTextColor={theme.colors.textTertiary}
          editable={editable}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </AnimatedView>
      {error && (
        <ThemedText
          variant="caption"
          color={theme.colors.error}
          style={styles.errorText}
        >
          {error}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontSize: 14,
  },
  multiline: {
    height: undefined,
    minHeight: 100,
    alignItems: 'flex-start',
  },
  multilineInput: {
    textAlignVertical: 'top',
    height: undefined,
    paddingVertical: 12,
  },
  leftIcon: {
    paddingLeft: 12,
    justifyContent: 'center',
    height: '100%',
  },
  rightIcon: {
    paddingRight: 12,
  },
  errorText: {
    marginTop: 4,
  },
});

export default ThemedInput;
