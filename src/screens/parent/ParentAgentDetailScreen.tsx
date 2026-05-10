import React, { useMemo } from 'react';
import {
  View, StyleSheet, Linking, Pressable
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  ScreenSkeleton,
  SectionHeader,
  ThemedButton,
  useAlert,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetParentsCollectingAgentsQuery,
  useGetMyAgentRequestsQuery,
  useGetMyActivityRequestsQuery,
  useCancelActivityRequestMutation,
} from '../../services/api/apiSlice';
import { formatDate, formatDateTimeCongo, normalizeRequestStatus } from '../../utils';
import type {
  CollectingAgentParents,
  CollectingAgentActivity,
  ActivityRequestStatus,
} from '../../types';

// ---------------------------------------------------------------------------
// Phone formatting consistent with director screens
// ---------------------------------------------------------------------------

const COUNTRY_CODE = '242';

const formatAgentPhone = (countryCode?: string, phoneNumber?: string): string => {
  const cc = (countryCode || COUNTRY_CODE).replace(/\D/g, '') || COUNTRY_CODE;
  const raw = (phoneNumber || '').replace(/\D/g, '');
  const local = raw.startsWith(cc) ? raw.slice(cc.length) : raw;
  if (local.length >= 9) {
    return `+${cc} ${local.slice(-9, -6)} ${local.slice(-6, -3)} ${local.slice(-3)}`;
  }
  if (local.length > 0) return `+${cc} ${local}`;
  return `+${cc}`;
};

