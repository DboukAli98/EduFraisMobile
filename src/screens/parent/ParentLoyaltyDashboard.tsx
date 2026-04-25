import React, { useMemo } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  SectionHeader,
  EmptyState,
  ScreenSkeleton,
  PointsBadge,
  LedgerRow,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay } from '../../hooks';
import {
  useGetMyLoyaltyQuery,
  useGetMyLoyaltyLedgerQuery,
} from '../../services/api/apiSlice';
import type { MyLoyaltySummaryDto } from '../../types';

// Hero card showing the calling parent's primary loyalty membership.
//
// Why a "primary" membership: a parent may be enrolled in multiple
// schools' programs (children at different schools). For now we surface
// the FIRST membership that the backend returns — `/me` orders by
// LastActivityOn DESC then CreatedOn DESC, so this is implicitly the
// most-relevant one. When the parent has more than one we show a small
// switcher row underneath.

const ParentLoyaltyDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: loyaltyResp,
    isLoading,
    isFetching,
    refetch,
  } = useGetMyLoyaltyQuery();

  const memberships: MyLoyaltySummaryDto[] = loyaltyResp?.data ?? [];
  const primary = memberships[0];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const balanceAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const recentAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });

  // Mini-ledger preview (5 most-recent rows) — only fires once we know
  // the primary member id, which avoids a 400 on first render.
  const memberId = primary?.member.loyaltyMemberId ?? 0;
  const { data: ledgerResp, isLoading: ledgerLoading } = useGetMyLoyaltyLedgerQuery(
    { loyaltyMemberId: memberId, pageNumber: 1, pageSize: 5 },
    { skip: !memberId },
  );
  const recentLedger = ledgerResp?.data ?? [];

  const progressRatio = useMemo(() => {
    if (!primary) return 0;
    const min = primary.program.minimumRedeemPoints;
    if (!min || min <= 0) return 1;
    return Math.min(1, Math.max(0, primary.member.currentPointsBalance / min));
  }, [primary]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={4} />
      </ScreenContainer>
    );
  }

  if (!primary) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="gift-outline"
          title={t('loyalty.title', 'Loyalty program')}
          description={t(
            'loyalty.notEnrolled',
            'Make your first payment to join the loyalty program.',
          )}
        />
      </ScreenContainer>
    );
  }

  const pointsLabel = primary.program.pointsLabel || 'Points';
  const programName = primary.program.programName;
  const schoolName = primary.schoolName;

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerAnim]}>
          <ThemedText variant="h2">{t('loyalty.title', 'Loyalty program')}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {schoolName} · {programName}
          </ThemedText>
        </Animated.View>

        {/* Hero balance card */}
        <Animated.View style={balanceAnim}>
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { borderRadius: theme.borderRadius.xl }]}
          >
            <ThemedText variant="caption" color="rgba(255,255,255,0.85)">
              {t('loyalty.balance', 'Balance')}
            </ThemedText>
            <View style={styles.heroBalanceRow}>
              <Ionicons name="star" size={28} color="#FFFFFF" />
              <ThemedText variant="display" color="#FFFFFF" style={styles.heroBalance}>
                {primary.member.currentPointsBalance.toLocaleString()}
              </ThemedText>
              <ThemedText variant="subtitle" color="rgba(255,255,255,0.95)">
                {pointsLabel}
              </ThemedText>
            </View>

            {primary.program.minimumRedeemPoints > 0 && (
              <>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressRatio * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressLabels}>
                  <ThemedText variant="caption" color="rgba(255,255,255,0.85)">
                    {t('loyalty.minRedeem', 'Minimum redeem')}: {primary.program.minimumRedeemPoints}
                  </ThemedText>
                  {progressRatio >= 1 ? (
                    <ThemedText variant="caption" color="#FFFFFF">
                      {t('loyalty.reward.redeem', 'Redeem')} →
                    </ThemedText>
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <ThemedText variant="caption" color="rgba(255,255,255,0.7)">
                  {t('loyalty.lifetimeEarned', 'Lifetime earned')}
                </ThemedText>
                <ThemedText variant="subtitle" color="#FFFFFF">
                  {primary.member.lifetimePointsEarned.toLocaleString()}
                </ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText variant="caption" color="rgba(255,255,255,0.7)">
                  {t('loyalty.lifetimeRedeemed', 'Lifetime redeemed')}
                </ThemedText>
                <ThemedText variant="subtitle" color="#FFFFFF">
                  {primary.member.lifetimePointsRedeemed.toLocaleString()}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Multiple-membership switcher: show when parent has >1 school */}
        {memberships.length > 1 && (
          <View style={styles.membersRow}>
            {memberships.map((m, idx) => (
              <Pressable
                key={m.member.loyaltyMemberId}
                onPress={() => {
                  // Future: parent dashboard could maintain a selected
                  // memberId in local state. For now, the first card is
                  // primary; tapping another opens its rewards screen
                  // directly so the parent can act on it without losing
                  // the welcome screen context.
                  router.push({
                    pathname: '/(app)/loyalty-rewards',
                    params: {
                      memberId: String(m.member.loyaltyMemberId),
                      programId: String(m.program.loyaltyProgramId),
                    },
                  });
                }}
                style={[
                  styles.memberChip,
                  {
                    backgroundColor: idx === 0 ? theme.colors.primary + '15' : theme.colors.surface,
                    borderColor: idx === 0 ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <ThemedText variant="caption" color={theme.colors.text} numberOfLines={1}>
                  {m.schoolName}
                </ThemedText>
                <PointsBadge
                  points={m.member.currentPointsBalance}
                  pointsLabel={m.program.pointsLabel}
                  size="sm"
                  tone="subtle"
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/loyalty-rewards',
                params: {
                  memberId: String(primary.member.loyaltyMemberId),
                  programId: String(primary.program.loyaltyProgramId),
                },
              })
            }
            style={[styles.action, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="gift-outline" size={22} color={theme.colors.primary} />
            </View>
            <ThemedText variant="bodySmall" align="center">
              {t('loyalty.rewards', 'Rewards')}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/loyalty-ledger',
                params: { memberId: String(primary.member.loyaltyMemberId) },
              })
            }
            style={[styles.action, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.info + '15' }]}>
              <Ionicons name="receipt-outline" size={22} color={theme.colors.info} />
            </View>
            <ThemedText variant="bodySmall" align="center">
              {t('loyalty.ledger', 'Points history')}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/loyalty-redemptions',
                params: { memberId: String(primary.member.loyaltyMemberId) },
              })
            }
            style={[styles.action, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.success + '15' }]}>
              <Ionicons name="checkmark-done-outline" size={22} color={theme.colors.success} />
            </View>
            <ThemedText variant="bodySmall" align="center">
              {t('loyalty.redemptions', 'My redemptions')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Recent activity */}
        <Animated.View style={recentAnim}>
          <SectionHeader
            title={t('loyalty.ledger', 'Points history')}
            action={recentLedger.length > 0 ? t('common.seeAll', 'See all') : undefined}
            onAction={() =>
              router.push({
                pathname: '/(app)/loyalty-ledger',
                params: { memberId: String(primary.member.loyaltyMemberId) },
              })
            }
          />

          {ledgerLoading ? (
            <ScreenSkeleton count={3} />
          ) : recentLedger.length === 0 ? (
            <ThemedCard variant="outlined">
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t(
                  'loyalty.notEnrolled',
                  'Make your first payment to join the loyalty program.',
                )}
              </ThemedText>
            </ThemedCard>
          ) : (
            <ThemedCard variant="default">
              {recentLedger.map((entry, i) => (
                <View key={entry.loyaltyPointLedgerId}>
                  <LedgerRow entry={entry} pointsLabel={pointsLabel} />
                  {i < recentLedger.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.colors.borderLight }]} />
                  )}
                </View>
              ))}
            </ThemedCard>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  heroCard: {
    padding: 24,
    marginBottom: 20,
  },
  heroBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
  },
  heroBalance: {
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStat: {
    flex: 1,
  },
  membersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: -16,
  },
});

export default ParentLoyaltyDashboard;
