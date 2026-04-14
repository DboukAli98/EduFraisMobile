import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';
import type { UserRole } from '../../types';

interface UserRoleChipProps {
  role: UserRole;
}

interface RoleConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const UserRoleChip: React.FC<UserRoleChipProps> = ({ role }) => {
  const { theme } = useTheme();

  const getRoleConfig = (): RoleConfig => {
    switch (role) {
      case 'parent':
        return {
          label: 'Parent',
          color: theme.colors.primary,
          bgColor: theme.colors.primaryLight + '20',
          icon: 'people-outline',
        };
      case 'director':
        return {
          label: 'Director',
          color: theme.colors.accent,
          bgColor: theme.colors.accent + '20',
          icon: 'shield-outline',
        };
      case 'manager':
        return {
          label: 'Manager',
          color: theme.colors.lavender,
          bgColor: theme.colors.lavender + '20',
          icon: 'briefcase-outline',
        };
      case 'agent':
        return {
          label: 'Agent',
          color: theme.colors.secondary,
          bgColor: theme.colors.secondary + '20',
          icon: 'wallet-outline',
        };
      case 'superadmin':
        return {
          label: 'Admin',
          color: theme.colors.error,
          bgColor: theme.colors.errorLight,
          icon: 'key-outline',
        };
      default:
        return {
          label: role,
          color: theme.colors.textSecondary,
          bgColor: theme.colors.disabled,
          icon: 'person-outline',
        };
    }
  };

  const config = getRoleConfig();

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: config.bgColor,
          borderRadius: theme.borderRadius.full,
        },
      ]}
    >
      <Ionicons
        name={config.icon}
        size={12}
        color={config.color}
        style={styles.icon}
      />
      <ThemedText
        variant="caption"
        color={config.color}
        style={{ fontWeight: '600' }}
      >
        {config.label}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  icon: {
    marginRight: 4,
  },
});

export default UserRoleChip;
