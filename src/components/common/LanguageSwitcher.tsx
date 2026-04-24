import React, { useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setLanguage } from '../../store/slices/appSlice';
import i18n from '../../i18n';
import ThemedText from './ThemedText';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const LANGUAGES = ['fr', 'en'] as const;
const LABELS: Record<(typeof LANGUAGES)[number], string> = {
  en: 'EN',
  fr: 'FR',
};

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
}) => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const currentLanguage = useAppSelector((state) => state.app.language);

  useEffect(() => {
    if (i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  const handleLanguageChange = useCallback(
    (lang: 'en' | 'fr') => {
      i18n.changeLanguage(lang);
      dispatch(setLanguage(lang));
    },
    [dispatch],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.inputBackground,
          borderRadius: compact
            ? theme.borderRadius.full
            : theme.borderRadius.lg,
        },
        compact && styles.compact,
      ]}
    >
      {LANGUAGES.map((lang) => {
        const isActive = currentLanguage === lang;
        return (
          <Pressable
            key={lang}
            onPress={() => handleLanguageChange(lang)}
            style={[
              styles.option,
              compact && styles.compactOption,
              {
                borderRadius: compact
                  ? theme.borderRadius.full
                  : theme.borderRadius.md,
              },
              isActive && {
                backgroundColor: theme.colors.primary,
              },
            ]}
          >
            <ThemedText
              variant={compact ? 'caption' : 'bodySmall'}
              color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ fontWeight: '600' }}
            >
              {LABELS[lang]}
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
  compact: {
    padding: 2,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

export default LanguageSwitcher;
