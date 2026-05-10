import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  EmptyState,
  LoadingSkeleton,
  StatusTimeline,
  supportRequestTimeline,
} from '../../components';
import { useGetAllSupportRequestsQuery } from '../../services/api/apiSlice';
import { SUPPORT_REQUEST_DIRECTIONS, SUPPORT_REQUEST_STATUSES } from '../../constants';
import { formatDate } from '../../utils';
import type { SupportRequest } from '../../types';

type SupportFilter = 'all' | 'open' | 'inProgress' | 'resolved';

const FILTERS: { key: SupportFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const getStatusLabel = (statusId: number, t: any): string => {
  switch (statusId) {
    case SUPPORT_REQUEST_STATUSES.Pending:
      return t('support.open', 'Open');
    case SUPPORT_REQUEST_STATUSES.InProgress:
      return t('support.inProgress', 'In Progress');
    case SUPPORT_REQUEST_STATUSES.Resolved:
      return t('support.resolved', 'Resolved');
    case SUPPORT_REQUEST_STATUSES.Stall:
      return t('support.stall', 'Stall');
    case SUPPORT_REQUEST_STATUSES.Cancelled:
      return t('support.cancelled', 'Cancelled');
    default:
      return t('support.open', 'Open');
  }
};

const getStatusColor = (statusId: number, colors: any): string => {
  switch (statusId) {
    case SUPPORT_REQUEST_STATUSES.Pending:
      return colors.warning;
    case SUPPORT_REQUEST_STATUSES.InProgress:
      return colors.info;
    case SUPPORT_REQUEST_STATUSES.Resolved:
      return colors.success;
    case SUPPORT_REQUEST_STATUSES.Stall:
      return colors.accent;
    case SUPPORT_REQUEST_STATUSES.Cancelled:
      return colors.error;
    default:
      return colors.warning;
  }
};

const getPriorityColor = (priority: unknown, colors: any): string => {
  const normalized = String(priority ?? '').toLowerCase();

  if (normalized === '0') return colors.info;
  if (normalized === '1') return colors.warning;
  if (normalized === '2') return colors.accent;
  if (normalized === '3') return colors.error;

  switch (normalized) {
    case 'Low':
    case 'low':
      return colors.info;
    case 'Medium':
    case 'medium':
      return colors.warning;
    case 'High':
    case 'high':
      return colors.accent;
    case 'Urgent':
    case 'urgent':
      return colors.error;
    default:
      return colors.info;
  }
};

const translateSupportType = (value: unknown, t: any): string => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === '0') return t('support.general', 'General');
  if (normalized === '1') return t('support.payment', 'Payment Issue');
  if (normalized === '2') return t('support.help', 'Help');
  if (normalized === 'general') return t('support.general', 'General');
  if (normalized === 'payment') return t('support.payment', 'Payment Issue');
  if (normalized === 'help') return t('support.help', 'Help');
  return String(value ?? '');
};

