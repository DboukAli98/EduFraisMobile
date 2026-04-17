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
import {
  useResetPasswordInitMutation,
  useResetPasswordFinalMutation,
} from '../../services/api/apiSlice';
import { useTheme } from '../../theme';
import { COUNTRY_CODE } from '../../constants';

type Step = 'identifier' | 'verify' | 'done';
type Channel = 'whatsapp' | 'email';
type IdentifierMode = 'phone' | 'email';

const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();

  const [resetPasswordInit, { isLoading: isInitLoading }] =
    useResetPasswordInitMutation();
  const [resetPasswordFinal, { isLoading: isFinalLoading }] =
    useResetPasswordFinalMutation();

  const [step, setStep] = useState<Step>('identifier');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [identifierMode, setIdentifierMode] = useState<IdentifierMode>('phone');
  const [countryCode] = useState(COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const headerAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0 });
  const formAnim = useAnimatedEntry({ type: 'slideUp', delay: 150 });
  const successAnim = useAnimatedEntry({
    type: 'scaleIn',
    delay: 0,
    duration: 500,
  });

  const buildIdentifierPayload = useCallback(() => {
    if (identifierMode === 'email') {
      return { Email: email.trim() };
    }
    return { CountryCode: countryCode, MobileNumber: phone.trim() };
  }, [identifierMode, email, phone, countryCode]);

  const validateIdentifier = useCallback((): string | null => {
    if (identifierMode === 'email') {
      if (!email.trim()) return t('auth.emailRequired');
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return t('auth.emailInvalid');
    } else {
      if (!phone.trim()) return t('auth.phoneRequired');
      if (phone.replace(/\D/g, '').length < 8)
        return t('auth.phoneMinLength');
    }
    return null;
  }, [identifierMode, email, phone, t]);

  const handleSendCode = useCallback(async () => {
    const validationError = validateIdentifier();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    try {
      await resetPasswordInit({
        ...buildIdentifierPayload(),
        Channel: channel,
      } as any).unwrap();
      setStep('verify');
    } catch (err: any) {
      const message =
        err?.data?.message ||
        err?.data?.Message ||
        err?.data?.error ||
        err?.message ||
        t('common.error');
      setError(message);
    }
  }, [
    validateIdentifier,
    resetPasswordInit,
    buildIdentifierPayload,
    channel,
    t,
  ]);

  const handleVerifyAndReset = useCallback(async () => {
    if (!otp.trim() || otp.trim().length < 6) {
      setError(t('auth.otpInvalid'));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setError('');
    try {
      await resetPasswordFinal({
        ...buildIdentifierPayload(),
        Token: otp.trim(),
        NewPassword: newPassword,
      } as any).unwrap();
      setStep('done');
    } catch (err: any) {
      const message =
        err?.data?.Message ||
        err?.data?.error ||
        err?.message ||
        t('common.error');
      setError(message);
    }
  }, [
    otp,
    newPassword,
    confirmPassword,
    resetPasswordFinal,
    buildIdentifierPayload,
    t,
  ]);

  const handleResendCode = useCallback(() => {
    setOtp('');
    setError('');
    setStep('identifier');
  }, []);

  const renderChannelChip = (value: Channel, label: string, iconName: any) => {
    const selected = channel === value;
    return (
      <Pressable
        onPress={() => setChannel(value)}
        style={[
          styles.channelChip,
          {
            borderColor: selected
              ? theme.colors.primary
              : theme.colors.border,
            backgroundColor: selected
              ? theme.colors.primary + '12'
              : 'transparent',
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={18}
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
        />
        <ThemedText
          variant="bodySmall"
          color={selected ? theme.colors.primary : theme.colors.textSecondary}
          style={styles.channelChipLabel}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  const renderIdentifierStep = () => (
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

      {/* Channel picker */}
      <ThemedText
        variant="bodySmall"
        color={theme.colors.textSecondary}
        style={styles.sectionLabel}
      >
        {t('auth.otpChannelLabel')}
      </ThemedText>
      <View style={styles.channelRow}>
        {renderChannelChip('whatsapp', t('auth.channelWhatsApp'), 'logo-whatsapp')}
        {renderChannelChip('email', t('auth.channelEmail'), 'mail-outline')}
      </View>

      {/* Identifier mode toggle */}
      <View style={styles.modeToggleRow}>
        <Pressable
          onPress={() => {
            setIdentifierMode('phone');
            setError('');
          }}
          style={[
            styles.modeToggleButton,
            identifierMode === 'phone' && {
              backgroundColor: theme.colors.primary + '12',
              borderColor: theme.colors.primary,
            },
            { borderColor: theme.colors.border },
          ]}
        >
          <ThemedText
            variant="bodySmall"
            color={
              identifierMode === 'phone'
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          >
            {t('auth.phone')}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            setIdentifierMode('email');
            setError('');
          }}
          style={[
            styles.modeToggleButton,
            identifierMode === 'email' && {
              backgroundColor: theme.colors.primary + '12',
              borderColor: theme.colors.primary,
            },
            { borderColor: theme.colors.border },
          ]}
        >
          <ThemedText
            variant="bodySmall"
            color={
              identifierMode === 'email'
                ? theme.colors.primary
                : theme.colors.textSecondary
            }
          >
            {t('auth.email')}
          </ThemedText>
        </Pressable>
      </View>

      {identifierMode === 'phone' ? (
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
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
              >
                {countryCode}
              </ThemedText>
              <View
                style={[
                  styles.codeDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />
            </View>
          }
        />
      ) : (
        <ThemedInput
          label={t('auth.email')}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError('');
          }}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={error}
        />
      )}

      <ThemedButton
        title={t('auth.sendOtpCode')}
        onPress={handleSendCode}
        size="lg"
        fullWidth
        loading={isInitLoading}
        style={styles.sendButton}
      />

      <View style={styles.signInRow}>
        <ThemedText
          variant="bodySmall"
          color={theme.colors.textSecondary}
        >
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
  );

  const renderVerifyStep = () => (
    <Animated.View style={[styles.formContainer, formAnim]}>
      <View style={styles.iconHeader}>
        <View
          style={[
            styles.lockIconCircle,
            { backgroundColor: theme.colors.primary + '12' },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={40}
            color={theme.colors.primary}
          />
        </View>
      </View>

      <ThemedText variant="h2" style={styles.title}>
        {t('auth.otpVerifyTitle')}
      </ThemedText>
      <ThemedText
        variant="body"
        color={theme.colors.textSecondary}
        style={styles.description}
      >
        {t('auth.otpVerifyDesc')}
      </ThemedText>

      <ThemedInput
        label={t('auth.otpCodeLabel')}
        value={otp}
        onChangeText={(text) => {
          setOtp(text.replace(/\D/g, '').slice(0, 6));
          if (error) setError('');
        }}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        error={error}
      />

      <ThemedInput
        label={t('auth.newPassword')}
        value={newPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          if (error) setError('');
        }}
        placeholder="••••••••"
        secureTextEntry
      />

      <ThemedInput
        label={t('auth.confirmPassword')}
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          if (error) setError('');
        }}
        placeholder="••••••••"
        secureTextEntry
      />

      <ThemedButton
        title={t('auth.otpVerifyAndReset')}
        onPress={handleVerifyAndReset}
        size="lg"
        fullWidth
        loading={isFinalLoading}
        style={styles.sendButton}
      />

      <View style={styles.signInRow}>
        <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
          {t('auth.otpResendPrompt')}{' '}
        </ThemedText>
        <Pressable onPress={handleResendCode} hitSlop={8}>
          <ThemedText
            variant="bodySmall"
            color={theme.colors.primary}
            style={styles.linkText}
          >
            {t('auth.otpResend')}
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderDoneStep = () => (
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
        {t('auth.otpResetDoneTitle')}
      </ThemedText>
      <ThemedText
        variant="body"
        align="center"
        color={theme.colors.textSecondary}
        style={styles.successDesc}
      >
        {t('auth.otpResetDoneDesc')}
      </ThemedText>

      <ThemedButton
        title={t('auth.backToSignIn')}
        onPress={() => router.replace('/(auth)/sign-in')}
        size="lg"
        fullWidth
        style={styles.successButton}
      />
    </Animated.View>
  );

  return (
    <ScreenContainer scrollable padding>
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable
          onPress={() => {
            if (step === 'verify') {
              setStep('identifier');
              setError('');
              return;
            }
            router.back();
          }}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
      </Animated.View>

      {step === 'identifier' && renderIdentifierStep()}
      {step === 'verify' && renderVerifyStep()}
      {step === 'done' && renderDoneStep()}
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
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  channelRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginRight: 10,
  },
  channelChipLabel: {
    marginLeft: 6,
    fontWeight: '600',
  },
  modeToggleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
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
