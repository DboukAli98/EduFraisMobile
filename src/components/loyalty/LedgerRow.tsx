import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import ThemedText from '../common/ThemedText';
import type { LoyaltyLedgerEntryDto, LoyaltyLedgerEntryType } from '../../types';

/**
 * Single row in a paginated loyalty ledger.
 *
 * Color-coded by EntryType:
 * - Earn / ManualCredit / Reverse(positive) → success / green
 * - Redeem / ManualDebit                    → error / red
 *
 * The sign on `pointsDelta` is the source of truth for the +/- prefix —
 * Reverse rows can be either direction (a member-cancelled redemption
 * restores points = positive; a corrective adjustment can be negative).
 *
 * `pointsLabel` is forwarded so admin re-branding (e.g. "Étoiles") shows
 * up consistently with the dashboard hero and reward catalog.
 */
export interface LedgerRowProps {
  entry: LoyaltyLedgerEntryDto;
  pointsLabel?: string;
}

const ENTRY_ICON: Record<LoyaltyLedgerEntryType, React.ComponentProps<typeof Ionicons>['name']> = {
  Earn: 'add-circle-outline',
  ManualCredit: 'add-circle-outline',
  Redeem: 'gift-outline',
  ManualDebit: 'remove-circle-outline',
  Reverse: 'arrow-undo-outline',
};

const ENTRY_KEY: Record<LoyaltyLedgerEntryType, string> = {
  Earn: 'loyalty.entry.earn',
  ManualCredit: 'loyalty.entry.manualCredit',
  Redeem: 'loyalty.entry.redeem',
  ManualDebit: 'loyalty.entry.manualDebit',
  Reverse: 'loyalty.entry.reverse',
};

const ENTRY_FALLBACK: Record<LoyaltyLedgerEntryType, string> = {
  Earn: 'Gain',
  ManualCredit: 'Crédit manuel',
  Redeem: 'Échange',
  ManualDebit: 'Débit manuel',
  Reverse: 'Annulation',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const LedgerRow: React.FC<LedgerRowProps> = ({ entry, pointsLabel = 'Points' }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const isPositive = entry.pointsDelta > 0;
  const tone = isPositive ? theme.colors.success : theme.colors.error;
  const sign = isPositive ? '+' : '';
  const formattedDelta = `${sign}${entry.pointsDelta.toLocaleString()}`;

  const icon = ENTRY_ICON[entry.entryType] ?? 'ellipse-outline';
  const typeLabel = t(ENTRY_KEY[entry.entryType] ?? '', ENTRY_FALLBACK[entry.entryType] ?? entry.entryType);

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: tone + '18' }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>

      <View style={styles.body}>
        <ThemedText variant="body" numberOfLines={1}>
          {entry.description?.trim() || typeLabel}
        </ThemedText>
        <ThemedText variant="caption" color={theme.colors.textTertiary}>
          {formatDate(entry.createdOn)} · {typeLabel}
        </ThemedText>
      </View>

      <View style={styles.amount}>
        <ThemedText variant="subtitle" color={tone}>
          {formattedDelta}
        </ThemedText>
        <ThemedText variant="caption" color={theme.colors.textTertiary}>
          {pointsLabel}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    alignItems: 'flex-end',
  },
});

export default LedgerRow;