const translatePriority = (value: unknown, t: any): string => {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === '0') return t('support.low', 'Low');
  if (normalized === '1') return t('support.medium', 'Medium');
  if (normalized === '2') return t('support.high', 'High');
  if (normalized === '3') return t('support.urgent', 'Urgent');
  if (normalized === 'low') return t('support.low', 'Low');
  if (normalized === 'medium') return t('support.medium', 'Medium');
  if (normalized === 'high') return t('support.high', 'High');
  if (normalized === 'urgent') return t('support.urgent', 'Urgent');
  return String(value ?? '');
};

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 70),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function SupportScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<SupportFilter>('all');
  const role = useAppSelector((state) => state.auth.user?.role);
  const canUseMwanaBot = role === 'parent';

  const source = useMemo(() => {
    if (role === 'agent') {
      return SUPPORT_REQUEST_DIRECTIONS.AgentToDirector;
    }

    if (role === 'parent') {
      return SUPPORT_REQUEST_DIRECTIONS.ParentToDirector;
    }

    return null;
  }, [role]);

  const { data: supportData, isLoading } = useGetAllSupportRequestsQuery(
    {
      source: source ?? undefined,
      pageNumber: 1,
      pageSize: 20,
      filterByCurrentUser: true,
    },
    { skip: !source },
  );

  const requests = supportData?.data ?? [];

  const filteredRequests = requests.filter((request: SupportRequest) => {
    if (activeFilter === 'all') {
      return true;
    }

    if (activeFilter === 'open') {
      return request.fK_StatusId === SUPPORT_REQUEST_STATUSES.Pending;
    }

    if (activeFilter === 'inProgress') {
      return request.fK_StatusId === SUPPORT_REQUEST_STATUSES.InProgress;
    }

    return request.fK_StatusId === SUPPORT_REQUEST_STATUSES.Resolved;
  });

  if (!source) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="chatbubbles-outline"
          title={t('support.noRequests', 'No Support Requests')}
          description={t(
            'support.unsupportedRole',
            'Support request tracking is currently available for parent and agent accounts.',
          )}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AnimatedSection index={0}>
        {canUseMwanaBot && (
          <ThemedButton
            title="Parler avec MwanaBot"
            onPress={() => router.push('/(app)/mwana-bot')}
            variant="secondary"
            size="md"
            fullWidth
            icon={<Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.primary} />}
            style={styles.mwanaBotBtn}
          />
        )}
        <ThemedButton
          title={t('support.newRequest', 'New Request')}
          onPress={() => router.push('/(app)/support-request')}
          variant="primary"
          size="md"
          fullWidth
          icon={<Ionicons name="add-circle" size={20} color="#FFFFFF" />}
          style={styles.newRequestBtn}
        />
      </AnimatedSection>

      <AnimatedSection index={1}>
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.inputBackground,
                    borderRadius: theme.borderRadius.full,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                  style={{ fontWeight: '600' }}
                >
                  {t(`support.filter.${filter.key}`, filter.label)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </AnimatedSection>

      {isLoading ? (
        <>
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
        </>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t('support.noRequests', 'No Support Requests')}
          description={t(
            'support.noRequestsDescription',
            'You have no support requests matching this filter.',
          )}
        />
      ) : (
        filteredRequests.map((request: SupportRequest, index: number) => {
          const priorityColor = getPriorityColor(request.priority, theme.colors);
          const statusColor = getStatusColor(request.fK_StatusId, theme.colors);
          const statusLabel = getStatusLabel(request.fK_StatusId, t);
          const requestTypeLabel = translateSupportType(request.supportRequestType, t);
          const priorityLabel = translatePriority(request.priority, t);
          const timeline = supportRequestTimeline(request.fK_StatusId);

          return (
            <AnimatedSection key={request.supportRequestId} index={index + 2}>
              <ThemedCard
                variant="elevated"
                style={styles.requestCard}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.titleWrap}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <ThemedText
                      variant="body"
                      style={styles.requestTitle}
                      numberOfLines={1}
                    >
                      {request.title}
                    </ThemedText>
                  </View>
                  <ThemedText variant="caption" color={theme.colors.textTertiary}>
                    {formatDate(request.createdOn ?? '')}
                  </ThemedText>
                </View>

                {!!request.description && (
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={styles.requestDescription}
                    numberOfLines={2}
                  >
                    {request.description}
                  </ThemedText>
                )}

                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: theme.colors.primary + '15',
                        borderColor: theme.colors.primary + '35',
                        borderWidth: 1,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color={theme.colors.primary}
                      style={styles.badgeText}
                    >
                      {requestTypeLabel}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: priorityColor + '15',
                        borderColor: priorityColor + '35',
                        borderWidth: 1,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color={priorityColor}
                      style={styles.badgeText}
                    >
                      {priorityLabel}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: statusColor + '15',
                        borderColor: statusColor + '35',
                        borderWidth: 1,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color={statusColor}
                      style={styles.badgeText}
                    >
                      {statusLabel}
                    </ThemedText>
                  </View>
                </View>
                <StatusTimeline steps={timeline.steps} currentKey={timeline.currentKey} compact />
              </ThemedCard>
            </AnimatedSection>
          );
        })
      )}

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mwanaBotBtn: {
    marginTop: 8,
  },
  newRequestBtn: {
    marginTop: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestCard: {
    marginBottom: 12,
    paddingVertical: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  requestTitle: {
    fontWeight: '700',
    flex: 1,
  },
  requestDescription: {
    marginBottom: 10,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontWeight: '700',
  },
});
