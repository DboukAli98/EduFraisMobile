import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
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
  ScreenSkeleton,
  EmptyState,
  PointsBadge,
  RewardCard,
  LedgerRow,
  useAlert,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay } from '../../hooks';
import {
  useGetMyLoyaltyQuery,
  useGetMyLoyaltyLedgerQuery,
  useGetMyLoyaltyRulesQuery,
  useGetMyLoyaltyRewardsQuery,
  useRequestLoyaltyRedemptionMutation,
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';
import type { MyLoyaltyRewardDto, LoyaltyRulePeriodType } from '../../types';

/**
 * Agent loyalty screen — single combined view since agents care less
 * about deep navigation than parents do. Layout:
 *
 *   1. Hero card: balance + this-week-earned
 *   2. Rules block: "you earn X points per Y" — read-only
 *   3. Rewards: tappable cards (same component as parent)
 *   4. Recent ledger preview (most recent 5)
 *
 * Commission earnings (real money) live on the existing CommissionsScreen.
 * This screen never mentions money — points are non-cashable perks. The
 * rule cards make this distinction obvious by always rendering "+N
 * pointsLabel" rather than a currency value.
 */

const RULE_PERIOD_LABEL: Record<LoyaltyRulePeriodType, string> = {
  None: '',
  Daily: 'Daily',
  Weekly: 'Weekly',
  Monthly: 'Monthly',
  ProgramLifetime: 'Lifetime',
};

const startOfThisWeekUtc = (): Date => {
  // Monday-anchored to match the backend `Weekly` PeriodType.
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
};

const AgentLoyaltyScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlert();

  const {
    data: loyaltyResp,
    isLoading: meLoading,
    isFetching,
    refetch: refetchMe,
  } = useGetMyLoyaltyQuery();
  const memberships = loyaltyResp?.data ?? [];
  const summary = memberships[0]; // an agent belongs to exactly one school

  const memberId = summary?.member.loyaltyMemberId ?? 0;
  const programId = summary?.program.loyaltyProgramId ?? 0;
  const pointsLabel = summary?.program.pointsLabel || 'Points';

  const { data: rulesResp } = useGetMyLoyaltyRulesQuery({ loyaltyProgramId: programId }, { skip: !programId });
  const rules = rulesResp?.data ?? [];

  const { data: rewardsResp, refetch: refetchRewards } = useGetMyLoyaltyRewardsQuery(
    { loyaltyProgramId: programId, loyaltyMemberId: memberId },
    { skip: !programId },
  );
  const rewards = rewardsResp?.data ?? [];

  const { data: ledgerResp, refetch: refetchLedger } = useGetMyLoyaltyLedgerQuery(
    { loyaltyMemberId: memberId, pageNumber: 1, pageSize: 5 },
    { skip: !memberId },
  );
  const recentLedger = ledgerResp?.data ?? [];

  // This-week-earned: a quick KPI computed locally from the ledger
  // preview. We pull the first page (5 rows), filter Earn rows newer
  // than Monday-this-week, and sum. Good enough as a hint — the real
  // accounting lives in the full ledger view.
  const thisWeekEarned = useMemo(() => {
    const start = startOfThisWeekUtc();
    return recentLedger
      .filter((e) => e.entryType === 'Earn' && e.createdOn && new Date(e.createdOn) >= start)
      .reduce((sum, e) => sum + e.pointsDelta, 0);
  }, [recentLedger]);

  const [redeem, { isLoading: redeeming }] = useRequestLoyaltyRedemptionMutation();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleRedeem = useCallback(
    (reward: MyLoyaltyRewardDto) => {
      if (!summary) return;
      showAlert({
        title: t('loyalty.reward.confirmTitle', 'Confirm redemption'),
        message: t('loyalty.reward.confirmMessage', 'Redeem {{points}} points for "{{name}}"?', {
          points: reward.pointsCost,
          name: reward.rewardName,
        }),
        type: 'info',
        buttons: [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('loyalty.reward.confirmCta', 'Redeem'),
            style: 'default',
            onPress: async () => {
              setPendingId(reward.loyaltyRewardId);
              try {
                const res = await redeem({
                  loyaltyMemberId: summary.member.loyaltyMemberId,
                  loyaltyRewardId: reward.loyaltyRewardId,
                  quantity: 1,
                }).unwrap();
                const isApproved = res?.data?.status === 'Approved';
                showAlert({
                  title: t('loyalty.reward.successTitle', 'Redemption requested'),
                  message: isApproved
                    ? t(
                      'loyalty.reward.successApproved',
                      'Reward approved. The director will hand it over to you.',
                    )
                    : t(
                      'loyalty.reward.successPending',
                      "Request sent to the director. You'll be notified once it's reviewed.",
                    ),
                  type: 'success',
                });
              } catch (err: any) {
                showAlert({
                  title: t('loyalty.reward.errorTitle', "Couldn't redeem"),
                  message: err?.data?.error || err?.data?.message || t('common.error', 'Something went wrong'),
                  type: 'error',
                });
              } finally {
                setPendingId(null);
              }
            },
          },
        ],
      });
    },
    [summary, redeem, showAlert, t],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchMe(), refetchRewards(), refetchLedger()]);
  }, [refetchMe, refetchRewards, refetchLedger]);

  const heroAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const rulesAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });

  if (meLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  if (!summary) {
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

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !meLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero */}
        <Animated.View style={heroAnim}>
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderRadius: theme.borderRadius.xl }]}
          >
            <View style={styles.heroTopRow}>
              <View>
                <ThemedText variant="caption" color="rgba(255,255,255,0.85)">
                  {t('loyalty.title', 'Loyalty program')}
                </ThemedText>
                <ThemedText variant="subtitle" color="#FFFFFF">
                  {summary.program.programName}
                </ThemedText>
              </View>
              <Ionicons name="star" size={28} color="#FFFFFF" />
            </View>

            <ThemedText variant="display" color="#FFFFFF" style={styles.heroNumber}>
              {summary.member.currentPointsBalance.toLocaleString()}
            </ThemedText>
            <ThemedText variant="subtitle" color="rgba(255,255,255,0.95)">
              {pointsLabel}
            </ThemedText>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText variant="caption" color="rgba(255,255,255,0.7)">
                  {t('agent.loyalty.thisWeek', 'This week')}
                </ThemedText>
                <ThemedText variant="subtitle" color="#FFFFFF">
                  +{thisWeekEarned.toLocaleString()}
                </ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText variant="caption" color="rgba(255,255,255,0.7)">
                  {t('loyalty.lifetimeEarned', 'Lifetime earned')}
                </ThemedText>
                <ThemedText variant="subtitle" color="#FFFFFF">
                  {summary.member.lifetimePointsEarned.toLocaleString()}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Earn rules — read-only summary so the agent knows what fires
            their balance up. */}
        <Animated.View style={rulesAnim}>
          <SectionHeader title={t('loyalty.rules', 'How to earn')} />
          {rules.length === 0 ? (
            <ThemedCard variant="outlined">
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t(
                  'agent.loyalty.noRules',
                  "No earning rules right now. Once your director sets one, it will appear here.",
                )}
              </ThemedText>
            </ThemedCard>
          ) : (
            rules.map((rule) => (
              <ThemedCard key={rule.loyaltyRuleId} variant="default" style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <View style={styles.ruleHeaderText}>
                    <ThemedText variant="subtitle" numberOfLines={1}>
                      {rule.ruleName}
                    </ThemedText>
                    {rule.ruleDescription ? (
                      <ThemedText
                        variant="caption"
                        color={theme.colors.textSecondary}
                        numberOfLines={2}
                      >
                        {rule.ruleDescription}
                      </ThemedText>
                    ) : null}
                  </View>
                  <PointsBadge
                    points={rule.pointsAwarded}
                    pointsLabel={`+${pointsLabel}`}
                    size="sm"
                    tone="filled"
                  />
                </View>

                <View style={styles.ruleConditions}>
                  {rule.minimumAmount && rule.minimumAmount > 0 ? (
                    <View style={[styles.conditionPill, { backgroundColor: theme.colors.borderLight }]}>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {t('loyalty.rule.minimumAmount', 'Min. {{amount}}', {
                          amount: formatCurrency(rule.minimumAmount),
                        })}
                      </ThemedText>
                    </View>
                  ) : null}
                  {rule.requiresOnTimePayment ? (
                    <View style={[styles.conditionPill, { backgroundColor: theme.colors.borderLight }]}>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {t('loyalty.rule.onlyOnTime', 'On-time payment')}
                      </ThemedText>
                    </View>
                  ) : null}
                  {rule.requiresFullPayment ? (
                    <View style={[styles.conditionPill, { backgroundColor: theme.colors.borderLight }]}>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {t('loyalty.rule.onlyFullPayment', 'Full payment')}
                      </ThemedText>
                    </View>
                  ) : null}
                  {rule.maxAwardsPerMember && rule.maxAwardsPerMember > 0 ? (
                    <View style={[styles.conditionPill, { backgroundColor: theme.colors.borderLight }]}>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {rule.maxAwardsPerMember}× / {RULE_PERIOD_LABEL[rule.periodType] || '∞'}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </ThemedCard>
            ))
          )}
        </Animated.View>

        {/* Rewards (uses parent's RewardCard) */}
        <SectionHeader title={t('loyalty.rewards', 'Rewards')} />
        {rewards.length === 0 ? (
          <ThemedCard variant="outlined">
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('loyalty.unavailable.outOfStock', 'No rewards are available right now.')}
            </ThemedText>
          </ThemedCard>
        ) : (
          rewards.map((reward) => (
            <RewardCard
              key={reward.loyaltyRewardId}
              reward={reward}
              pointsLabel={pointsLabel}
              onRedeem={
                redeeming && pendingId === reward.loyaltyRewardId ? undefined : handleRedeem
              }
            />
          ))
        )}

        {/* Recent ledger preview */}
        <SectionHeader
          title={t('loyalty.ledger', 'Points history')}
          action={recentLedger.length > 0 ? t('common.seeAll', 'See all') : undefined}
          onAction={() =>
            router.push({
              pathname: '/(app)/loyalty-ledger',
              params: { memberId: String(memberId) },
            })
          }
        />
        {recentLedger.length === 0 ? (
          <ThemedCard variant="outlined">
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('loyalty.notEnrolled', 'Make your first payment to join the loyalty program.')}
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
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    padding: 24,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroNumber: {
    fontWeight: '700',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  heroStat: {
    flex: 1,
  },
  ruleCard: {
    marginBottom: 10,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  ruleHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  ruleConditions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  conditionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  divider: {
    height: 1,
    marginHorizontal: -16,
  },
});

export default AgentLoyaltyScreen;
