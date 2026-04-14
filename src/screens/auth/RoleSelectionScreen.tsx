import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
} from '../../components';
import {
  useAppDispatch,
  useAnimatedEntry,
  staggerDelay,
} from '../../hooks';
import { setSelectedRole } from '../../store/slices/appSlice';
import { useTheme } from '../../theme';
import type { UserRole } from '../../types';

/* ─── Role Definitions ─── */
interface RoleCardData {
  role: UserRole;
  labelKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const ROLES: RoleCardData[] = [
  {
    role: 'parent',
    labelKey: 'roles.parent',
    descKey: 'roles.parentDesc',
    icon: 'people-outline',
    color: '#4B49AC',
  },
  {
    role: 'director',
    labelKey: 'roles.director',
    descKey: 'roles.directorDesc',
    icon: 'school-outline',
    color: '#F3797E',
  },
  {
    role: 'manager',
    labelKey: 'roles.manager',
    descKey: 'roles.managerDesc',
    icon: 'briefcase-outline',
    color: '#7978E9',
  },
  {
    role: 'agent',
    labelKey: 'roles.agent',
    descKey: 'roles.agentDesc',
    icon: 'wallet-outline',
    color: '#7DA0FA',
  },
];

const RoleSelectionScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [selected, setSelected] = useState<UserRole | null>(null);

  // Header animation
  const headerAnim = useAnimatedEntry({ type: 'fadeIn', delay: 0 });

  const handleSelect = useCallback(
    (role: UserRole) => {
      setSelected(role);
      dispatch(setSelectedRole(role));
    },
    [dispatch],
  );

  const handleContinue = useCallback(() => {
    if (!selected) return;
    router.push('/(auth)/sign-up');
  }, [selected, router]);

  return (
    <ScreenContainer scrollable padding>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>

        <ThemedText variant="h1" style={styles.title}>
          {t('roles.selectRole')}
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          style={styles.subtitle}
        >
          {t('roles.selectRoleDesc')}
        </ThemedText>
      </Animated.View>

      {/* Role Cards */}
      <View style={styles.cardsContainer}>
        {ROLES.map((roleData, index) => (
          <RoleCard
            key={roleData.role}
            data={roleData}
            index={index}
            isSelected={selected === roleData.role}
            onSelect={handleSelect}
          />
        ))}
      </View>

      {/* Continue Button */}
      <View style={styles.buttonContainer}>
        <ThemedButton
          title={t('common.next')}
          onPress={handleContinue}
          size="lg"
          fullWidth
          disabled={!selected}
          icon={
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          }
        />
      </View>
    </ScreenContainer>
  );
};

/* ─── Role Card Component ─── */
interface RoleCardProps {
  data: RoleCardData;
  index: number;
  isSelected: boolean;
  onSelect: (role: UserRole) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RoleCard: React.FC<RoleCardProps> = ({
  data,
  index,
  isSelected,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  // Staggered entry
  const entryAnim = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 80) + 150,
    duration: 400,
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scale]);

  return (
    <AnimatedPressable
      onPress={() => onSelect(data.role)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.roleCard,
        {
          backgroundColor: isSelected
            ? data.color + '10'
            : theme.colors.surface,
          borderColor: isSelected ? data.color : theme.colors.borderLight,
          borderRadius: theme.borderRadius.xl,
          ...theme.shadows.sm,
        },
        entryAnim,
        pressStyle,
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.roleIcon,
          {
            backgroundColor: data.color + '15',
            borderRadius: theme.borderRadius.lg,
          },
        ]}
      >
        <Ionicons name={data.icon} size={28} color={data.color} />
      </View>

      {/* Text */}
      <View style={styles.roleTextContainer}>
        <ThemedText
          variant="subtitle"
          color={isSelected ? data.color : theme.colors.text}
        >
          {t(data.labelKey)}
        </ThemedText>
        <ThemedText
          variant="bodySmall"
          color={theme.colors.textSecondary}
          numberOfLines={2}
        >
          {t(data.descKey)}
        </ThemedText>
      </View>

      {/* Selection Indicator */}
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: isSelected ? data.color : theme.colors.border,
          },
        ]}
      >
        {isSelected && (
          <View
            style={[styles.radioInner, { backgroundColor: data.color }]}
          />
        )}
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 24,
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
    marginBottom: 4,
  },
  cardsContainer: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
  },
  roleIcon: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleTextContainer: {
    flex: 1,
    gap: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  buttonContainer: {
    paddingTop: 32,
    paddingBottom: 16,
  },
});

export default RoleSelectionScreen;
