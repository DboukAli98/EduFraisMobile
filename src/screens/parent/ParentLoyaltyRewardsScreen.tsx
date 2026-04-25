import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ScreenSkeleton,
  EmptyState,
  RewardCard,
  PointsBadge,
  useAlert,
} from '../../components';
import { useTheme } from '../../theme';
import {
  useGetMyLoyaltyQuery,
  useGetMyLoyaltyRewardsQuery,
  useRequestLoyaltyRedemptionMutation,
} from '../../services/api/apiSlice';
import type { MyLoyaltyRewardDto } from '../../types';
import { formatCurrency } from '../../utils';

/**
 * Catalog screen — paged-but-flat-list of rewards available to the
 * calling parent for one specific membership/program.
 *
 * Route params:
 *   - memberId   : LoyaltyMemberId (for MaxRedeemPerMember + balance gate)
 *   - programId  : LoyaltyProgramId (selects which program's catalog)
 *
 * Both params are stringified ints. Either / both can be missing — when
 * they are we fall back to the parent's primary membership from /me.
 */
const ParentLoyaltyRewardsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ memberId?: string; programId?: string }>();

  // Resolve the (memberId, programId, pointsLabel) tuple. We may receive
  // it via route params (deep link from the dashboard) or fall back to
  // /me's first row. Either way the rest of the screen reads from local
  // state so a refresh re-uses the latest data.
  const { data: loyaltyResp, isLoading: meLoading, refetch: refetchMe } = useGetMyLoyaltyQuery();
  const memberships = loyaltyResp?.data ?? [];

  const paramMemberId = params.memberId ? Number(params.memberId) : 0;
  const paramProgramId = params.programId ? Number(params.programId) : 0;

  const summary = useMemo(() => {
    if (paramMemberId > 0) {
      const match = memberships.find((m) => m.member.loyaltyMemberId === paramMemberId);
      if (match) return match;
    }
    if (paramProgramId > 0) {
      const match = memberships.find((m) => m.program.loyaltyProgramId === paramProgramId);
      if (match) return match;
    }
    return memberships[0];
  }, [memberships, paramMemberId, paramProgramId]);

  const memberId = summary?.member.loyaltyMemberId ?? 0;
  const programId = summary?.program.loyaltyProgramId ?? 0;
  const pointsLabel = summary?.program.pointsLabel || 'Points';
  const balance = summary?.member.currentPointsBalance ?? 0;

  const {
    data: rewardsResp,
    isLoading: rewardsLoading,
    isFetching,
    refetch: refetchRewards,
  } = useGetMyLoyaltyRewardsQuery(
    { loyaltyProgramId: programId, loyaltyMemberId: memberId },
    { skip: !programId },
  );
  const rewards: MyLoyaltyRewardDto[] = rewardsResp?.data ?? [];

  const [redeem, { isLoading: redeeming }] = useRequestLoyaltyRedemptionMutation();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const onRedeem = useCallback(
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
    await Promise.all([refetchMe(), refetchRewards()]);
  }, [refetchMe, refetchRewards]);

  if (meLoading || (rewardsLoading && rewards.length === 0)) {
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
      <View style={styles.header}>
        <ThemedText variant="h2">{t('loyalty.rewards', 'Rewards')}</ThemedText>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {summary.schoolName}
        </ThemedText>
      </View>

      {/* Sticky balance pill so the parent always sees what they can afford */}
      <View style={styles.balanceRow}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {t('loyalty.balance', 'Balance')}
        </ThemedText>
        <PointsBadge points={balance} pointsLabel={pointsLabel} size="md" tone="filled" />
      </View>

      <FlatList
        data={rewards}
        keyExtractor={(item) => String(item.loyaltyRewardId)}
        renderItem={({ item }) => (
          <RewardCard
            reward={item}
            pointsLabel={pointsLabel}
            onRedeem={
              redeeming && pendingId === item.loyaltyRewardId ? undefined : onRedeem
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && rewards.length > 0}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="gift-outline"
            title={t('loyalty.rewards', 'Rewards')}
            description={t(
              'loyalty.unavailable.outOfStock',
              'No rewards are available right now.',
            )}
          />
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
});

export default ParentLoyaltyRewardsScreen;
