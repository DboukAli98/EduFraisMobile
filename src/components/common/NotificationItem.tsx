import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';
import type { AppNotification } from '../../types';

interface NotificationItemProps {
  notification: AppNotification;
  onPress?: (notification: AppNotification) => void;
}

const getRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const getNotificationIcon = (
  type: string,
): keyof typeof Ionicons.glyphMap => {
  switch (type.toLowerCase()) {
    case 'payment':
      return 'card-outline';
    case 'reminder':
      return 'alarm-outline';
    case 'announcement':
      return 'megaphone-outline';
    case 'support':
      return 'chatbubble-outline';
    case 'approval':
      return 'checkmark-circle-outline';
    default:
      return 'notifications-outline';
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
}) => {
  const { theme } = useTheme();
  const { title, message, isRead, createdAt, type: notificationType } = notification;

  const relativeTime = useMemo(() => getRelativeTime(createdAt), [createdAt]);
  const iconName = useMemo(
    () => getNotificationIcon(notificationType),
    [notificationType],
  );

  return (
    <Pressable
      onPress={() => onPress?.(notification)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isRead
            ? 'transparent'
            : theme.colors.primaryLight + '08',
          borderRadius: theme.borderRadius.md,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: theme.colors.primaryLight + '15',
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        <Ionicons name={iconName} size={20} color={theme.colors.primary} />
      </View>

      <View style={styles.content}>
        <ThemedText
          variant="bodySmall"
          style={{ fontWeight: isRead ? '400' : '600' }}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        <ThemedText
          variant="caption"
          color={theme.colors.textSecondary}
          numberOfLines={2}
          style={styles.body}
        >
          {message}
        </ThemedText>
      </View>

      <View style={styles.meta}>
        <ThemedText variant="caption" color={theme.colors.textTertiary}>
          {relativeTime}
        </ThemedText>
        {!isRead && (
          <View
            style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]}
          />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  body: {
    marginTop: 2,
  },
  meta: {
    alignItems: 'flex-end',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});

export default NotificationItem;
