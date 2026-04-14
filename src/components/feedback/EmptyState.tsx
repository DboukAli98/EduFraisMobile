import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from '../common/ThemedText';
import ThemedButton from '../common/ThemedButton';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.colors.primaryLight + '15',
            borderRadius: theme.borderRadius.full,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={40}
          color={theme.colors.primaryLight}
        />
      </View>
      <ThemedText variant="subtitle" align="center" style={styles.title}>
        {title}
      </ThemedText>
      {description && (
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          align="center"
          style={styles.description}
        >
          {description}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <ThemedButton
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.action}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconCircle: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
    maxWidth: 280,
  },
  action: {
    minWidth: 160,
  },
});

export default EmptyState;
