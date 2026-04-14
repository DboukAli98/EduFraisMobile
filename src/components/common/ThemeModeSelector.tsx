import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../../theme';
import { useAppDispatch } from '../../hooks';
import { setThemeMode as setThemeModeAction } from '../../store/slices/appSlice';
import ThemedText from './ThemedText';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: ThemeOption[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

const ThemeModeSelector: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const dispatch = useAppDispatch();

  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      dispatch(setThemeModeAction(mode));
    },
    [setThemeMode, dispatch],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.inputBackground,
          borderRadius: theme.borderRadius.lg,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const isActive = themeMode === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => handleSelect(option.mode)}
            style={[
              styles.option,
              { borderRadius: theme.borderRadius.md },
              isActive && { backgroundColor: theme.colors.primary },
            ]}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
              style={styles.icon}
            />
            <ThemedText
              variant="caption"
              color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ fontWeight: '600' }}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 4,
  },
});

export default ThemeModeSelector;
