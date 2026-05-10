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
  useAlert,
  StatusTimeline,
  activityRequestTimeline,
  BackButton,
} from '../../components';
import { useTheme } from '../../theme';
import {
  useGetMyActivitiesQuery,
  useGetAgentActivityRequestsQuery,
  useAcceptActivityRequestMutation,
  useDeclineActivityRequestMutation,
  useCompleteActivityRequestMutation,
} from '../../services/api/apiSlice';
import { formatDateTimeCongo, normalizeRequestStatus } from '../../utils';
import type {
  CollectingAgentActivity,
  ActivityRequestStatus,
} from '../../types';

// Order matches the backend CollectingAgentActivityType enum so numeric
// values map correctly when the API returns the raw int.
// PaymentHelp (9) was added for the parent-initiated request flow.
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
  'PaymentHelp',
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
  PaymentHelp: { icon: 'cash-outline', label: 'Payment Help', colorToken: 'success' },
};

// ---------------------------------------------------------------------------
// Badge colors for request lifecycle. Keep in sync with the parent-side
// ParentAgentDetailScreen so a row looks the same on both sides of the loop.
// ---------------------------------------------------------------------------

type BadgeTheme = { bg: string; fg: string; label: string };

const useRequestStatusTheme = (): Record<ActivityRequestStatus, BadgeTheme> => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return {
    Requested: {
      bg: theme.colors.warning + '22',
      fg: theme.colors.warning,
      label: t('parent.requestActivity.status.Requested', 'Pending'),
    },
    Accepted: {
      bg: theme.colors.primary + '22',
      fg: theme.colors.primary,
      label: t('parent.requestActivity.status.Accepted', 'Accepted'),
    },
    Declined: {
      bg: theme.colors.error + '22',
      fg: theme.colors.error,
      label: t('parent.requestActivity.status.Declined', 'Declined'),
    },
    Completed: {
      bg: theme.colors.success + '22',
      fg: theme.colors.success,
      label: t('parent.requestActivity.status.Completed', 'Completed'),
    },
    Cancelled: {
      bg: theme.colors.textTertiary + '22',
      fg: theme.colors.textTertiary,
      label: t('parent.requestActivity.status.Cancelled', 'Cancelled'),
    },
  };
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
  const { showAlert } = useAlert();
  const requestStatusTheme = useRequestStatusTheme();

  const [filter, setFilter] = useState<ActivityKey | 'all'>('all');

  const { data, isLoading, isFetching, refetch } = useGetMyActivitiesQuery({
    pageNumber: 1,
    pageSize: 100,
    activityType: filter === 'all' ? undefined : filter,
  });

  // Incoming parent-initiated requests. Only Requested + Accepted are
  // actionable; Declined / Completed / Cancelled are terminal and already
  // appear in the normal activities list below.
  const { data: requestsData, refetch: refetchRequests } =
    useGetAgentActivityRequestsQuery({ pageNumber: 1, pageSize: 50 });

  const pendingRequests = useMemo(() => {
    const rows = Array.isArray(requestsData?.data) ? requestsData!.data : [];
    // Normalize first — backend may serialize ActivityRequestStatus as
    // either the string ("Requested") or the numeric enum (1). Strict
    // equality on string literals would silently drop every row when
    // the wire is numeric.
    return rows.filter((r) => {
      const status = normalizeRequestStatus(r.requestStatus);
      return status === 'Requested' || status === 'Accepted';
    });
  }, [requestsData]);

  const [acceptRequest, { isLoading: accepting }] = useAcceptActivityRequestMutation();
  const [declineRequest, { isLoading: declining }] = useDeclineActivityRequestMutation();
  const [completeRequest, { isLoading: completing }] = useCompleteActivityRequestMutation();

  const activities = useMemo(() => (Array.isArray(data?.data) ? data!.data : []), [data]);

  const handleOpenActivity = (activityId: number) => {
    router.push({
      pathname: '/agent-activity-detail',
      params: { activityId: String(activityId) },
    });
  };

  const handleAccept = async (activityId: number) => {
    try {
      const result = await acceptRequest({ activityId }).unwrap();
      if (result.status === 'Success') {
        refetchRequests();
        refetch();
      } else {
        showAlert({
          type: 'error',
          title: t('common.error', 'Error'),
          message: result.error || t('common.genericError', 'Something went wrong'),
        });
      }
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: t('common.error', 'Error'),
        message: err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
      });
    }
  };

  const handleDecline = (activityId: number) => {
    showAlert({
      type: 'warning',
      title: t('agent.activities.declineTitle', 'Decline Request'),
      message: t(
        'agent.activities.declinePrompt',
        'The parent will be notified that you cannot handle this request.',
      ),
      buttons: [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('agent.activities.decline', 'Decline'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await declineRequest({ activityId }).unwrap();
              if (result.status === 'Success') {
                refetchRequests();
                refetch();
              } else {
                showAlert({
                  type: 'error',
                  title: t('common.error', 'Error'),
                  message: result.error || t('common.genericError', 'Something went wrong'),
                });
              }
            } catch (err: any) {
              showAlert({
                type: 'error',
                title: t('common.error', 'Error'),
                message:
                  err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
              });
            }
          },
        },
      ],
    });
  };

  const handleComplete = (activityId: number) => {
    showAlert({
      type: 'info',
      title: t('agent.activities.completeTitle', 'Mark as completed?'),
      message: t(
        'agent.activities.completePrompt',
        'The parent will be notified that this activity is done.',
      ),
      buttons: [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('agent.activities.complete', 'Complete'),
          onPress: async () => {
            try {
              const result = await completeRequest({ activityId }).unwrap();
              if (result.status === 'Success') {
                refetchRequests();
                refetch();
              } else {
                showAlert({
                  type: 'error',
                  title: t('common.error', 'Error'),
                  message: result.error || t('common.genericError', 'Something went wrong'),
                });
              }
            } catch (err: any) {
              showAlert({
                type: 'error',
                title: t('common.error', 'Error'),
                message:
                  err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
              });
            }
          },
        },
      ],
    });
  };

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

  const renderPendingRequest = (item: CollectingAgentActivity) => {
    const key = normalizeActivityType(item.activityType);
    const meta = ACTIVITY_META[key];
    const iconColor = resolveIconColor(meta.colorToken);
    const status = normalizeRequestStatus(item.requestStatus);
    const badge = status ? requestStatusTheme[status] : null;
    const timeline = status ? activityRequestTimeline(status) : null;
    const isRequested = status === 'Requested';
    const isAccepted = status === 'Accepted';
    const parentName =
      item.parent?.firstName && item.parent?.lastName
        ? `${item.parent.firstName} ${item.parent.lastName}`
        : item.parentName || t('agent.activities.parentAnonymous', 'Parent');
    return (
      <ThemedCard
        key={item.activityId}
        variant="elevated"
        onPress={() => handleOpenActivity(item.activityId)}
        style={{
          ...styles.requestCard,
          borderColor: theme.colors.primary,
          borderWidth: 1,
          borderRadius: theme.borderRadius.md,
        }}
      >
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
              {badge ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: badge.bg, borderRadius: theme.borderRadius.sm },
                  ]}
                >
                  <ThemedText variant="caption" color={badge.fg} style={styles.badgeLabel}>
                    {badge.label}
                  </ThemedText>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </View>

            <ThemedText variant="body" style={styles.activityDescription}>
              {item.activityDescription}
            </ThemedText>

            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('agent.activities.from', 'From')}: {parentName}
            </ThemedText>

            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {formatDateTimeCongo(
                item.requestedAt || item.activityDate || item.createdOn || new Date().toISOString(),
              )}
            </ThemedText>

            {!!item.notes && (
              <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.notes}>
                {item.notes}
              </ThemedText>
            )}

            {timeline ? (
              <StatusTimeline steps={timeline.steps} currentKey={timeline.currentKey} compact />
            ) : null}

            <View style={styles.actionsRow}>
              {isRequested ? (
                <>
                  <ThemedButton
                    title={t('agent.activities.accept', 'Accept')}
                    variant="primary"
                    onPress={() => handleAccept(item.activityId)}
                    loading={accepting}
                    style={styles.actionBtn}
                  />
                  <ThemedButton
                    title={t('agent.activities.decline', 'Decline')}
                    variant="ghost"
                    onPress={() => handleDecline(item.activityId)}
                    loading={declining}
                    style={styles.actionBtn}
                  />
                </>
              ) : isAccepted ? (
                <ThemedButton
                  title={t('agent.activities.markComplete', 'Mark Completed')}
                  variant="primary"
                  onPress={() => handleComplete(item.activityId)}
                  loading={completing}
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          </View>
        </View>
      </ThemedCard>
    );
  };

  const renderItem = ({ item }: { item: CollectingAgentActivity }) => {
    const key = normalizeActivityType(item.activityType);
    const meta = ACTIVITY_META[key];
    const iconColor = resolveIconColor(meta.colorToken);
    const status = normalizeRequestStatus(item.requestStatus);
    const badge = status ? requestStatusTheme[status] : null;
    const timeline = status ? activityRequestTimeline(status) : null;
    return (
      <ThemedCard
        variant="outlined"
        onPress={() => handleOpenActivity(item.activityId)}
        style={styles.activityCard}
      >
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
                {formatDateTimeCongo(item.activityDate || item.createdOn || new Date().toISOString())}
              </ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </View>

            {badge ? (
              <View
                style={[
                  styles.inlineBadge,
                  { backgroundColor: badge.bg, borderRadius: theme.borderRadius.sm },
                ]}
              >
                <ThemedText variant="caption" color={badge.fg} style={styles.badgeLabel}>
                  {badge.label}
                </ThemedText>
              </View>
            ) : null}

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

            {timeline ? (
              <StatusTimeline steps={timeline.steps} currentKey={timeline.currentKey} compact />
            ) : null}
          </View>
        </View>
      </ThemedCard>
    );
  };

  const headerBlock = (
    <>
      <View style={styles.headerRow}>
        <BackButton label={t('common.back', 'Retour')} showLabel={false} style={styles.backBtn} />
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

      {pendingRequests.length > 0 ? (
        <View style={styles.inboxSection}>
          <View style={styles.inboxTitleRow}>
            <Ionicons name="mail-unread-outline" size={18} color={theme.colors.primary} />
            <ThemedText variant="bodySmall" style={styles.inboxTitle}>
              {t('agent.activities.inboxTitle', 'Parent Requests')} ({pendingRequests.length})
            </ThemedText>
          </View>
          {pendingRequests.map(renderPendingRequest)}
        </View>
      ) : null}

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
  inboxSection: {
    marginBottom: 16,
  },
  inboxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inboxTitle: {
    fontWeight: '700',
  },
  requestCard: {
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inlineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  badgeLabel: {
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
  },
});

export default MyActivitiesScreen;
