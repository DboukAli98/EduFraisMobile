import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../src/store/store';
import { AnimatedTabBar, ThemedText } from '../../src/components';
import { useTheme } from '../../src/theme';
import { useOneSignalRegistration } from '../../src/hooks';
import { useGetNotificationsQuery } from '../../src/services/api/apiSlice';
import { setNotifications } from '../../src/store/slices/notificationSlice';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function NotificationTabIcon({ color, size, badgeCount }: { color: string; size: number; badgeCount: number }) {
  return (
    <View>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {badgeCount > 0 && (
        <View style={badgeStyles.badge}>
          <ThemedText variant="caption" color="#fff" style={badgeStyles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});

export default function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role;
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const notificationsHiddenFromTabs = role === 'parent' || role === 'agent' || role === 'director';
  const { data: notificationsData } = useGetNotificationsQuery(
    { userId: user?.id ?? '', pageNumber: 1, pageSize: 50 },
    {
      skip: !user?.id,
      pollingInterval: 30000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  // Initialise OneSignal and register the device's player id with the
  // backend whenever a user is authenticated. This is the only push
  // channel — both background and foreground notifications go through
  // OneSignal.
  useOneSignalRegistration();

  useEffect(() => {
    if (notificationsData?.data) {
      dispatch(setNotifications(notificationsData.data));
    }
  }, [dispatch, notificationsData?.data]);

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboard.title'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: t('payments.title'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="card-outline" color={color} size={size} />
          ),
          href: role === 'parent' || role === 'director' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          title: t('children.title'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} />
          ),
          href: role === 'parent' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: t('agents.title'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-add-outline" color={color} size={size} />
          ),
          href: role === 'director' || role === 'manager' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: t('agents.myPortfolio'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="briefcase-outline" color={color} size={size} />
          ),
          href: role === 'agent' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="commissions"
        options={{
          title: t('agents.myCommissions'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="cash-outline" color={color} size={size} />
          ),
          href: role === 'agent' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: t('schools.students'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="school-outline" color={color} size={size} />
          ),
          href: role === 'director' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="payment-plans"
        options={{
          title: t('cycles.title', 'Plans'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="layers-outline" color={color} size={size} />
          ),
          href: role === 'director' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
          href: role === 'director' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="parents"
        options={{
          title: 'Parents',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-circle-outline" color={color} size={size} />
          ),
          href: role === 'manager' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="my-agents"
        options={{
          title: t('parent.agents.title', 'My Agents'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-add-outline" color={color} size={size} />
          ),
          href: role === 'parent' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications.title'),
          tabBarIcon: ({ color, size }) => (
            <NotificationTabIcon color={color} size={size} badgeCount={unreadCount} />
          ),
          href: notificationsHiddenFromTabs ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="merchandise"
        options={{
          title: t('schools.merchandise'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pricetag-outline" color={color} size={size} />
          ),
          href: role === 'parent' || role === 'director' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      {/* Hidden routes (no tab) */}
      <Tabs.Screen
        name="add-child"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="child-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="merchandise-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment-history"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment-invoice"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payment-success"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="support"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="support-request"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="agent-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="agent-activities"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="my-activities"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="log-activity"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="request-activity"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="parent-agent-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="request-agent"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="agent-requests"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="director-parents"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="director-parent-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="director-child-detail"
        options={{ href: null }}
      />
      {/* Loyalty (parents + agents). Hidden from the tab bar — entered
          via a quick-action tile on each role's home screen, or by
          deep link. */}
      <Tabs.Screen
        name="loyalty"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="loyalty-rewards"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="loyalty-ledger"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="loyalty-redemptions"
        options={{ href: null }}
      />
    </Tabs>
  );
}