const rawPhoneDigits = (countryCode?: string, phoneNumber?: string): string => {
  const cc = (countryCode || COUNTRY_CODE).replace(/\D/g, '') || COUNTRY_CODE;
  const raw = (phoneNumber || '').replace(/\D/g, '');
  return raw.startsWith(cc) ? raw : `${cc}${raw}`;
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Colors for the request-lifecycle badge. Keep in sync with the agent-side
// MyActivitiesScreen so a row looks the same on both sides of the request.
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

const ParentAgentDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ collectingAgentParentId?: string }>();
  const id = parseInt(params.collectingAgentParentId || '0');
  const statusTheme = useRequestStatusTheme();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const { data: approvedData, isLoading: l1 } = useGetParentsCollectingAgentsQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );
  const { data: requestsData, isLoading: l2 } = useGetMyAgentRequestsQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  // Outgoing activity requests — limit to the current agent below. Fetched
  // unconditionally (backend already filters by the signed-in parent); the
  // client slice narrows down to rows for this agent.
  const { data: activityRequestsData } = useGetMyActivityRequestsQuery(
    { pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );
  const [cancelActivityRequest, { isLoading: cancelling }] =
    useCancelActivityRequestMutation();

  const row: CollectingAgentParents | undefined = useMemo(() => {
    const all = [...(approvedData?.data ?? []), ...(requestsData?.data ?? [])];
    return all.find((r) => r.collectingAgentParentId === id);
  }, [approvedData, requestsData, id]);

  const isLoading = l1 || l2;

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={4} />
      </ScreenContainer>
    );
  }

  if (!row) {
    return (
      <ScreenContainer>
        <Animated.View style={[styles.headerRow, headerAnim]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <ThemedText variant="h1">{t('parent.agents.detailTitle', 'Agent Details')}</ThemedText>
        </Animated.View>
        <ThemedText variant="body" color={theme.colors.textSecondary}>
          {t('parent.agents.notFound', 'Agent not found')}
        </ThemedText>
      </ScreenContainer>
    );
  }

  const agent = row.collectingAgent;
  const firstName = agent?.firstName || '';
  const lastName = agent?.lastName || '';
  const phonePretty = formatAgentPhone(agent?.countryCode, agent?.phoneNumber);
  const phoneRaw = rawPhoneDigits(agent?.countryCode, agent?.phoneNumber);

  const statusKey: 'Approved' | 'Pending' | 'Rejected' =
    (row.approvalStatus as any) || 'Approved';

  const statusConfig: Record<string, { bg: string; label: string }> = {
    Approved: {
      bg: theme.colors.success,
      label: t('parent.agents.statusApproved', 'Active'),
    },
    Pending: {
      bg: theme.colors.warning,
      label: t('parent.agents.statusPending', 'Pending'),
    },
    Rejected: {
      bg: theme.colors.error,
      label: t('parent.agents.statusRejected', 'Rejected'),
    },
  };
  const sc = statusConfig[statusKey] || statusConfig.Approved;

  // ---- Outgoing activity-request data for THIS agent ----------------------
  const agentIdForFilter = agent?.collectingAgentId;
  const outgoingRequests: CollectingAgentActivity[] = useMemo(() => {
    const rows = activityRequestsData?.data ?? [];
    if (!agentIdForFilter) return [];
    return rows.filter(
      (r) =>
        (r.collectingAgentId ?? r.fK_CollectingAgentId) === agentIdForFilter,
    );
  }, [activityRequestsData, agentIdForFilter]);

  const canRequestActivity = statusKey === 'Approved';

  const handleRequestActivity = () => {
    if (!agent?.collectingAgentId) return;
    router.push({
      pathname: '/request-activity',
      params: { collectingAgentId: String(agent.collectingAgentId) },
    });
  };

  const handleViewActivityRequest = (req: CollectingAgentActivity) => {
    router.push({
      pathname: '/activity-request-detail',
      params: { activityId: String(req.activityId) },
    });
  };

  const handleCancelRequest = (req: CollectingAgentActivity) => {
    showAlert({
      type: 'warning',
      title: t('parent.requestActivity.cancelTitle', 'Cancel request?'),
      message: t(
        'parent.requestActivity.cancelConfirm',
        'The agent will no longer see this request.',
      ),
      buttons: [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('parent.requestActivity.cancelConfirmButton', 'Yes, cancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelActivityRequest({
                activityId: req.activityId,
              }).unwrap();
              if (result.status !== 'Success') {
                showAlert({
                  type: 'error',
                  title: t('common.error', 'Error'),
                  message:
                    result.error ||
                    t('common.genericError', 'Something went wrong'),
                });
              }
            } catch (err: any) {
              showAlert({
                type: 'error',
                title: t('common.error', 'Error'),
                message:
                  err?.data?.error ||
                  err?.message ||
                  t('common.genericError', 'Something went wrong'),
              });
            }
          },
        },
      ],
    });
  };

  const handleCall = () => {
    if (!phoneRaw) return;
    Linking.openURL(`tel:+${phoneRaw}`).catch(() => {
      Alert.alert(t('common.error', 'Error'), t('parent.agents.callFailed', 'Unable to start the call'));
    });
  };
  const handleEmail = () => {
    if (!agent?.email) return;
    Linking.openURL(`mailto:${agent.email}`).catch(() => {
      Alert.alert(t('common.error', 'Error'), t('parent.agents.emailFailed', 'Unable to open email'));
    });
  };

  return (
    <ScreenContainer>
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1">{t('parent.agents.detailTitle', 'Agent Details')}</ThemedText>
      </Animated.View>

      {/* Profile card */}
      <ThemedCard variant="elevated" style={styles.profileCard}>
        <View style={styles.profileRow}>
          <Avatar firstName={firstName} lastName={lastName} size="xl" />
          <View style={styles.profileInfo}>
            <ThemedText variant="h2">
              {firstName} {lastName}
            </ThemedText>
            {agent?.assignedArea ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {agent.assignedArea}
              </ThemedText>
            ) : null}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: sc.bg, borderRadius: theme.borderRadius.full },
              ]}
            >
              <ThemedText variant="caption" color="#FFFFFF" style={styles.statusTxt}>
                {sc.label}
              </ThemedText>
            </View>
          </View>
        </View>
      </ThemedCard>

      {/* Contact */}
      <SectionHeader title={t('parent.agents.contact', 'Contact')} style={styles.section} />
      <ThemedCard variant="outlined" style={styles.contactCard}>
        <Pressable style={styles.contactRow} onPress={handleCall}>
          <View
            style={[
              styles.contactIcon,
              { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.full },
            ]}
          >
            <Ionicons name="call-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.contactText}>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('parent.agents.phone', 'Phone')}
            </ThemedText>
            <ThemedText variant="body">{phonePretty}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
        </Pressable>

        {agent?.email ? (
          <Pressable style={styles.contactRow} onPress={handleEmail}>
            <View
              style={[
                styles.contactIcon,
                { backgroundColor: theme.colors.secondary + '15', borderRadius: theme.borderRadius.full },
              ]}
            >
              <Ionicons name="mail-outline" size={20} color={theme.colors.secondary} />
            </View>
            <View style={styles.contactText}>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('parent.agents.email', 'Email')}
              </ThemedText>
              <ThemedText variant="body">{agent.email}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        ) : null}
      </ThemedCard>

      {/* Assignment info */}
      <SectionHeader
        title={t('parent.agents.assignment', 'Assignment')}
        style={styles.section}
      />
      <ThemedCard variant="outlined" style={styles.contactCard}>
        <View style={styles.metaRow}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {statusKey === 'Pending'
              ? t('parent.agents.requestedOn', 'Requested on')
              : statusKey === 'Rejected'
                ? t('parent.agents.rejectedOn', 'Rejected on')
                : t('parent.agents.assignedOn', 'Assigned on')}
          </ThemedText>
          <ThemedText variant="body">
            {formatDate(
              statusKey === 'Rejected' && row.reviewedDate
                ? row.reviewedDate
                : row.assignedDate,
            )}
          </ThemedText>
        </View>

        {row.assignmentNotes ? (
          <View style={styles.metaRow}>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('parent.agents.notes', 'Notes')}
            </ThemedText>
            <ThemedText variant="body">{row.assignmentNotes}</ThemedText>
          </View>
        ) : null}

        {row.approvalNotes && statusKey !== 'Approved' ? (
          <View style={styles.metaRow}>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('parent.agents.directorNote', 'Director note')}
            </ThemedText>
            <ThemedText variant="body">{row.approvalNotes}</ThemedText>
          </View>
        ) : null}
      </ThemedCard>

      {/* "Request an activity" CTA — only while the assignment is Approved.
          Pending / Rejected rows can't file requests (backend enforces it). */}
      {canRequestActivity ? (
        <ThemedButton
          title={t('parent.requestActivity.cta', 'Request an Activity')}
          variant="primary"
          onPress={handleRequestActivity}
          style={styles.ctaBtn}
        />
      ) : null}

      {/* Outgoing requests for THIS agent */}
      {canRequestActivity ? (
        <>
          <SectionHeader
            title={t('parent.requestActivity.yourRequests', 'Your Requests')}
            style={styles.section}
          />
          {outgoingRequests.length === 0 ? (
            <ThemedCard variant="outlined" style={styles.emptyCard}>
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t(
                  'parent.requestActivity.noneYet',
                  "You haven't asked this agent for anything yet.",
                )}
              </ThemedText>
            </ThemedCard>
          ) : (
            <View style={styles.requestList}>
              {outgoingRequests.map((req) => {
                // Backend may emit the status as a string ("Requested")
                // or a numeric enum (1). Normalize to the canonical
                // string form before comparing.
                const status = normalizeRequestStatus(req.requestStatus) ?? 'Requested';
                const badge = statusTheme[status as ActivityRequestStatus];
                const canCancel =
                  status === 'Requested' || status === 'Accepted';
                return (
                  <ThemedCard
                    key={req.activityId}
                    variant="outlined"
                    onPress={() => handleViewActivityRequest(req)}
                    style={styles.requestCard}
                  >
                    <View style={styles.requestHeader}>
                      <ThemedText
                        variant="bodySmall"
                        style={{ fontWeight: '600', flex: 1 }}
                      >
                        {req.activityTypeDisplayName ||
                          String(req.activityType)}
                      </ThemedText>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: badge.bg,
                            borderRadius: theme.borderRadius.full,
                          },
                        ]}
                      >
                        <ThemedText
                          variant="caption"
                          color={badge.fg}
                          style={styles.badgeLabel}
                        >
                          {badge.label}
                        </ThemedText>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.colors.textTertiary}
                      />
                    </View>
                    <ThemedText variant="body" style={{ marginTop: 4 }}>
                      {req.activityDescription}
                    </ThemedText>
                    <ThemedText
                      variant="caption"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: 4 }}
                    >
                      {formatDateTimeCongo(
                        req.requestedAt ||
                        req.createdOn ||
                        new Date().toISOString(),
                      )}
                    </ThemedText>
                    {status === 'Declined' && req.declineReason ? (
                      <ThemedText
                        variant="caption"
                        color={theme.colors.error}
                        style={{ marginTop: 4 }}
                      >
                        {t('parent.requestActivity.declinedReason', 'Reason')}:{' '}
                        {req.declineReason}
                      </ThemedText>
                    ) : null}
                    <ThemedText
                      variant="caption"
                      color={theme.colors.primary}
                      style={styles.openDetailsText}
                    >
                      {t('parent.requestActivity.openDetails', 'View timeline')}
                    </ThemedText>
                    {canCancel ? (
                      <ThemedButton
                        title={t(
                          'parent.requestActivity.cancelButton',
                          'Cancel',
                        )}
                        variant="ghost"
                        onPress={() => handleCancelRequest(req)}
                        loading={cancelling}
                        style={styles.cancelBtn}
                      />
                    ) : null}
                  </ThemedCard>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusTxt: {
    fontWeight: '600',
    fontSize: 11,
  },
  section: {
    marginTop: 8,
  },
  contactCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
  },
  metaRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  ctaBtn: {
    marginTop: 12,
  },
  requestList: {
    gap: 10,
  },
  requestCard: {
    padding: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeLabel: {
    fontWeight: '600',
    fontSize: 11,
  },
  cancelBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  openDetailsText: {
    marginTop: 8,
    fontWeight: '700',
  },
  emptyCard: {
    paddingVertical: 16,
  },
});

export default ParentAgentDetailScreen;
