import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
  Avatar,
  UserRoleChip,
} from '../../components';
import { useUpdateParentMutation } from '../../services/api/apiSlice';
import type { UserRole } from '../../types';

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 60),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [updateParent, { isLoading: isSaving }] = useUpdateParentMutation();

  // Extract name parts from full name
  const nameParts = (user?.name || '').split(' ');
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';
  const userRole = (user?.role || 'User') as UserRole;
  const entityUserId = parseInt(user?.entityUserId || '0');

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [civilId] = useState('');

  return (
    <ScreenContainer>
      {/* Avatar Section */}
      <AnimatedSection index={0}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Avatar
              firstName={firstName}
              lastName={lastName}
              size="xl"
            />
            <Pressable
              style={[
                styles.editPhotoOverlay,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.surface,
                },
              ]}
              onPress={() => {}}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
          <ThemedText
            variant="caption"
            color={theme.colors.primary}
            style={{ marginTop: 8, fontWeight: '600' }}
          >
            {t('profile.editPhoto', 'Edit Photo')}
          </ThemedText>
        </View>
      </AnimatedSection>

      {/* Role Chip */}
      <AnimatedSection index={1}>
        <View style={styles.roleRow}>
          <UserRoleChip role={userRole} />
        </View>
      </AnimatedSection>

      {/* Form Fields */}
      <AnimatedSection index={2}>
        <ThemedInput
          label={t('profile.firstName', 'First Name')}
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('profile.firstNamePlaceholder', 'Enter first name')}
        />
      </AnimatedSection>

      <AnimatedSection index={3}>
        <ThemedInput
          label={t('profile.lastName', 'Last Name')}
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('profile.lastNamePlaceholder', 'Enter last name')}
        />
      </AnimatedSection>

      <AnimatedSection index={4}>
        <ThemedInput
          label={t('profile.email', 'Email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('profile.emailPlaceholder', 'Enter email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </AnimatedSection>

      <AnimatedSection index={5}>
        <ThemedInput
          label={t('profile.phone', 'Phone Number')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('profile.phonePlaceholder', 'Enter phone number')}
          keyboardType="phone-pad"
        />
      </AnimatedSection>

      <AnimatedSection index={6}>
        <ThemedInput
          label={t('profile.civilId', 'Civil ID')}
          value={civilId}
          editable={false}
          placeholder={t('profile.civilIdPlaceholder', 'Civil ID')}
        />
      </AnimatedSection>

      {/* Save Button */}
      <AnimatedSection index={7}>
        <ThemedButton
          title={isSaving ? t('common.saving', 'Saving...') : t('profile.saveChanges', 'Save Changes')}
          onPress={async () => {
            if (user?.role === 'parent' && entityUserId) {
              try {
                await updateParent({
                  parentId: entityUserId,
                  firstName,
                  lastName,
                  email,
                  phoneNumber: phone,
                }).unwrap();
                Alert.alert(t('common.success', 'Success'), t('profile.saved', 'Profile updated successfully.'));
              } catch (error: any) {
                Alert.alert(t('common.error', 'Error'), error?.data?.message || t('profile.saveError', 'Failed to save profile.'));
              }
            } else {
              Alert.alert(t('common.info', 'Info'), t('profile.saveNotSupported', 'Profile editing is not yet available for your role.'));
            }
          }}
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSaving}
          icon={<Ionicons name="checkmark" size={20} color="#FFFFFF" />}
          style={styles.saveButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  roleRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButton: {
    marginTop: 8,
  },
});
