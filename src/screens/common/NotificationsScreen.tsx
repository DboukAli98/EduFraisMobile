import React, { useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector, useAppDispatch } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  EmptyState,
} from '../../components';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
} from '../../services/api/apiSlice';
import { setNotifications, markAllRead } from '../../store/slices/notificationSlice';
import { resolveNotificationRoute } from '../../utils';
import type { AppNotification } from '../../types';

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

/** Check if two ISO date strings fall on the same calendar day */
function isSameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

const getRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'maintenant';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHour < 24) return `${diffHour} h`;
  if (diffDay < 7) return `${diffDay} j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const getNotificationVisual = (
  type: string,
  colors: ReturnType<typeof useTheme>['theme']['colors'],
): { icon: keyof typeof Ionicons.glyphMap; color: string; label: string } => {
  const normalized = type.toLowerCase();

  if (normalized.includes('payment') || normalized.includes('paiement')) {
    return { icon: 'card-outline', color: colors.primary, label: type };
  }
  if (normalized.includes('reminder') || normalized.includes('rappel')) {
    return { icon: 'alarm-outline', color: colors.warning, label: type };
  }
  if (normalized.includes('support') || normalized.includes('assistance')) {
    return { icon: 'chatbubble-ellipses-outline', color: colors.info, label: type };
  }
  if (normalized.includes('approval') || normalized.includes('approbation')) {
    return { icon: 'checkmark-circle-outline', color: colors.success, label: type };
  }
  if (normalized.includes('reject') || normalized.includes('rejet')) {
    return { icon: 'close-circle-outline', color: colors.error, label: type };
  }
  if (normalized.includes('agent')) {
    return { icon: 'person-add-outline', color: colors.accent, label: type };
  }

  return { icon: 'notifications-outline', color: colors.primary, label: type };
};

const NotificationCard: React.FC<{
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}> = ({ notification, onPress }) => {
  const { theme } = useTheme();
  const visual = useMemo(
    () => getNotificationVisual(notification.type, theme.colors),
    [notification.type, theme.colors],
  );
  const relativeTime = useMemo(() => getRelativeTime(notification.createdAt), [notification.createdAt]);

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.notificationCard,
        {
          backgroundColor: notification.isRead ? theme.colors.surface : visual.color + '08',
          borderColor: notification.isRead ? theme.colors.borderLight : visual.color + '35',
          borderRadius: theme.borderRadius.xl,
        },
        pressed && styles.pressedCard,
      ]}
    >
      {!notification.isRead ? <View style={[styles.unreadRail, { backgroundColor: visual.color }]} /> : null}

      <View style={[styles.notificationIcon, { backgroundColor: visual.color + '15', borderRadius: theme.borderRadius.lg }]}>
        <Ionicons name={visual.icon} size={20} color={visual.color} />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationTopRow}>
          <ThemedText
            variant="body"
            numberOfLines={1}
            style={[styles.notificationTitle, { fontWeight: notification.isRead ? '600' : '800' }]}
          >
            {notification.title}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.timeText}>
            {relativeTime}
          </ThemedText>
        </View>

        <ThemedText variant="bodySmall" color={theme.colors.textSecondary} numberOfLines={2} style={styles.notificationMessage}>
          {notification.message}
        </ThemedText>

        <View style={styles.notificationFooter}>
          <View style={[styles.typePill, { backgroundColor: visual.color + '12', borderRadius: theme.borderRadius.full }]}>
            <ThemedText variant="caption" color={visual.color} style={styles.typePillText} numberOfLines={1}>
              {visual.label}
            </ThemedText>
          </View>
          {!notification.isRead ? <View style={[styles.newDot, { backgroundColor: visual.color }]} /> : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} style={styles.chevron} />
    </Pressable>
  );
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id) ?? '';
  const userRole = useAppSelector((state) => state.auth.user?.role);

  const {
    data: notificationsData,
    isLoading,
    isFetching,
    refetch,
  } = useGetNotificationsQuery(
    { userId, pageNumber: 1, pageSize: 50 },
    { skip: !userId },
  );

  const [markAllAsReadMutation, { isLoading: isMarkingRead }] =
    useMarkAllNotificationsAsReadMutation();

  const notifications = useMemo(
    () =>
      [...(notificationsData?.data ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notificationsData?.data],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  // Sync API notifications into Redux for badge count
  useEffect(() => {
    if (notifications.length > 0) {
      dispatch(setNotifications(notifications));
    }
  }, [notifications, dispatch]);

  const todayStr = useMemo(() => new Date().toISOString(), []);

  const todayNotifications = useMemo(
    () => notifications.filter((n) => isSameDay(n.createdAt, todayStr)),
    [notifications, todayStr],
  );

  const earlierNotifications = useMemo(
    () => notifications.filter((n) => !isSameDay(n.createdAt, todayStr)),
    [notifications, todayStr],
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllAsReadMutation({ userId }).unwrap();
      dispatch(markAllRead());
    } catch {
      // Silently fail - user can retry
    }
  }, [userId, markAllAsReadMutation, dispatch]);

  const handleNotificationPress = useCallback(
    (notification: AppNotification) => {
      // Centralised, role-aware, locale-tolerant resolver. When the
      // backend later adds relatedEntityId/relatedEntityType, deep-links
      // to specific entity detail screens light up automatically.
      const route = resolveNotificationRoute(notification, userRole);
      if (route) {
        router.push(route);
      }
      // No match → leave the row inert rather than navigating somewhere
      // arbitrary. The notification still gets visually marked as tapped
      // by the parent NotificationItem component.
    },
    [router, userRole],
  );

  const hasNotifications = notifications.length > 0;

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false} padding={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false} padding={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <AnimatedSection index={0}>
          <View
            style={[
              styles.headerCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight, borderRadius: theme.borderRadius.xl },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <View>
                <ThemedText variant="h2">
                  {t('notifications.title', 'Notifications')}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.headerSubtitle}>
                  {t('notifications.newestFirst', 'Les plus recentes en premier')}
                </ThemedText>
              </View>
              <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary + '14', borderRadius: theme.borderRadius.full }]}>
                <Ionicons name="mail-unread-outline" size={16} color={theme.colors.primary} />
                <ThemedText variant="caption" color={theme.colors.primary} style={styles.unreadBadgeText}>
                  {unreadCount}
                </ThemedText>
              </View>
            </View>

            {hasNotifications && (
              <Pressable
                onPress={handleMarkAllRead}
                hitSlop={8}
                disabled={isMarkingRead || unreadCount === 0}
                style={({ pressed }) => [
                  styles.markAllButton,
                  {
                    backgroundColor: unreadCount === 0 ? theme.colors.inputBackground : theme.colors.primary,
                    borderRadius: theme.borderRadius.full,
                    opacity: isMarkingRead || pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={16}
                  color={unreadCount === 0 ? theme.colors.textSecondary : '#FFFFFF'}
                />
                <ThemedText
                  variant="caption"
                  color={unreadCount === 0 ? theme.colors.textSecondary : '#FFFFFF'}
                  style={styles.markAllText}
                >
                  {t('notifications.markAllRead', 'Tout marquer comme lu')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </AnimatedSection>

        {!hasNotifications ? (
          <EmptyState
            icon="notifications-off-outline"
            title={t('notifications.empty', 'No Notifications')}
            description={t(
              'notifications.emptyDescription',
              'You are all caught up! Check back later for updates.',
            )}
          />
        ) : (
          <>
            {/* Today Section */}
            {todayNotifications.length > 0 && (
              <AnimatedSection index={1}>
                <ThemedText variant="subtitle" style={styles.sectionTitle}>
                  {t('notifications.today', 'Today')}
                </ThemedText>
                {todayNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.notificationId}
                    notification={notification}
                    onPress={handleNotificationPress}
                  />
                ))}
              </AnimatedSection>
            )}

            {/* Earlier Section */}
            {earlierNotifications.length > 0 && (
              <AnimatedSection index={2}>
                <ThemedText variant="subtitle" style={styles.sectionTitle}>
                  {t('notifications.earlier', 'Earlier')}
                </ThemedText>
                {earlierNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.notificationId}
                    notification={notification}
                    onPress={handleNotificationPress}
                  />
                ))}
              </AnimatedSection>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerCard: {
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerSubtitle: {
    marginTop: 4,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  unreadBadgeText: {
    fontWeight: '800',
  },
  markAllButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
  },
  markAllText: {
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 10,
  },
  notificationCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  pressedCard: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  unreadRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  notificationIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
  },
  timeText: {
    flexShrink: 0,
    fontWeight: '700',
  },
  notificationMessage: {
    marginTop: 4,
    lineHeight: 19,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  typePill: {
    maxWidth: '86%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  typePillText: {
    fontWeight: '800',
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
    marginLeft: 8,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
