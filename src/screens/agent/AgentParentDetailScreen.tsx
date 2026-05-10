import React, { useMemo } from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
  ScreenSkeleton,
  SectionHeader,
  EmptyState,
  BackButton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetSingleParentQuery,
  useGetAgentParentsQuery,
  useGetParentChildrenQuery,
  useGetMyActivitiesQuery,
} from '../../services/api/apiSlice';
import { formatDateTimeCongo, normalizeRequestStatus } from '../../utils';
import type {
  ActivityRequestStatus,
  CollectingAgentActivity,
  Parent,
} from '../../types';

// ---------------------------------------------------------------------------
// Activity-type metadata — reused from MyActivitiesScreen so the detail page
// looks consistent with the global activities list.
// ---------------------------------------------------------------------------

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

const ACTIVITY_ICON: Record<ActivityKey, keyof typeof Ionicons.glyphMap> = {
  PaymentCollected: 'cash-outline',
  PaymentAttempted: 'alert-circle-outline',
  ParentContact: 'chatbubble-ellipses-outline',
  SupportRequestHandled: 'help-buoy-outline',
  ParentAssigned: 'link-outline',
  ParentUnassigned: 'unlink-outline',
  FieldVisit: 'navigate-outline',
  PhoneCall: 'call-outline',
  Other: 'ellipse-outline',
  PaymentHelp: 'cash-outline',
};

const normalizeActivityType = (value: string | number | undefined): ActivityKey => {
  if (typeof value === 'number') return ACTIVITY_TYPE_KEYS[value] ?? 'Other';
  if (value && (ACTIVITY_TYPE_KEYS as readonly string[]).includes(value)) {
    return value as ActivityKey;
  }
  return 'Other';
};

// ---------------------------------------------------------------------------
// Phone formatting — same shape used by the parent-side detail screens.
// ---------------------------------------------------------------------------

const COUNTRY_CODE = '242';

const formatPhone = (raw?: string): string => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '—';
  const local = digits.startsWith(COUNTRY_CODE) ? digits.slice(COUNTRY_CODE.length) : digits;
  if (local.length >= 9) {
    return `+${COUNTRY_CODE} ${local.slice(-9, -6)} ${local.slice(-6, -3)} ${local.slice(-3)}`;
  }
  if (local.length > 0) return `+${COUNTRY_CODE} ${local}`;
  return `+${COUNTRY_CODE}`;
};

const dialUri = (raw?: string): string => {
  const digits = (raw || '').replace(/\D/g, '');
  return `tel:+${digits}`;
};

const whatsappUri = (raw?: string): string => {
  const digits = (raw || '').replace(/\D/g, '');
  return `whatsapp://send?phone=${digits}`;
};

// ---------------------------------------------------------------------------
// Status pill for activity-request lifecycle, reused from the agent's
// activity list. Defensive normalization so we accept either the string
// or numeric form of the backend enum.
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

// ---------------------------------------------------------------------------
// Screen
//
// Hits 4 endpoints in parallel:
//   1. /parents/GetSingleParent — full parent record (name, phone, email,
//      civilId).
//   2. /collectingagent/GetCollectingAgentParents — used as a guard so an
//      agent can't open a parent that isn't in their portfolio (defensive
//      against deep links / stale router params).
//   3. /parents/GetParentChildrens — children to display under the header.
//   4. /collectingagent/GetMyActivities — full activity log; we filter
//      client-side to rows matching this parent. The endpoint doesn't
//      accept a parentId param yet, so 100 rows is the practical ceiling
//      for now (matches MyActivitiesScreen).
// ---------------------------------------------------------------------------

const AgentParentDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string }>();
  const parentId = parseInt(params.parentId || '0', 10);

  const user = useAppSelector((state) => state.auth.user);
  const collectingAgentId = parseInt(user?.entityUserId || '0', 10);

  const statusTheme = useRequestStatusTheme();

  // --- Authorization guard ----------------------------------------------
  // We re-fetch the agent's portfolio (cached by RTK Query so this is
  // typically free) and check that this parentId is in it. If not, we
  // refuse to show the data even though the backend would return it on
  // the parent endpoint.
  const { data: portfolioData } = useGetAgentParentsQuery(
    { collectingAgentId, pageNumber: 1, pageSize: 100 },
    { skip: !collectingAgentId },
  );
  const inPortfolio = useMemo(() => {
    const rows = portfolioData?.data ?? [];
    return rows.some((p) => p.parentId === parentId);
  }, [portfolioData, parentId]);

  // --- Parent record ----------------------------------------------------
  const {
    data: parentResp,
    isLoading: parentLoading,
  } = useGetSingleParentQuery({ parentId }, { skip: !parentId });
  const parent: Parent | undefined = parentResp?.data;

  // --- Children ---------------------------------------------------------
  const { data: childrenData, isLoading: childrenLoading } = useGetParentChildrenQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );
  const children = childrenData?.data ?? [];

  // --- Activities (filtered client-side by parent) ----------------------
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    isFetching,
  } = useGetMyActivitiesQuery({ pageNumber: 1, pageSize: 100 });
  const allActivities = useMemo<CollectingAgentActivity[]>(
    () => (Array.isArray(activitiesData?.data) ? activitiesData!.data : []),
    [activitiesData],
  );
  const parentActivities = useMemo(() => {
    return allActivities.filter((a) => {
      const id = a.fK_ParentId ?? a.parentId ?? a.parent?.parentId;
      return id === parentId;
    });
  }, [allActivities, parentId]);

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const contactAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const childrenAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });
  const activitiesAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });

  // --- Loading + error states -------------------------------------------
  if (parentLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  if (!parent) {
    return (
      <ScreenContainer>
        <View style={styles.headerRow}>
          <BackButton showLabel={false} />
          <ThemedText variant="h1" style={styles.headerTitle}>
            {t('agent.parentDetail.title', 'Détails du parent')}
          </ThemedText>
        </View>
        <EmptyState
          icon="person-outline"
          title={t('agent.parentDetail.notFoundTitle', 'Parent introuvable')}
          description={t(
            'agent.parentDetail.notFoundDesc',
            "Ce parent n'existe pas ou n'est plus disponible.",
          )}
        />
      </ScreenContainer>
    );
  }

  if (!inPortfolio && portfolioData) {
    // Portfolio data has loaded and this parent isn't in it.
    return (
      <ScreenContainer>
        <View style={styles.headerRow}>
          <BackButton showLabel={false} />
          <ThemedText variant="h1" style={styles.headerTitle}>
            {t('agent.parentDetail.title', 'Détails du parent')}
          </ThemedText>
        </View>
        <EmptyState
          icon="lock-closed-outline"
          title={t('agent.parentDetail.outOfScopeTitle', 'Hors de votre portefeuille')}
          description={t(
            'agent.parentDetail.outOfScopeDesc',
            "Ce parent ne vous a pas été assigné. Contactez votre directeur pour demander l'accès.",
          )}
        />
      </ScreenContainer>
    );
  }

  const phonePretty = formatPhone(parent.phoneNumber);
  const phoneRaw = parent.phoneNumber;

  return (
    <ScreenContainer>
      {/* Header */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <BackButton showLabel={false} />
        <ThemedText variant="h1" style={styles.headerTitle}>
          {t('agent.parentDetail.title', 'Détails du parent')}
        </ThemedText>
      </Animated.View>

      {/* Identity card */}
      <Animated.View style={contactAnim}>
        <ThemedCard variant="elevated" style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Avatar firstName={parent.firstName} lastName={parent.lastName} size="lg" />
            <View style={styles.identityText}>
              <ThemedText variant="h2" numberOfLines={1}>
                {parent.firstName} {parent.lastName}
              </ThemedText>
              {parent.fatherName ? (
                <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                  {t('agent.parentDetail.fatherName', 'Père')} : {parent.fatherName}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {/* Contact rows */}
          <View style={styles.contactRows}>
            {phoneRaw ? (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={16} color={theme.colors.textSecondary} />
                <ThemedText variant="body" style={styles.contactText} numberOfLines={1}>
                  {phonePretty}
                </ThemedText>
              </View>
            ) : null}
            {parent.email ? (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={16} color={theme.colors.textSecondary} />
                <ThemedText variant="body" style={styles.contactText} numberOfLines={1}>
                  {parent.email}
                </ThemedText>
              </View>
            ) : null}
            {parent.civilId ? (
              <View style={styles.contactRow}>
                <Ionicons name="id-card-outline" size={16} color={theme.colors.textSecondary} />
                <ThemedText variant="body" style={styles.contactText} numberOfLines={1}>
                  {parent.civilId}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Quick actions: call / WhatsApp / log activity */}
          <View style={styles.actionsRow}>
            {phoneRaw ? (
              <ThemedButton
                title={t('agent.parentDetail.call', 'Appeler')}
                variant="ghost"
                size="md"
                onPress={() => Linking.openURL(dialUri(phoneRaw))}
                style={styles.actionBtn}
                icon={<Ionicons name="call" size={14} color={theme.colors.primary} />}
              />
            ) : null}
            {phoneRaw ? (
              <ThemedButton
                title={t('agent.parentDetail.whatsapp', 'WhatsApp')}
                variant="ghost"
                size="md"
                onPress={() => Linking.openURL(whatsappUri(phoneRaw))}
                style={styles.actionBtn}
                icon={<Ionicons name="logo-whatsapp" size={14} color={theme.colors.primary} />}
              />
            ) : null}
          </View>

          <ThemedButton
            title={t('agent.parentDetail.logActivity', 'Enregistrer une activité')}
            variant="primary"
            size="md"
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/(app)/log-activity',
                params: { prefillParentId: String(parent.parentId) },
              })
            }
            style={styles.logActivityBtn}
            icon={<Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />}
          />
        </ThemedCard>
      </Animated.View>

      {/* Children */}
      <Animated.View style={childrenAnim}>
        <SectionHeader
          title={t('agent.parentDetail.childrenTitle', 'Enfants')}
          style={styles.sectionSpacing}
        />
        {childrenLoading ? (
          <ScreenSkeleton count={2} />
        ) : children.length === 0 ? (
          <ThemedCard variant="outlined">
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('agent.parentDetail.noChildren', 'Ce parent n’a aucun enfant inscrit.')}
            </ThemedText>
          </ThemedCard>
        ) : (
          children.map((child) => (
            <ThemedCard key={child.childId} variant="outlined" style={styles.childCard}>
              <View style={styles.childRow}>
                <View
                  style={[
                    styles.childIcon,
                    { backgroundColor: theme.colors.primary + '18' },
                  ]}
                >
                  <Ionicons name="person" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.childBody}>
                  <ThemedText variant="body" style={styles.childName} numberOfLines={1}>
                    {child.firstName} {child.lastName}
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    numberOfLines={1}
                  >
                    {[child.schoolName, child.schoolGradeName].filter(Boolean).join(' • ')}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          ))
        )}
      </Animated.View>

      {/* Activities related to this parent */}
      <Animated.View style={activitiesAnim}>
        <SectionHeader
          title={t('agent.parentDetail.activitiesTitle', 'Activités avec ce parent')}
          style={styles.sectionSpacing}
        />
        {activitiesLoading && parentActivities.length === 0 ? (
          <ScreenSkeleton count={3} />
        ) : parentActivities.length === 0 ? (
          <EmptyState
            icon="reader-outline"
            title={t('agent.parentDetail.noActivitiesTitle', 'Aucune activité')}
            description={t(
              'agent.parentDetail.noActivitiesDesc',
              "Vous n'avez encore enregistré aucune activité avec ce parent.",
            )}
          />
        ) : (
          parentActivities.map((activity) => {
            const key = normalizeActivityType(activity.activityType);
            const status = normalizeRequestStatus(activity.requestStatus);
            const badge = status ? statusTheme[status] : null;
            return (
              <Pressable
                key={activity.activityId}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/agent-activity-detail',
                    params: { activityId: String(activity.activityId) },
                  })
                }
              >
                <ThemedCard variant="outlined" style={styles.activityCard}>
                  <View style={styles.activityRow}>
                    <View
                      style={[
                        styles.activityIcon,
                        { backgroundColor: theme.colors.primary + '15' },
                      ]}
                    >
                      <Ionicons
                        name={ACTIVITY_ICON[key]}
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.activityBody}>
                      <View style={styles.activityHeaderRow}>
                        <ThemedText variant="bodySmall" style={styles.activityTitle}>
                          {t(
                            `agent.activities.types.${key}`,
                            activity.activityTypeDisplayName || key,
                          )}
                        </ThemedText>
                        {badge ? (
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: badge.bg,
                                borderRadius: theme.borderRadius.sm,
                              },
                            ]}
                          >
                            <ThemedText
                              variant="caption"
                              color={badge.fg}
                              style={styles.badgeLabel}
                              numberOfLines={1}
                            >
                              {badge.label}
                            </ThemedText>
                          </View>
                        ) : null}
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.colors.textTertiary}
                        />
                      </View>
                      <ThemedText variant="body" numberOfLines={2} style={styles.activityDesc}>
                        {activity.activityDescription}
                      </ThemedText>
                      <ThemedText
                        variant="caption"
                        color={theme.colors.textTertiary}
                        numberOfLines={1}
                      >
                        {formatDateTimeCongo(
                          activity.activityDate ||
                            activity.createdOn ||
                            new Date().toISOString(),
                        )}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedCard>
              </Pressable>
            );
          })
        )}
      </Animated.View>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  headerTitle: {
    flex: 1,
  },
  identityCard: {
    marginBottom: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  contactRows: {
    marginTop: 14,
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
  },
  logActivityBtn: {
    marginTop: 8,
  },
  sectionSpacing: {
    marginTop: 18,
  },
  childCard: {
    marginBottom: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  childBody: {
    flex: 1,
    minWidth: 0,
  },
  childName: {
    fontWeight: '600',
  },
  activityCard: {
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityBody: {
    flex: 1,
    minWidth: 0,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  activityTitle: {
    fontWeight: '600',
    flex: 1,
  },
  activityDesc: {
    marginVertical: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeLabel: {
    fontWeight: '700',
    fontSize: 10,
  },
});

export default AgentParentDetailScreen;
