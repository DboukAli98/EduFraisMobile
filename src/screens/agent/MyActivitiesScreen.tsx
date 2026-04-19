import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  EmptyState,
  ScreenSkeleton,
  ThemedButton,
} from '../../components';
import { useTheme } from '../../theme';
import { useGetMyActivitiesQuery } from '../../services/api/apiSlice';
import { formatDate } from '../../utils';
import type { CollectingAgentActivity } from '../../types';

// Order matches the backend CollectingAgentActivityType enum so numeric
// values map correctly when the API returns the raw int.
const ACTIVITY_TYPE_KEYS = [
  'PaymentCollected',
  'PaymentAttempted',
  'ParentContact',
  'SupportRequestHandled',
  'ParentAssigned',
  'ParentUnassigned',
  'FieldVisit',
  'PhoneCall',
  'Other',
] as const;

type ActivityKey = (typeof ACTIVITY_TYPE_KEYS)[number];

const ACTIVITY_META: Record<
  ActivityKey,
  {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    colorToken: 'primary' | 'success' | 'warning' | 'secondary';
  }
> = {
  PaymentCollected: { icon: 'cash-outline', label: 'Payment Collected', colorToken: 'success' },
  PaymentAttempted: { icon: 'alert-circle-outline', label: 'Payment Attempt', colorToken: 'warning' },
  ParentContact: { icon: 'chatbubble-ellipses-outline', label: 'Parent Contact', colorToken: 'primary' },
  SupportRequestHandled: { icon: 'help-buoy-outline', label: 'Support Handled', colorToken: 'secondary' },
  ParentAssigned: { icon: 'link-outline', label: 'Parent Assigned', colorToken: 'primary' },
  ParentUnassigned: { icon: 'unlink-outline', label: 'Parent Unassigned', colorToken: 'warning' },
  FieldVisit: { icon: 'navigate-outline', label: 'Field Visit', colorToken: 'primary' },
  PhoneCall: { icon: 'call-outline', label: 'Phone Call', colorToken: 'secondary' },
  Other: { icon: 'ellipse-outline', label: 'Other', colorToken: 'primary' },
};

const FILTER_OPTIONS: { value: ActivityKey | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PaymentCollected', label: 'Payments' },
  { value: 'PhoneCall', label: 'Calls' },
  { value: 'FieldVisit', label: 'Visits' },
  { value: 'ParentContact', label: 'Contacts' },
  { value: 'Other', label: 'Other' },
];

const normalizeActivityType = (value: string | number | undefined): ActivityKey => {
  if (typeof value === 'number') {
    return ACTIVITY_TYPE_KEYS[value] ?? 'Other';
  }
  if (value && (ACTIVITY_TYPE_KEYS as readonly string[]).includes(value)) {
    return value as ActivityKey;
  }
  return 'Other';
};

const MyActivitiesScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [filter, setFilter] = useState<ActivityKey | 'all'>('all');

  const { data, isLoading, isFetching, refetch } = useGetMyActivitiesQuery({
    pageNumber: 1,
    pageSize: 100,
    activityType: filter === 'all' ? undefined : filter,
  });

  const activities = useMemo(() => (Array.isArray(data?.data) ? data!.data : []), [data]);

  const resolveIconColor = (colorToken: (typeof ACTIVITY_META)[ActivityKey]['colorToken']) => {
    switch (colorToken) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'secondary':
        return theme.colors.secondary;
      default:
        return theme.colors.primary;
    }
  };

  const renderItem = ({ item }: { item: CollectingAgentActivity }) => {
    const key = normalizeActivityType(item.activityType);
    const meta = ACTIVITY_META[key];
    const iconColor = resolveIconColor(meta.colorToken);
    return (
      <ThemedCard variant="outlined" style={styles.activityCard}>
        <View style={styles.activityRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: iconColor + '15', borderRadius: theme.borderRadius.md },
            ]}
          >
            <Ionicons name={meta.icon} size={18} color={iconColor} />
          </View>

          <View style={styles.activityContent}>
            <View style={styles.activityHeader}>
              <ThemedText variant="bodySmall" style={styles.activityTitle}>
                {t(`agent.activities.types.${key}`, meta.label)}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {formatDate(item.activityDate || item.createdOn || new Date().toISOString())}
              </ThemedText>
            </View>

            <ThemedText variant="body" style={styles.activityDescription}>
              {item.activityDescription}
            </ThemedText>

            {(item.parent?.firstName || item.fK_ParentId) ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {item.parent?.firstName && item.parent?.lastName
                  ? `${item.parent.firstName} ${item.parent.lastName}`
                  : t('agent.activities.parentAnonymous', 'Parent')}
              </ThemedText>
            ) : null}

            {!!item.notes && (
              <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.notes}>
                {item.notes}
              </ThemedText>
            )}
          </View>
        </View>
      </ThemedCard>
    );
  };

  const headerBlock = (
    <>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1" style={styles.headerTitle}>
          {t('agent.activities.title', 'My Activities')}
        </ThemedText>
      </View>

      <ThemedButton
        title={t('agent.activities.logNew', 'Log New Activity')}
        variant="primary"
        onPress={() => router.push('/(app)/log-activity')}
        style={styles.logBtn}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const selected = filter === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFilter(opt.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
            >
              <ThemedText
                variant="caption"
                color={selected ? '#FFFFFF' : theme.colors.text}
                style={styles.chipLabel}
              >
                {t(`agent.activities.filters.${opt.value}`, opt.label)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  if (isLoading && !data) {
    return (
      <ScreenContainer>
        {headerBlock}
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <FlatList
        data={activities}
        keyExtractor={(item) => String(item.activityId)}
        renderItem={renderItem}
        ListHeaderComponent={headerBlock}
        ListEmptyComponent={
          <EmptyState
            icon="pulse-outline"
            title={t('agent.activities.emptyTitle', 'No activities yet')}
            description={t(
              'agent.activities.emptyDescription',
              'Log a phone call, field visit or payment to start tracking your work here.',
            )}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
  },
  logBtn: {
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipLabel: {
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  activityCard: {
    marginBottom: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  activityTitle: {
    fontWeight: '700',
    flex: 1,
  },
  activityDescription: {
    marginBottom: 6,
  },
  notes: {
    marginTop: 4,
  },
});

export default MyActivitiesScreen;
