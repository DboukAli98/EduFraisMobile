import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Switch } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAuth, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
  SectionHeader,
  UserRoleChip,
  ThemeModeSelector,
  LanguageSwitcher,
} from '../../components';
import type { UserRole } from '../../types';

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
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  onPress,
  rightElement,
  showChevron = true,
  iconColor,
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
      <ThemedText variant="body" style={styles.settingsRowLabel}>
        {label}
      </ThemedText>
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
  const { logout } = useAuth();
  const user = useAppSelector((state) => state.auth.user);

  // Extract name parts from full name
  const nameParts = (user?.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const userRole = (user?.role || 'User') as UserRole;

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [biometricLogin, setBiometricLogin] = useState(true);

  return (
    <ScreenContainer>
      {/* Profile Card */}
      <AnimatedSection index={0}>
        <ThemedCard
          variant="elevated"
          style={styles.profileCard}
          onPress={() => {}}
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
            showChevron={false}
            iconColor={theme.colors.primary}
            rightElement={
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{
                  false: theme.colors.disabled,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={
                  pushNotifications ? theme.colors.primary : theme.colors.textTertiary
                }
              />
            }
          />
          <SettingsRow
            icon="mail-outline"
            label={t('settings.emailNotifications', 'Email Notifications')}
            showChevron={false}
            iconColor={theme.colors.info}
            rightElement={
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
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
            onPress={() => {}}
            iconColor={theme.colors.warning}
          />
          <SettingsRow
            icon="finger-print-outline"
            label={t('settings.biometricLogin', 'Biometric Login')}
            showChevron={false}
            iconColor={theme.colors.success}
            rightElement={
              <Switch
                value={biometricLogin}
                onValueChange={setBiometricLogin}
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
            onPress={() => {}}
            iconColor={theme.colors.textSecondary}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t('settings.privacyPolicy', 'Privacy Policy')}
            onPress={() => {}}
            iconColor={theme.colors.textSecondary}
          />
          <SettingsRow
            icon="help-circle-outline"
            label={t('settings.helpCenter', 'Help Center')}
            onPress={() => {}}
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
});
