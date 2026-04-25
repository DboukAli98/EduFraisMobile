import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import ThemedText from '../common/ThemedText';
import ThemedCard from '../common/ThemedCard';
import ThemedButton from '../common/ThemedButton';
import PointsBadge from './PointsBadge';
import type { MyLoyaltyRewardDto } from '../../types';
import { formatCurrency } from '../../utils';

/**
 * Catalog card for a single redeemable reward.
 *
 * The wire DTO is enriched server-side (`isRedeemable`, `unavailableReason`)
 * so this component never re-implements the rules — it just renders what
 * the backend says. The Redeem CTA is disabled when `isRedeemable=false`,
 * and we surface the localized reason underneath.
 *
 * - `pointsLabel` is the program-level label (e.g. "Points" / "Étoiles")
 *   so the cost chip stays consistent with the dashboard hero.
 * - `onRedeem` is fired only when the reward is currently redeemable;
 *   the caller is responsible for showing a confirmation sheet.
 *
 * `unavailableReason` strings come from the backend in English ("Insufficient
 * points", "Out of stock", etc.). We translate them via i18n keys in
 * `loyalty.unavailable.*` — anything we don't recognize is shown verbatim
 * so directors can see exactly what tripped the gate.
 */
export interface RewardCardProps {
  reward: MyLoyaltyRewardDto;
  pointsLabel?: string;
  onRedeem?: (reward: MyLoyaltyRewardDto) => void;
}

const REASON_KEY: Record<string, string> = {
  'Reward not yet available': 'loyalty.unavailable.notYetAvailable',
  'Reward expired': 'loyalty.unavailable.expired',
  'Out of stock': 'loyalty.unavailable.outOfStock',
  'Per-member limit reached': 'loyalty.unavailable.memberLimit',
  'Insufficient points': 'loyalty.unavailable.insufficientPoints',
};

const RewardCard: React.FC<RewardCardProps> = ({ reward, pointsLabel = 'Points', onRedeem }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const stockText = (() => {
    if (reward.stockQuantity == null) {
      return t('loyalty.reward.unlimitedStock', 'Stock illimité');
    }
    if (reward.stockQuantity <= 0) {
      return t('loyalty.unavailable.outOfStock', 'Rupture de stock');
    }
    return t('loyalty.reward.stockRemaining', '{{count}} en stock', { count: reward.stockQuantity });
  })();

  const reasonLabel = (() => {
    if (reward.isRedeemable || !reward.unavailableReason) return null;
    const key = REASON_KEY[reward.unavailableReason];
    if (key) return t(key, reward.unavailableReason);
    // Backend may return a `MinimumRedeemPoints` reason with the actual
    // number embedded — show it raw so the parent sees the threshold.
    return reward.unavailableReason;
  })();

  // Pick an icon that hints at the reward category. The backend type
  // is a free-form union so default to a gift box.
  const icon: React.ComponentProps<typeof Ionicons>['name'] = (() => {
    switch (reward.rewardType) {
      case 'Merchandise':
        return 'shirt-outline';
      case 'SchoolFeeCredit':
        return 'cash-outline';
      case 'CustomBenefit':
      default:
        return 'gift-outline';
    }
  })();

  return (
    <ThemedCard variant="elevated" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
          <Ionicons name={icon} size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.headerText}>
          <ThemedText variant="subtitle" numberOfLines={2}>
            {reward.rewardName}
          </ThemedText>
          {reward.schoolMerchandiseName ? (
            <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {reward.schoolMerchandiseName}
            </ThemedText>
          ) : null}
        </View>
        <PointsBadge points={reward.pointsCost} pointsLabel={pointsLabel} size="sm" tone="filled" />
      </View>

      {reward.rewardDescription ? (
        <ThemedText variant="bodySmall" color={theme.colors.textSecondary} style={styles.desc}>
          {reward.rewardDescription}
        </ThemedText>
      ) : null}

      <View style={styles.metaRow}>
        <ThemedText variant="caption" color={theme.colors.textTertiary}>
          {stockText}
        </ThemedText>
        {reward.monetaryValue && reward.monetaryValue > 0 ? (
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            {t('loyalty.reward.value', 'Valeur')}: {formatCurrency(reward.monetaryValue)}
          </ThemedText>
        ) : null}
      </View>

      {reasonLabel ? (
        <View style={styles.reasonRow}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warning} />
          <ThemedText variant="caption" color={theme.colors.warning} style={styles.reasonText}>
            {reasonLabel}
          </ThemedText>
        </View>
      ) : null}

      {onRedeem ? (
        <ThemedButton
          title={t('loyalty.reward.redeem', 'Échanger')}
          onPress={() => onRedeem(reward)}
          variant="primary"
          size="md"
          disabled={!reward.isRedeemable}
          style={styles.cta}
        />
      ) : null}
    </ThemedCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  desc: {
    marginTop: 8,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasonRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    flexShrink: 1,
  },
  cta: {
    marginTop: 12,
  },
});

export default RewardCard;
