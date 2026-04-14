import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
} from '../../components';
import { useAnimatedEntry } from '../../hooks';
import { useResetPasswordInitMutation } from '../../services/api/apiSlice';
import { useTheme } from '../../theme';
import { COUNTRY_CODE } from '../../constants';

const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();

  const [resetPasswordInit] = useResetPasswordInitMutation();
  const [countryCode] = useState(COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  // Animations
  const headerAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0 });
  const formAnim = useAnimatedEntry({ type: 'slideUp', delay: 150 });
  const successAnim = useAnimatedEntry({ type: 'scaleIn', delay: 0, duration: 500 });

  const handleSendReset = useCallback(async () => {
    if (!phone.trim() || phone.length < 9) {
      setError(t('auth.phoneRequired'));
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await resetPasswordInit({
        CountryCode: COUNTRY_CODE,
        MobileNumber: phone,
      }).unwrap();
      setIsSent(true);
    } catch (err: any) {
      const message =
        err?.data?.Message || err?.data?.error || err?.message || t('common.error');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [phone, resetPasswordInit, t]);

  return (
    <ScreenContainer scrollable={false} padding>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
      </Animated.View>

      {isSent ? (
        /* Success State */
        <Animated.View style={[styles.successContainer, successAnim]}>
          <View
            style={[
              styles.successIconCircle,
              { backgroundColor: theme.colors.success + '15' },
            ]}
          >
            <View
              style={[
                styles.successIconInner,
                { backgroundColor: theme.colors.success + '25' },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={theme.colors.success}
              />
            </View>
          </View>

          <ThemedText variant="h2" align="center" style={styles.successTitle}>
            {t('auth.resetSent')}
          </ThemedText>
          <ThemedText
            variant="body"
            align="center"
            color={theme.colors.textSecondary}
            style={styles.successDesc}
          >
            {t('auth.resetSentDesc')}
          </ThemedText>

          <ThemedButton
            title={t('auth.backToSignIn')}
            onPress={() => router.replace('/(auth)/sign-in')}
            size="lg"
            fullWidth
            style={styles.successButton}
          />
        </Animated.View>
      ) : (
        /* Form State */
        <Animated.View style={[styles.formContainer, formAnim]}>
          <View style={styles.iconHeader}>
            <View
              style={[
                styles.lockIconCircle,
                { backgroundColor: theme.colors.primary + '12' },
              ]}
            >
              <Ionicons
                name="lock-open-outline"
                size={40}
                color={theme.colors.primary}
              />
            </View>
          </View>

          <ThemedText variant="h2" style={styles.title}>
            {t('auth.resetPassword')}
          </ThemedText>
          <ThemedText
            variant="body"
            color={theme.colors.textSecondary}
            style={styles.description}
          >
            {t('auth.resetPasswordDesc')}
          </ThemedText>

          {/* Phone Number with inline country code */}
          <ThemedInput
            label={t('auth.phone')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (error) setError('');
            }}
            placeholder="812 345 678"
            keyboardType="phone-pad"
            error={error}
            leftIcon={
              <View style={styles.countryCodeInline}>
                <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                  {countryCode}
                </ThemedText>
                <View style={[styles.codeDivider, { backgroundColor: theme.colors.border }]} />
              </View>
            }
          />

          <ThemedButton
            title={t('auth.sendResetLink')}
            onPress={handleSendReset}
            size="lg"
            fullWidth
            loading={isLoading}
            style={styles.sendButton}
          />

          <View style={styles.signInRow}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('auth.rememberPassword')}{' '}
            </ThemedText>
            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              hitSlop={8}
            >
              <ThemedText
                variant="bodySmall"
                color={theme.colors.primary}
                style={styles.linkText}
              >
                {t('auth.signIn')}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  formContainer: {
    flex: 1,
    paddingTop: 16,
  },
  iconHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 32,
  },
  countryCodeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  codeDivider: {
    width: 1,
    height: 20,
    marginLeft: 10,
  },
  sendButton: {
    marginTop: 8,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  successIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  successIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    marginBottom: 12,
  },
  successDesc: {
    maxWidth: 300,
    marginBottom: 40,
  },
  successButton: {
    marginTop: 8,
  },
});

export default ForgotPasswordScreen;
