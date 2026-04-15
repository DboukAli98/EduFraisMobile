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
          color: '#FFFFFF',
          bgColor: theme.colors.primary,
          icon: 'people-outline',
        };
      case 'director':
        return {
          label: 'Director',
          color: '#FFFFFF',
          bgColor: theme.colors.accent,
          icon: 'shield-outline',
        };
      case 'manager':
        return {
          label: 'Manager',
          color: '#FFFFFF',
          bgColor: theme.colors.lavender,
          icon: 'briefcase-outline',
        };
      case 'agent':
        return {
          label: 'Agent',
          color: '#FFFFFF',
          bgColor: theme.colors.secondary,
          icon: 'wallet-outline',
        };
      case 'superadmin':
        return {
          label: 'Admin',
          color: '#FFFFFF',
          bgColor: theme.colors.error,
          icon: 'key-outline',
        };
      default:
        return {
          label: role,
          color: '#FFFFFF',
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
