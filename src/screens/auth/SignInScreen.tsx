import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, Switch } from 'react-native';
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
import { useAuth, useAnimatedEntry } from '../../hooks';
import { useTheme } from '../../theme';
import { COUNTRY_CODE } from '../../constants';

const SignInScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { login } = useAuth();
  const router = useRouter();

  const [countryCode] = useState(COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>(
    {},
  );
  const [apiError, setApiError] = useState('');

  // Staggered entry animations
  const logoAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0, duration: 400 });
  const formAnim = useAnimatedEntry({
    type: 'slideUp',
    delay: 200,
    duration: 500,
  });
  const buttonAnim = useAnimatedEntry({
    type: 'slideUp',
    delay: 400,
    duration: 500,
  });

  const validate = useCallback((): boolean => {
    const newErrors: typeof errors = {};
    if (!phone.trim() || phone.length < 6) {
      newErrors.phone = t('auth.phoneRequired');
    }
    if (!password.trim() || password.length < 6) {
      newErrors.password = t('auth.passwordMinLength');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [phone, password, t]);

  const handleSignIn = useCallback(async () => {
    if (!validate()) return;

    setApiError('');
    setIsLoading(true);
    try {
      const result = await login({
        CountryCode: COUNTRY_CODE,
        MobileNumber: phone,
        Password: password,
      });

      if (result.success) {
        router.replace('/(app)/dashboard');
      } else {
        setApiError(result.message || t('auth.invalidCredentials'));
      }
    } catch (err: any) {
      const message =
        err?.data?.message || err?.data?.Message || err?.message || t('auth.invalidCredentials');
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  }, [validate, phone, password, login, router, t]);

  return (
    <ScreenContainer scrollable padding>
      {/* Logo + Welcome */}
      <Animated.View style={[styles.logoSection, logoAnim]}>
        <View style={styles.logoContainer}>
          <ThemedText
            variant="display"
            color={theme.colors.primary}
            style={styles.logoText}
          >
            EduFrais
          </ThemedText>
          <View
            style={[styles.logoDot, { backgroundColor: theme.colors.accent }]}
          />
        </View>
        <ThemedText variant="h2" style={styles.welcomeTitle}>
          {t('auth.welcome')}
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          style={styles.welcomeSubtitle}
        >
          {t('auth.welcomeSubtitle')}
        </ThemedText>
      </Animated.View>

      {/* Form */}
      <Animated.View style={[styles.formSection, formAnim]}>
        {/* Phone Number with inline country code */}
        <ThemedInput
          label={t('auth.phone')}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
          }}
          placeholder="06 812 345 678"
          keyboardType="phone-pad"
          error={errors.phone}
          leftIcon={
            <View style={styles.countryCodeInline}>
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {countryCode}
              </ThemedText>
              <View style={[styles.codeDivider, { backgroundColor: theme.colors.border }]} />
            </View>
          }
        />

        {/* Password */}
        <ThemedInput
          label={t('auth.password')}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="********"
          secureTextEntry={!showPassword}
          error={errors.password}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={theme.colors.textTertiary}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          }
        />

        {/* Remember Me + Forgot Password Row */}
        <View style={styles.optionsRow}>
          <View style={styles.rememberRow}>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{
                false: theme.colors.disabled,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                rememberMe ? theme.colors.primary : theme.colors.surface
              }
              style={styles.switch}
            />
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('auth.rememberMe')}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={8}
          >
            <ThemedText
              variant="bodySmall"
              color={theme.colors.primary}
              style={styles.linkText}
            >
              {t('auth.forgotPassword')}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {/* API Error */}
      {apiError ? (
        <ThemedText
          variant="bodySmall"
          color={theme.colors.error}
          align="center"
          style={styles.apiError}
        >
          {apiError}
        </ThemedText>
      ) : null}

      {/* Sign In Button + Sign Up Link */}
      <Animated.View style={[styles.buttonSection, buttonAnim]}>
        <ThemedButton
          title={t('auth.signIn')}
          onPress={handleSignIn}
          size="lg"
          fullWidth
          loading={isLoading}
        />

        <View style={styles.signUpRow}>
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {t('auth.noAccount')}{' '}
          </ThemedText>
          <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={8}>
            <ThemedText
              variant="bodySmall"
              color={theme.colors.primary}
              style={styles.linkText}
            >
              {t('auth.signUp')}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  logoSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  logoText: {
    letterSpacing: -1,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    marginLeft: 2,
  },
  welcomeTitle: {
    marginBottom: 8,
  },
  welcomeSubtitle: {
    textAlign: 'center',
  },
  formSection: {
    paddingTop: 8,
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    transform: [{ scale: 0.8 }],
  },
  linkText: {
    fontWeight: '600',
  },
  apiError: {
    marginTop: 12,
    marginBottom: 4,
  },
  buttonSection: {
    paddingTop: 24,
    gap: 24,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SignInScreen;
