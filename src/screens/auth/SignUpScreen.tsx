import React, { useState, useCallback } from 'react';
import {
  View, Pressable, StyleSheet, ScrollView
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
  ThemedCard,
} from '../../components';
import {
  useAppDispatch,
  useAnimatedEntry,
  staggerDelay,
} from '../../hooks';
import { setSelectedRole } from '../../store/slices/appSlice';
import { setCredentials } from '../../store/slices/authSlice';
import { useRegisterMutation, useGetSchoolsQuery } from '../../services/api/apiSlice';
import { extractUserFromToken } from '../../utils/jwt';
import { useTheme } from '../../theme';
import { COUNTRY_CODE } from '../../constants';
import type { UserRole } from '../../types';

/* ─── Role Config ─── */
interface RoleOption {
  role: UserRole;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ROLE_OPTIONS: RoleOption[] = [
  { role: 'parent', labelKey: 'roles.parent', icon: 'people-outline' },
  { role: 'director', labelKey: 'roles.director', icon: 'school-outline' },
  { role: 'agent', labelKey: 'roles.agent', icon: 'wallet-outline' },
];

/* ─── Form Errors ─── */
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  civilId?: string;
}

const SignUpScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();

  // API mutations / queries
  const [register] = useRegisterMutation();
  const { data: schoolsData } = useGetSchoolsQuery({ pageNumber: 1, pageSize: 100 });
  const schools = schoolsData?.data ?? [];

  // Form state
  const [selectedRole, setSelectedRoleLocal] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode] = useState(COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [civilId, setCivilId] = useState('');
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Animations
  const headerAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0 });
  const roleAnim = useAnimatedEntry({ type: 'slideUp', delay: 100 });
  const formAnim = useAnimatedEntry({ type: 'slideUp', delay: 250 });

  const needsSchool =
    selectedRole === 'director' ||
    selectedRole === 'agent';

  const handleRoleSelect = useCallback(
    (role: UserRole) => {
      setSelectedRoleLocal(role);
      dispatch(setSelectedRole(role));
      if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
    },
    [dispatch, errors.role],
  );

  const validate = useCallback((): boolean => {
    const e: FormErrors = {};

    if (!selectedRole) e.role = t('auth.roleRequired');
    if (!firstName.trim()) e.firstName = t('auth.firstNameRequired');
    if (!lastName.trim()) e.lastName = t('auth.lastNameRequired');
    if (!email.trim()) {
      e.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = t('auth.emailInvalid');
    }
    if (!phone.trim()) {
      e.phone = t('auth.phoneRequired');
    } else if (phone.replace(/\D/g, '').length < 8) {
      e.phone = t('auth.phoneMinLength');
    }
    if (!password.trim()) {
      e.password = t('auth.passwordRequired');
    } else if (password.length < 6) {
      e.password = t('auth.passwordMinLength');
    }
    if (password !== confirmPassword) {
      e.confirmPassword = t('auth.passwordMismatch');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [selectedRole, firstName, lastName, email, phone, password, confirmPassword, t]);

  const handleSignUp = useCallback(async () => {
    if (!validate()) return;

    // The backend's [Authorize(Roles = "...")] is case-sensitive and expects
    // "Parent" / "Director" / "Agent" / "SuperAdmin". The UI uses lowercase
    // keys, so map them to the exact strings the backend wants before sending.
    const ROLE_MAP: Record<UserRole, string> = {
      parent: 'Parent',
      director: 'Director',
      agent: 'Agent',
      manager: 'Manager',
      superadmin: 'SuperAdmin',
    };
    const apiRole = ROLE_MAP[selectedRole!] || selectedRole!;

    setIsLoading(true);
    try {
      const result = await register({
        FirstName: firstName,
        LastName: lastName,
        Role: apiRole,
        Password: password,
        SchoolId: needsSchool ? (schoolId ?? 0) : 0,
        CountryCode: COUNTRY_CODE,
        // Send local digits only; country code is sent separately in CountryCode.
        PhoneNumber: phone,
        Email: email,
        // Backend DB column is NOT NULL — always send a string, never undefined.
        CivilId: (civilId || '').trim(),
      }).unwrap();

      // Auto-login if token returned
      if ((result as any).token) {
        const decoded = extractUserFromToken((result as any).token);
        if (decoded) {
          dispatch(setCredentials({ user: decoded, token: (result as any).token }));
          router.replace('/(app)/dashboard');
          return;
        }
      }

      // If no token, redirect to sign in
      Alert.alert(t('common.success'), result.message || t('auth.registrationSuccess'));
      router.replace('/(auth)/sign-in');
    } catch (err: any) {
      const message =
        err?.data?.message || err?.data?.Message || err?.message || t('common.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsLoading(false);
    }
  }, [validate, firstName, lastName, selectedRole, password, schoolId, phone, email, civilId, register, dispatch, router, t]);

  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  return (
    <ScreenContainer scrollable padding>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.text}
          />
        </Pressable>
        <ThemedText variant="h1" style={styles.title}>
          {t('auth.createAccount')}
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          style={styles.subtitle}
        >
          {t('auth.createAccountDesc')}
        </ThemedText>
      </Animated.View>

      {/* Role Selection */}
      <Animated.View style={[styles.roleSection, roleAnim]}>
        <ThemedText variant="subtitle" style={styles.sectionLabel}>
          {t('roles.selectRole')}
        </ThemedText>
        {errors.role && (
          <ThemedText
            variant="caption"
            color={theme.colors.error}
            style={styles.roleError}
          >
            {errors.role}
          </ThemedText>
        )}
        <View style={styles.roleList}>
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.role;
            return (
              <Pressable
                key={option.role}
                onPress={() => handleRoleSelect(option.role)}
                style={[
                  styles.roleCard,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary + '12'
                      : theme.colors.surface,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.borderLight,
                    borderRadius: theme.borderRadius.xl,
                  },
                ]}
              >
                <View
                  style={[
                    styles.roleIconContainer,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary + '20'
                        : theme.colors.inputBackground,
                      borderRadius: theme.borderRadius.lg,
                    },
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={
                      isSelected
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                </View>
                <ThemedText
                  variant="caption"
                  color={
                    isSelected ? theme.colors.primary : theme.colors.text
                  }
                  style={styles.roleLabel}
                >
                  {t(option.labelKey)}
                </ThemedText>
                {isSelected && (
                  <View
                    style={[
                      styles.checkBadge,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Form Fields */}
      <Animated.View style={[styles.formSection, formAnim]}>
        {/* Name Row */}
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <ThemedInput
              label={t('auth.firstName')}
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                clearError('firstName');
              }}
              placeholder={t('auth.firstName')}
              error={errors.firstName}
              leftIcon={
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={theme.colors.textTertiary}
                />
              }
            />
          </View>
          <View style={styles.nameField}>
            <ThemedInput
              label={t('auth.lastName')}
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                clearError('lastName');
              }}
              placeholder={t('auth.lastName')}
              error={errors.lastName}
            />
          </View>
        </View>

        {/* Email */}
        <ThemedInput
          label={t('auth.email')}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError('email');
          }}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
          leftIcon={
            <Ionicons
              name="mail-outline"
              size={18}
              color={theme.colors.textTertiary}
            />
          }
        />

        {/* Phone Number with inline country code */}
        <ThemedInput
          label={t('auth.phone')}
          value={phone}
          onChangeText={(text) => {
            // Keep only digits — DO NOT strip the leading 0. Congo-
            // Brazzaville users write their number with the trunk
            // prefix ("06 51 23 456…"), and we want to store + show
            // exactly what they typed so the same value works on
            // login.
            const digits = text.replace(/\D/g, '');
            setPhone(digits);
            clearError('phone');
          }}
          placeholder="812 345 678"
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

        {/* Civil ID - Parent only */}
        {selectedRole === 'parent' && (
          <ThemedInput
            label={t('auth.civilId')}
            value={civilId}
            onChangeText={(text) => {
              setCivilId(text);
              clearError('civilId');
            }}
            placeholder={t('auth.civilIdPlaceholder')}
            error={errors.civilId}
            leftIcon={
              <Ionicons
                name="id-card-outline"
                size={18}
                color={theme.colors.textTertiary}
              />
            }
          />
        )}

        {/* School Selection - Director/Agent */}
        {needsSchool && (
          <View>
            <ThemedText variant="bodySmall" style={styles.pickerLabel}>
              {t('auth.selectSchool')}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.schoolList}
            >
              {schools.map((school) => {
                const isSelected = schoolId === school.schoolId;
                return (
                  <Pressable
                    key={school.schoolId}
                    onPress={() => setSchoolId(school.schoolId)}
                    style={[
                      styles.schoolChip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary + '15'
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.borderLight,
                        borderRadius: theme.borderRadius.lg,
                      },
                    ]}
                  >
                    <Ionicons
                      name="school-outline"
                      size={16}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <ThemedText
                      variant="caption"
                      color={isSelected ? theme.colors.primary : theme.colors.text}
                      style={styles.schoolChipText}
                    >
                      {school.schoolName}
                    </ThemedText>
                  </Pressable>
                );
              })}
              {schools.length === 0 && (
                <ThemedText variant="caption" color={theme.colors.textTertiary}>
                  {t('common.loading')}...
                </ThemedText>
              )}
            </ScrollView>
          </View>
        )}

        {/* Password */}
        <ThemedInput
          label={t('auth.password')}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError('password');
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

        {/* Confirm Password */}
        <ThemedInput
          label={t('auth.confirmPassword')}
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            clearError('confirmPassword');
          }}
          placeholder="********"
          secureTextEntry={!showConfirmPassword}
          error={errors.confirmPassword}
          leftIcon={
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={theme.colors.textTertiary}
            />
          }
          rightIcon={
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={8}
            >
              <Ionicons
                name={
                  showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
                }
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          }
        />
      </Animated.View>

      {/* Sign Up Button */}
      <View style={styles.buttonSection}>
        <ThemedButton
          title={t('auth.signUp')}
          onPress={handleSignUp}
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={!selectedRole}
        />

        <View style={styles.signInRow}>
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {t('auth.hasAccount')}{' '}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
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
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 8,
  },
  roleSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  roleError: {
    marginBottom: 8,
  },
  roleList: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  roleCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    position: 'relative',
  },
  roleIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    paddingTop: 8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nameField: {
    flex: 1,
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
  pickerLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  schoolList: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  schoolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  schoolChipText: {
    fontWeight: '600',
  },
  buttonSection: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    fontWeight: '600',
  },
});

export default SignUpScreen;
