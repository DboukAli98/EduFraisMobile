import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
} from '../../components';
import { useAnimatedEntry, useAppSelector, useAppDispatch } from '../../hooks';
import { useChangePasswordMutation } from '../../services/api/apiSlice';
import { useTheme } from '../../theme';
import { logout as logoutAction } from '../../store/slices/authSlice';

/**
 * Shown after a user (typically a newly-created collecting agent) signs in
 * with an auto-generated password. Login still succeeds and we have a valid
 * JWT in state, but the user cannot enter the app until they set a new
 * password.
 *
 * The router replaces to this screen from SignInScreen when the backend
 * login response has `mustChangePassword: true`. The sign-in screen passes
 * the current (auto-generated) password via route params so the user doesn't
 * have to re-type it.
 */
const ChangePasswordRequiredScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const params = useLocalSearchParams<{ userId?: string; currentPassword?: string }>();

  // Prefer userId coming via navigation params; fall back to the decoded JWT
  // in redux state (same id) so the screen works even on hot-reload.
  const userFromState = useAppSelector((state) => state.auth.user);
  const tokenFromState = useAppSelector((state) => state.auth.token);
  const userId = (params.userId as string) || userFromState?.id || '';

  const [currentPassword, setCurrentPassword] = useState<string>(
    (params.currentPassword as string) || '',
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const headerAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0 });
  const formAnim = useAnimatedEntry({ type: 'slideUp', delay: 150 });

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!userId) {
      setError(
        t(
          'auth.changePasswordRequired.missingUser',
          'User session is missing. Please sign in again.',
        ),
      );
      return;
    }

    if (!currentPassword.trim()) {
      setError(
        t(
          'auth.changePasswordRequired.currentRequired',
          'Enter your current (temporary) password.',
        ),
      );
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError(
        t(
          'auth.changePasswordRequired.tooShort',
          'The new password must be at least 6 characters.',
        ),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        t(
          'auth.changePasswordRequired.mismatch',
          'The new password and its confirmation do not match.',
        ),
      );
      return;
    }

    if (newPassword === currentPassword) {
      setError(
        t(
          'auth.changePasswordRequired.sameAsCurrent',
          'The new password must be different from the temporary one.',
        ),
      );
      return;
    }

    try {
      await changePassword({
        userId,
        currentPassword,
        newPassword,
      }).unwrap();

      Alert.alert(
        t('common.success', 'Success'),
        t(
          'auth.changePasswordRequired.successMessage',
          'Your password has been updated. Please sign in again with your new password.',
        ),
        [
          {
            text: 'OK',
            onPress: () => {
              // Drop the session we have (issued against the old password) and
              // send the user back to the sign-in screen with a clean slate.
              dispatch(logoutAction());
              router.replace('/(auth)/sign-in');
            },
          },
        ],
      );
    } catch (err: any) {
      const message =
        err?.data?.error ||
        err?.data?.Error ||
        err?.data?.message ||
        err?.message ||
        t('auth.changePasswordRequired.genericError', 'Could not update the password.');
      setError(message);
    }
  }, [
    userId,
    currentPassword,
    newPassword,
    confirmPassword,
    changePassword,
    dispatch,
    router,
    t,
  ]);

  const handleCancel = useCallback(() => {
    // Cancelling force-change means they must log in again, so clear state.
    Alert.alert(
      t('auth.changePasswordRequired.cancelTitle', 'Skip password change?'),
      t(
        'auth.changePasswordRequired.cancelBody',
        'You will be signed out and will have to sign in again. Continue?',
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.signOut', 'Sign Out'),
          style: 'destructive',
          onPress: () => {
            dispatch(logoutAction());
            router.replace('/(auth)/sign-in');
          },
        },
      ],
    );
  }, [dispatch, router, t]);

  return (
    <ScreenContainer scrollable padding>
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable onPress={handleCancel} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.formContainer, formAnim]}>
        <View style={styles.iconHeader}>
          <View
            style={[
              styles.lockIconCircle,
              { backgroundColor: theme.colors.primary + '12' },
            ]}
          >
            <Ionicons name="key-outline" size={40} color={theme.colors.primary} />
          </View>
        </View>

        <ThemedText variant="h2" style={styles.title}>
          {t('auth.changePasswordRequired.title', 'Update your password')}
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          style={styles.description}
        >
          {t(
            'auth.changePasswordRequired.description',
            'For security, please replace the temporary password you received with a personal one before continuing.',
          )}
        </ThemedText>

        <ThemedInput
          label={t('auth.changePasswordRequired.currentLabel', 'Current (temporary) password')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="********"
          secureTextEntry={!showCurrent}
          leftIcon={
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textTertiary} />
          }
          rightIcon={
            <Pressable onPress={() => setShowCurrent((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          }
        />

        <ThemedInput
          label={t('auth.changePasswordRequired.newLabel', 'New password')}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="********"
          secureTextEntry={!showNew}
          leftIcon={
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.textTertiary} />
          }
          rightIcon={
            <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          }
        />

        <ThemedInput
          label={t('auth.changePasswordRequired.confirmLabel', 'Confirm new password')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="********"
          secureTextEntry={!showConfirm}
          leftIcon={
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.textTertiary} />
          }
          rightIcon={
            <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          }
        />

        {error ? (
          <ThemedText
            variant="bodySmall"
            color={theme.colors.error}
            align="center"
            style={styles.error}
          >
            {error}
          </ThemedText>
        ) : null}

        <ThemedButton
          title={t('auth.changePasswordRequired.submit', 'Update password')}
          onPress={handleSubmit}
          size="lg"
          fullWidth
          loading={isLoading}
          style={styles.submitButton}
          disabled={!tokenFromState}
        />
      </Animated.View>
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
  error: {
    marginTop: 12,
  },
  submitButton: {
    marginTop: 16,
  },
});

export default ChangePasswordRequiredScreen;
