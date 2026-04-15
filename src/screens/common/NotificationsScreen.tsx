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
  SectionHeader,
  NotificationItem,
  EmptyState,
} from '../../components';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
} from '../../services/api/apiSlice';
import { setNotifications, markAllRead } from '../../store/slices/notificationSlice';
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

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id) ?? '';

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

  const notifications = notificationsData?.data ?? [];

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
      const type = notification.type?.toLowerCase() || '';
      if (type === 'payment') {
        router.push('/(app)/payments');
      } else if (type === 'approval') {
        router.push('/(app)/children');
      } else if (type === 'reminder') {
        router.push('/(app)/payments');
      }
      // For other types, just show the notification (no navigation)
    },
    [router],
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
          <View style={styles.header}>
            <ThemedText variant="h2">
              {t('notifications.title', 'Notifications')}
            </ThemedText>
            {hasNotifications && (
              <Pressable
                onPress={handleMarkAllRead}
                hitSlop={8}
                disabled={isMarkingRead}
              >
                <ThemedText
                  variant="bodySmall"
                  color={theme.colors.primary}
                  style={{ fontWeight: '600', opacity: isMarkingRead ? 0.5 : 1 }}
                >
                  {t('notifications.markAllRead', 'Mark all read')}
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
                <SectionHeader
                  title={t('notifications.today', 'Today')}
                  style={styles.sectionHeader}
                />
                {todayNotifications.map((notification) => (
                  <NotificationItem
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
                <SectionHeader
                  title={t('notifications.earlier', 'Earlier')}
                  style={styles.sectionHeader}
                />
                {earlierNotifications.map((notification) => (
                  <NotificationItem
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
