import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Switch, Modal, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import {
  useAnimatedEntry,
  staggerDelay,
  useAuth,
  useAppSelector,
  useAppDispatch,
  enableOneSignalPush,
  disableOneSignalPush,
} from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ThemedInput,
  Avatar,
  SectionHeader,
  UserRoleChip,
  ThemeModeSelector,
  LanguageSwitcher,
} from '../../components';
import { setPushNotificationsEnabled, setEmailNotificationsEnabled, setBiometricEnabled } from '../../store/slices/appSlice';
import { updateUser } from '../../store/slices/authSlice';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  saveCredentials,
  getStoredCredentials,
  clearStoredCredentials,
} from '../../services/biometric';
import {
  useChangePasswordMutation,
  useSendTestEmailMutation,
  useUpdateParentMutation,
  useUpdateDirectorMutation,
  useEditAgentMutation,
  useGetSingleParentQuery,
  useGetSchoolDirectorQuery,
  useGetAgentDetailsQuery,
  useSendNotificationMutation,
} from '../../services/api/apiSlice';
import type { UserRole } from '../../types';
import { COUNTRY_CODE } from '../../constants';
import { normalizePhoneToE164, extractLocalDigits } from '../../utils';

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 80),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  iconColor?: string;
  subtitle?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  onPress,
  rightElement,
  showChevron = true,
  iconColor,
  subtitle,
}) => {
  const { theme } = useTheme();
  const color = iconColor ?? theme.colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && onPress && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.settingsRowIcon,
          { backgroundColor: color + '15', borderRadius: theme.borderRadius.md },
        ]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.settingsRowLabel}>
        <ThemedText variant="body">{label}</ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color={theme.colors.textTertiary} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement ?? (
        showChevron && onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textTertiary}
          />
        ) : null
      )}
    </Pressable>
  );
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { logout } = useAuth();
  const user = useAppSelector((state) => state.auth.user);
  const pushNotifications = useAppSelector((state) => state.app.pushNotificationsEnabled);
  const pushRegistered = useAppSelector((state) => state.notifications.pushRegistered);
  const emailNotifications = useAppSelector((state) => state.app.emailNotificationsEnabled);
  const biometricLogin = useAppSelector((state) => state.app.biometricEnabled);

  // The toggle reflects the user's *intent*. `pushRegistered` is a
  // diagnostic (did the backend hear about the player id yet?) and
  // lags by seconds on a cold start while FCM does its handshake —
  // gating the toggle on it was flipping it OFF right after the user
  // had tapped "Enable", which looked to them like the setting never
  // took. If the registration later fails we show that as a status
  // line under the toggle rather than moving the toggle itself.
  const pushToggleValue = pushNotifications;

  // Extract name parts from full name
  const nameParts = (user?.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const userRole = (user?.role || 'User') as UserRole;
  const entityId = parseInt(user?.entityUserId || '0');
  const schoolId = parseInt(user?.schoolId?.split(',')[0] || '0');
  const isParent = userRole.toLowerCase() === 'parent';
  const isDirector = userRole.toLowerCase() === 'director';
  const isAgent = userRole.toLowerCase() === 'agent';
  const isManager = userRole.toLowerCase() === 'manager';

  // ── State ──
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [aboutModal, setAboutModal] = useState<'terms' | 'privacy' | 'help' | null>(null);

  // Profile form
  const [profileFirstName, setProfileFirstName] = useState(firstName);
  const [profileLastName, setProfileLastName] = useState(lastName);
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePhone, setProfilePhone] = useState(user?.phoneNumber || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // ── API ──
  const [changePassword, { isLoading: isChangingPw }] = useChangePasswordMutation();
  const [updateParent, { isLoading: isUpdatingParent }] = useUpdateParentMutation();
  const [updateDirector, { isLoading: isUpdatingDirector }] = useUpdateDirectorMutation();
  const [editAgent, { isLoading: isUpdatingAgent }] = useEditAgentMutation();
  const [sendNotification] = useSendNotificationMutation();
  const [sendTestEmail] = useSendTestEmailMutation();

  // Fetch full entity data for profile edit
  const { data: parentData } = useGetSingleParentQuery(
    { parentId: entityId },
    { skip: !isParent || !entityId },
  );
  const { data: agentData } = useGetAgentDetailsQuery(
    { agentId: entityId },
    { skip: !isAgent || !entityId },
  );
  const { data: directorData } = useGetSchoolDirectorQuery(
    { schoolId },
    { skip: (!isDirector && !isManager) || !schoolId },
  );

  // Sync profile form when data loads
  useEffect(() => {
    if (isParent && parentData?.data) {
      const p = parentData.data;
      setProfileFirstName(p.firstName);
      setProfileLastName(p.lastName);
      setProfileEmail(p.email || '');
      setProfilePhone(extractLocalDigits(p.phoneNumber || '', COUNTRY_CODE));
    } else if ((isDirector || isManager) && directorData?.data) {
      const d = directorData.data;
      setProfileFirstName(d.firstName);
      setProfileLastName(d.lastName);
      setProfileEmail(d.email || '');
      setProfilePhone(extractLocalDigits(d.phoneNumber || '', COUNTRY_CODE));
    } else if (isAgent && agentData?.data) {
      const a = agentData.data;
      setProfileFirstName(a.firstName);
      setProfileLastName(a.lastName);
      setProfileEmail(a.email || '');
      setProfilePhone(extractLocalDigits(a.phoneNumber || '', COUNTRY_CODE));
    }
  }, [parentData, directorData, agentData, isParent, isDirector, isAgent, isManager]);

  // ── Toggle handlers with test popup ──
  const handlePushToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        // User wants push ON. Always call enableOneSignalPush — it's
        // idempotent (requestPermission returns the cached OS answer
        // instantly if already granted) and the `optIn()` it fires is
        // what actually flips a stuck "Opted Out" subscription back
        // to "Subscribed". Skipping this call when pushRegistered was
        // true (from a prior session's backend POST) was the reason a
        // toggle OFF→ON cycle couldn't recover an opted-out device.
        const result = await enableOneSignalPush();
        if (result.status === 'denied') {
          // iOS remembers a previous "Don't Allow" and resolves
          // immediately as denied without re-prompting. The only way
          // out is system Settings, so offer that directly.
          dispatch(setPushNotificationsEnabled(false));
          Alert.alert(
            t('push.deniedTitle', 'Permission denied'),
            t(
              'push.deniedMessageOpenSettings',
              'Push notifications are blocked. Open Settings to allow them.',
            ),
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              {
                text: t('push.openSettings', 'Open Settings'),
                onPress: () => {
                  Linking.openSettings().catch(() => { });
                },
              },
            ],
          );
          return;
        }
        if (result.status === 'unavailable') {
          // Expo Go or SDK init failure — push isn't available in
          // this build. Tell the user instead of silently failing.
          dispatch(setPushNotificationsEnabled(false));
          Alert.alert(
            t('push.unavailableTitle', 'Push not available'),
            t(
              'push.unavailableMessage',
              "This build doesn't support push notifications. Install the development build to test them on a real device.",
            ),
          );
          return;
        }
        // status === 'granted'. result.playerId may still be null on
        // first launch — that's fine, the registration hook's change
        // listener will catch it within a few seconds and POST it.
        dispatch(setPushNotificationsEnabled(true));
        if (user) {
          Alert.alert(
            t('settings.pushEnabled', 'Push Notifications Enabled'),
            t(
              'settings.pushEnabledDesc',
              'You will now receive real-time notifications. Sending a test notification...',
            ),
            [
              {
                text: t('settings.sendTest', 'Send Test'),
                onPress: () => {
                  sendNotification({
                    userId: user.id,
                    title: t('settings.testNotification', 'Test Notification'),
                    message: t(
                      'settings.testNotificationMsg',
                      'Push notifications are working correctly!',
                    ),
                    type: 'General',
                    isRead: false,
                  }).catch(() => { });
                  Alert.alert(
                    t('common.success', 'Success'),
                    t(
                      'settings.testSent',
                      'Test notification sent! Check the notifications tab.',
                    ),
                  );
                },
              },
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            ],
          );
        }
      } else {
        // User wants push OFF. Opt out at the SDK level so the device
        // actually stops receiving native pushes, then flip intent.
        disableOneSignalPush();
        dispatch(setPushNotificationsEnabled(false));
      }
    },
    [dispatch, user, sendNotification, t],
  );

  const handleEmailToggle = useCallback(
    (value: boolean) => {
      dispatch(setEmailNotificationsEnabled(value));
      if (value && user?.email) {
        Alert.alert(
          t('settings.emailEnabled', 'Email Notifications Enabled'),
          t('settings.emailEnabledDesc', 'You will receive email notifications for payments, approvals, and reminders at: {email}').replace('{email}', user.email),
          [
            {
              text: t('settings.sendTest', 'Send Test'),
              onPress: () => {
                sendTestEmail({ email: user.email })
                  .unwrap()
                  .then(() => {
                    Alert.alert(t('common.success', 'Success'), t('settings.testEmailSent', 'Test email sent! Check your inbox at {email}.').replace('{email}', user.email));
                  })
                  .catch(() => {
                    Alert.alert(t('common.error', 'Error'), t('settings.testEmailFailed', 'Failed to send test email. Please check your email address.'));
                  });
              },
            },
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          ],
        );
      } else if (value && !user?.email) {
        Alert.alert(
          t('settings.emailEnabled', 'Email Notifications Enabled'),
          t('settings.noEmailSet', 'No email address on file. Please update your profile to receive email notifications.'),
          [{ text: t('common.ok', 'OK') }],
        );
      }
    },
    [dispatch, user, sendTestEmail, t],
  );

  // ── Biometric Toggle ──
  const [biometricLoading, setBiometricLoading] = useState(false);
  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        // Enabling: check hardware, then prompt to confirm identity
        setBiometricLoading(true);
        try {
          const available = await isBiometricAvailable();
          if (!available) {
            Alert.alert(
              t('settings.biometricUnavailable', 'Biometric Unavailable'),
              t('settings.biometricUnavailableDesc', 'Your device does not support biometric authentication or has no biometric enrolled.'),
            );
            return;
          }
          const success = await authenticateWithBiometric(
            t('settings.biometricConfirm', 'Confirm your identity to enable biometric login'),
          );
          if (!success) return;

          // Enable biometric in state first so the toggle reflects immediately
          dispatch(setBiometricEnabled(true));

          // On iOS we can prompt for password inline; on Android credentials
          // will be saved automatically on the next password sign-in.
          if (typeof Alert.prompt === 'function') {
            Alert.prompt(
              t('settings.biometricEnterPassword', 'Enter Password'),
              t('settings.biometricEnterPasswordDesc', 'Enter your password to save it for biometric login.'),
              async (pw: string) => {
                if (!pw) return;
                await saveCredentials({
                  countryCode: '242',
                  mobileNumber: user?.phoneNumber || '',
                  password: pw,
                });
                Alert.alert(t('common.success', 'Success'), t('settings.biometricEnabled', 'Biometric login enabled! You can now sign in with your fingerprint or face.'));
              },
              'secure-text',
            );
          } else {
            Alert.alert(
              t('common.success', 'Success'),
              t('settings.biometricEnabledNextLogin', 'Biometric login enabled! Your credentials will be saved on your next password sign-in.'),
            );
          }
        } finally {
          setBiometricLoading(false);
        }
      } else {
        // Disabling: clear stored credentials
        await clearStoredCredentials();
        dispatch(setBiometricEnabled(false));
      }
    },
    [dispatch, user, t],
  );

  // ── Profile Update ──
  const handleSaveProfile = useCallback(async () => {
    if (!profileFirstName.trim() || !profileLastName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('settings.nameRequired', 'First name and last name are required'));
      return;
    }

    try {
      const fullPhone = normalizePhoneToE164(profilePhone, COUNTRY_CODE);
      if (isParent && parentData?.data) {
        await updateParent({
          parentId: parentData.data.parentId,
          firstName: profileFirstName.trim(),
          lastName: profileLastName.trim(),
          email: profileEmail.trim() || undefined,
          phoneNumber: fullPhone || undefined,
          countryCode: COUNTRY_CODE,
          civilId: parentData.data.civilId,
          statusId: parentData.data.fK_StatusId,
        }).unwrap();
      } else if ((isDirector || isManager) && directorData?.data) {
        await updateDirector({
          directorId: directorData.data.directorId,
          firstname: profileFirstName.trim(),
          lastname: profileLastName.trim(),
          email: profileEmail.trim() || undefined,
          phoneNumber: fullPhone || undefined,
          countryCode: COUNTRY_CODE,
          statusId: directorData.data.fK_StatusId,
        }).unwrap();
      } else if (isAgent && agentData?.data) {
        await editAgent({
          collectingAgentId: agentData.data.collectingAgentId,
          schoolId: agentData.data.fK_SchoolId,
          firstName: profileFirstName.trim(),
          lastName: profileLastName.trim(),
          email: profileEmail.trim(),
          phoneNumber: fullPhone || agentData.data.phoneNumber,
          countryCode: COUNTRY_CODE,
          assignedArea: agentData.data.assignedArea,
          commissionPercentage: agentData.data.commissionPercentage,
          statusId: agentData.data.fK_StatusId,
        }).unwrap();
      } else {
        // No profile data loaded — can't save
        Alert.alert(t('common.error', 'Error'), t('settings.profileDataNotLoaded', 'Profile data is still loading. Please try again.'));
        return;
      }
      // Update local Redux state so UI reflects changes immediately
      const newName = `${profileFirstName.trim()} ${profileLastName.trim()}`;
      dispatch(updateUser({
        name: newName,
        email: profileEmail.trim() || user?.email || '',
        phoneNumber: fullPhone || user?.phoneNumber || '',
      }));

      setShowProfileModal(false);
      Alert.alert(t('common.success', 'Success'), t('settings.profileUpdated', 'Profile updated successfully'));
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.data?.message || t('settings.profileUpdateFailed', 'Failed to update profile'));
    }
  }, [isParent, isDirector, isAgent, isManager, parentData, directorData, agentData, profileFirstName, profileLastName, profileEmail, profilePhone, updateParent, updateDirector, editAgent, dispatch, user, t]);

  // ── Change Password ──
  const handleChangePassword = useCallback(async () => {
    if (!currentPassword.trim()) {
      Alert.alert(t('common.error', 'Error'), t('settings.currentPasswordRequired', 'Current password is required'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('common.error', 'Error'), t('settings.passwordMinLength', 'New password must be at least 6 characters'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t('common.error', 'Error'), t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    try {
      await changePassword({
        userId: user?.id || '',
        currentPassword,
        newPassword,
      }).unwrap();
      // Update biometric credentials if enabled
      if (biometricLogin) {
        const stored = await getStoredCredentials();
        if (stored) {
          await saveCredentials({ ...stored, password: newPassword });
        }
      }
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert(t('common.success', 'Success'), t('settings.passwordChanged', 'Password changed successfully'));
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.data?.message || t('settings.passwordChangeFailed', 'Failed to change password. Check your current password.'));
    }
  }, [currentPassword, newPassword, confirmNewPassword, user, changePassword, t]);

  const isUpdating = isUpdatingParent || isUpdatingDirector || isUpdatingAgent;

  return (
    <ScreenContainer>
      {/* Profile Card */}
      <AnimatedSection index={0}>
        <ThemedCard
          variant="elevated"
          style={styles.profileCard}
          onPress={() => setShowProfileModal(true)}
        >
          <View style={styles.profileRow}>
            <Avatar
              firstName={firstName}
              lastName={lastName}
              size="xl"
            />
            <View style={styles.profileInfo}>
              <ThemedText variant="subtitle">
                {user?.name || ''}
              </ThemedText>
              <UserRoleChip role={userRole} />
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                style={{ marginTop: 4 }}
              >
                {user?.email || ''}
              </ThemedText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textTertiary}
            />
          </View>
        </ThemedCard>
      </AnimatedSection>

      {/* Appearance */}
      <AnimatedSection index={1}>
        <SectionHeader
          title={t('settings.appearance', 'Appearance')}
          style={styles.sectionSpacing}
        />
        <ThemedCard variant="outlined" style={styles.sectionCard}>
          <ThemedText
            variant="bodySmall"
            color={theme.colors.textSecondary}
            style={styles.sectionItemLabel}
          >
            {t('settings.theme', 'Theme')}
          </ThemedText>
          <ThemeModeSelector />
          <View style={styles.sectionDivider} />
          <ThemedText
            variant="bodySmall"
            color={theme.colors.textSecondary}
            style={styles.sectionItemLabel}
          >
            {t('settings.language', 'Language')}
          </ThemedText>
          <LanguageSwitcher />
        </ThemedCard>
      </AnimatedSection>

      {/* Notifications */}
      <AnimatedSection index={2}>
        <SectionHeader
          title={t('settings.notifications', 'Notifications')}
          style={styles.sectionSpacing}
        />
        <ThemedCard variant="outlined" style={styles.sectionCard}>
          <SettingsRow
            icon="notifications-outline"
            label={t('settings.pushNotifications', 'Push Notifications')}
            subtitle={
              pushNotifications
                ? pushRegistered
                  ? t('settings.enabled', 'Enabled')
                  : t('settings.pushActivating', 'Enabled — finalizing device registration…')
                : t('settings.disabled', 'Disabled')
            }
            showChevron={false}
            iconColor={theme.colors.primary}
            rightElement={
              <Switch
                value={pushToggleValue}
                onValueChange={handlePushToggle}
                trackColor={{
                  false: theme.colors.disabled,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={
                  pushToggleValue ? theme.colors.primary : theme.colors.textTertiary
                }
              />
            }
          />
          <SettingsRow
            icon="mail-outline"
            label={t('settings.emailNotifications', 'Email Notifications')}
            subtitle={emailNotifications ? t('settings.enabled', 'Enabled') : t('settings.disabled', 'Disabled')}
            showChevron={false}
            iconColor={theme.colors.info}
            rightElement={
              <Switch
                value={emailNotifications}
                onValueChange={handleEmailToggle}
                trackColor={{
                  false: theme.colors.disabled,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={
                  emailNotifications ? theme.colors.primary : theme.colors.textTertiary
                }
              />
            }
          />
        </ThemedCard>
      </AnimatedSection>

      {/* Security */}
      <AnimatedSection index={3}>
        <SectionHeader
          title={t('settings.security', 'Security')}
          style={styles.sectionSpacing}
        />
        <ThemedCard variant="outlined" style={styles.sectionCard}>
          <SettingsRow
            icon="lock-closed-outline"
            label={t('settings.changePassword', 'Change Password')}
            onPress={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
              setShowPasswordModal(true);
            }}
            iconColor={theme.colors.warning}
          />
          <SettingsRow
            icon="person-outline"
            label={t('settings.editProfile', 'Edit Profile')}
            onPress={() => setShowProfileModal(true)}
            iconColor={theme.colors.primary}
          />
          <SettingsRow
            icon="finger-print-outline"
            label={t('settings.biometricLogin', 'Biometric Login')}
            showChevron={false}
            iconColor={theme.colors.success}
            rightElement={
              <Switch
                value={biometricLogin}
                onValueChange={handleBiometricToggle}
                disabled={biometricLoading}
                trackColor={{
                  false: theme.colors.disabled,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={
                  biometricLogin ? theme.colors.primary : theme.colors.textTertiary
                }
              />
            }
          />
        </ThemedCard>
      </AnimatedSection>

      {/* About */}
      <AnimatedSection index={4}>
        <SectionHeader
          title={t('settings.about', 'About')}
          style={styles.sectionSpacing}
        />
        <ThemedCard variant="outlined" style={styles.sectionCard}>
          <SettingsRow
            icon="information-circle-outline"
            label={t('settings.version', 'Version')}
            showChevron={false}
            iconColor={theme.colors.textSecondary}
            rightElement={
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                1.0.0
              </ThemedText>
            }
          />
          <SettingsRow
            icon="document-text-outline"
            label={t('settings.termsOfService', 'Terms of Service')}
            onPress={() => setAboutModal('terms')}
            iconColor={theme.colors.textSecondary}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t('settings.privacyPolicy', 'Privacy Policy')}
            onPress={() => setAboutModal('privacy')}
            iconColor={theme.colors.textSecondary}
          />
          <SettingsRow
            icon="help-circle-outline"
            label={t('settings.helpCenter', 'Help Center')}
            onPress={() => setAboutModal('help')}
            iconColor={theme.colors.textSecondary}
          />
        </ThemedCard>
      </AnimatedSection>

      {/* Sign Out */}
      <AnimatedSection index={5}>
        <ThemedButton
          title={t('settings.signOut', 'Sign Out')}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/sign-in');
          }}
          variant="danger"
          size="lg"
          fullWidth
          icon={<Ionicons name="log-out-outline" size={20} color="#FFFFFF" />}
          style={styles.signOutButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EDIT PROFILE MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showProfileModal} animationType="slide" transparent onRequestClose={() => setShowProfileModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowProfileModal(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => { }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Ionicons name="person-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <ThemedText variant="title" style={{ marginTop: 12 }}>
                    {t('settings.editProfile', 'Edit Profile')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
                    {t('settings.editProfileDesc', 'Update your personal information')}
                  </ThemedText>
                </View>

                {/* Fields */}
                <View style={styles.modalForm}>
                  <ThemedInput
                    label={t('auth.firstName', 'First Name')}
                    value={profileFirstName}
                    onChangeText={setProfileFirstName}
                    placeholder={t('auth.firstName', 'First Name')}
                    leftIcon={<Ionicons name="person-outline" size={18} color={theme.colors.textTertiary} />}
                  />
                  <ThemedInput
                    label={t('auth.lastName', 'Last Name')}
                    value={profileLastName}
                    onChangeText={setProfileLastName}
                    placeholder={t('auth.lastName', 'Last Name')}
                    leftIcon={<Ionicons name="person-outline" size={18} color={theme.colors.textTertiary} />}
                  />
                  <ThemedInput
                    label={t('auth.email', 'Email')}
                    value={profileEmail}
                    onChangeText={setProfileEmail}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon={<Ionicons name="mail-outline" size={18} color={theme.colors.textTertiary} />}
                  />
                  <ThemedInput
                    label={t('auth.phone', 'Phone')}
                    value={profilePhone}
                    onChangeText={(v) => setProfilePhone(v.replace(/[^\d]/g, ''))}
                    placeholder="812 345 678"
                    keyboardType="phone-pad"
                    leftIcon={
                      <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                        {COUNTRY_CODE}
                      </ThemedText>
                    }
                  />
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <ThemedButton
                    title={t('common.cancel', 'Cancel')}
                    variant="ghost"
                    size="md"
                    onPress={() => setShowProfileModal(false)}
                    style={styles.modalBtn}
                  />
                  <ThemedButton
                    title={isUpdating ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                    variant="primary"
                    size="md"
                    onPress={handleSaveProfile}
                    disabled={isUpdating}
                    style={styles.modalBtn}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CHANGE PASSWORD MODAL                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal visible={showPasswordModal} animationType="slide" transparent onRequestClose={() => setShowPasswordModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowPasswordModal(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => { }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: theme.colors.warning + '15' }]}>
                    <Ionicons name="lock-closed-outline" size={24} color={theme.colors.warning} />
                  </View>
                  <ThemedText variant="title" style={{ marginTop: 12 }}>
                    {t('settings.changePassword', 'Change Password')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
                    {t('settings.changePasswordDesc', 'Enter your current password and choose a new one')}
                  </ThemedText>
                </View>

                {/* Fields */}
                <View style={styles.modalForm}>
                  <ThemedInput
                    label={t('settings.currentPassword', 'Current Password')}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="********"
                    secureTextEntry={!showCurrentPw}
                    leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textTertiary} />}
                    rightIcon={
                      <Pressable onPress={() => setShowCurrentPw(!showCurrentPw)} hitSlop={8}>
                        <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textTertiary} />
                      </Pressable>
                    }
                  />
                  <ThemedInput
                    label={t('settings.newPassword', 'New Password')}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="********"
                    secureTextEntry={!showNewPw}
                    leftIcon={<Ionicons name="key-outline" size={18} color={theme.colors.textTertiary} />}
                    rightIcon={
                      <Pressable onPress={() => setShowNewPw(!showNewPw)} hitSlop={8}>
                        <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textTertiary} />
                      </Pressable>
                    }
                  />
                  <ThemedInput
                    label={t('auth.confirmPassword', 'Confirm Password')}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="********"
                    secureTextEntry={!showNewPw}
                    leftIcon={<Ionicons name="key-outline" size={18} color={theme.colors.textTertiary} />}
                  />

                  {/* Password requirements hint */}
                  <View style={[styles.passwordHint, { backgroundColor: theme.colors.primaryLight + '10', borderRadius: theme.borderRadius.md }]}>
                    <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                    <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
                      {t('settings.passwordHint', 'Password must be at least 6 characters long')}
                    </ThemedText>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <ThemedButton
                    title={t('common.cancel', 'Cancel')}
                    variant="ghost"
                    size="md"
                    onPress={() => setShowPasswordModal(false)}
                    style={styles.modalBtn}
                  />
                  <ThemedButton
                    title={isChangingPw ? t('common.loading', 'Loading...') : t('settings.updatePassword', 'Update Password')}
                    variant="primary"
                    size="md"
                    onPress={handleChangePassword}
                    disabled={isChangingPw}
                    style={styles.modalBtn}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── About Content Modal ────────────────────────────── */}
      <Modal visible={aboutModal !== null} animationType="slide" transparent onRequestClose={() => setAboutModal(null)}>
        <View style={styles.aboutModalOverlay}>
          <View style={[styles.aboutModalContent, { backgroundColor: theme.colors.card, borderTopLeftRadius: theme.borderRadius.xl, borderTopRightRadius: theme.borderRadius.xl }]}>
            <View style={[styles.aboutModalHeader, { borderBottomColor: theme.colors.border }]}>
              <ThemedText variant="subtitle">
                {aboutModal === 'terms' ? t('settings.termsOfService', 'Terms of Service')
                  : aboutModal === 'privacy' ? t('settings.privacyPolicy', 'Privacy Policy')
                    : t('settings.helpCenter', 'Help Center')}
              </ThemedText>
              <Pressable onPress={() => setAboutModal(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.aboutScrollView} showsVerticalScrollIndicator={false}>
              {aboutModal === 'terms' && (
                <>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsIntro')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsAcceptanceTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsAcceptance')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsUseTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsUse')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsAccountsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsAccounts')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsPaymentsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsPayments')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsLiabilityTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsLiability')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.termsModificationsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.termsModifications')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.aboutFooter}>
                    {t('about.termsLastUpdated')}
                  </ThemedText>
                </>
              )}
              {aboutModal === 'privacy' && (
                <>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyIntro')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacyCollectionTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyCollection')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacyUsageTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyUsage')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacyStorageTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyStorage')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacySharingTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacySharing')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacyRightsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyRights')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.privacyContactTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.privacyContact')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.aboutFooter}>
                    {t('about.privacyLastUpdated')}
                  </ThemedText>
                </>
              )}
              {aboutModal === 'help' && (
                <>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpIntro')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.helpGettingStartedTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpGettingStarted')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.helpPaymentsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpPayments')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.helpNotificationsTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpNotifications')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.helpFaqTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpFaq')}
                  </ThemedText>
                  <ThemedText variant="subtitle" style={styles.aboutHeading}>
                    {t('about.helpContactTitle')}
                  </ThemedText>
                  <ThemedText variant="body" style={styles.aboutParagraph}>
                    {t('about.helpContact')}
                  </ThemedText>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    marginTop: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 4,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionCard: {
    paddingVertical: 4,
  },
  sectionItemLabel: {
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionDivider: {
    height: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingsRowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowLabel: {
    flex: 1,
  },
  signOutButton: {
    marginTop: 32,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    gap: 4,
    paddingTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingBottom: 8,
  },
  modalBtn: {
    flex: 1,
    minWidth: 110,
  },
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  aboutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aboutModalContent: {
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  aboutModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  aboutScrollView: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  aboutHeading: {
    marginTop: 20,
    marginBottom: 8,
  },
  aboutParagraph: {
    lineHeight: 22,
    marginBottom: 8,
  },
  aboutFooter: {
    marginTop: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
});
