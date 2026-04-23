import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import ThemedCard from './ThemedCard';
import ThemedText from './ThemedText';
import { useTheme } from '../../theme';
import { useGetActiveCommissionRatesQuery } from '../../services/api/apiSlice';
import { CURRENCY_SYMBOL } from '../../constants';

type Audience = 'director' | 'parent' | 'agent';

interface CommissionBreakdownCardProps {
  /** Gross amount the director sets / the parent pays. */
  grossAmount: number;
  /** Preferred payment provider code (e.g. "AirtelMoney"). Falls back to the
   *  first active provider if no match is found. */
  providerCode?: string;
  /** Controls which side of the breakdown is emphasised.
   *  - director: "Your school receives ... (platform X%, Airtel Y%)"
   *  - parent:   "Total including fees: ... (of which platform X%, Airtel Y%)"
   *  - agent:    identical layout to parent, different copy.
   */
  audience?: Audience;
  /** Optional sub-label to clarify what the `grossAmount` covers. */
  title?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) =>
  `${round2(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOL}`;

/**
 * Shows the director / parent exactly how the platform + provider fees get
 * sliced out of a gross payment. Loads the active rates via
 * `useGetActiveCommissionRatesQuery` so every screen sees the same numbers
 * the backend snapshots onto the transaction.
 *
 * Silently renders nothing while the rates are loading or if the gross is
 * <= 0 — callers can drop this in next to any amount input without an extra
 * guard.
 */
const CommissionBreakdownCard: React.FC<CommissionBreakdownCardProps> = ({
  grossAmount,
  providerCode,
  audience = 'parent',
  title,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading } = useGetActiveCommissionRatesQuery();

  const platformPct = Number((data as any)?.platformFeePercentage ?? 0);
  const providers = ((data as any)?.providers ?? []) as {
    paymentProviderId: number;
    name: string;
    code: string;
    feePercentage: number;
  }[];

  const provider = useMemo(() => {
    if (!providers.length) return undefined;
    if (providerCode) {
      const lookup = providerCode.toLowerCase();
      const exact = providers.find((p) => p.code?.toLowerCase() === lookup);
      if (exact) return exact;
      const partial = providers.find(
        (p) =>
          p.code?.toLowerCase().includes(lookup) ||
          p.name?.toLowerCase().includes(lookup),
      );
      if (partial) return partial;
    }
    return providers[0];
  }, [providers, providerCode]);

  const breakdown = useMemo(() => {
    const gross = Number.isFinite(grossAmount) ? Math.max(0, grossAmount) : 0;
    const platformAmount = round2((gross * platformPct) / 100);
    const providerPct = Number(provider?.feePercentage ?? 0);
    const providerAmount = round2((gross * providerPct) / 100);
    const net = Math.max(0, round2(gross - platformAmount - providerAmount));
    return { gross, platformPct, platformAmount, providerPct, providerAmount, net };
  }, [grossAmount, platformPct, provider]);

  if (isLoading) return null;
  if (breakdown.gross <= 0) return null;

  const audienceCopy = (() => {
    switch (audience) {
      case 'director':
        return {
          headline: t(
            'commission.director.headline',
            'Votre école recevra',
          ),
          subtitle: t(
            'commission.director.subtitle',
            "Les frais plateforme et prestataire sont déduits du montant que le parent paie.",
          ),
          netLabel: t('commission.director.netLabel', 'Net pour l\'école'),
        };
      case 'agent':
        return {
          headline: t('commission.agent.headline', 'Montant encaissé'),
          subtitle: t(
            'commission.agent.subtitle',
            'Répartition des frais appliqués à cette transaction.',
          ),
          netLabel: t('commission.agent.netLabel', 'Reversé à l\'école'),
        };
      default:
        return {
          headline: t('commission.parent.headline', 'Total à payer'),
          subtitle: t(
            'commission.parent.subtitle',
            "Frais plateforme et prestataire inclus — rien de plus à payer.",
          ),
          netLabel: t('commission.parent.netLabel', 'Reçu par l\'école'),
        };
    }
  })();

  const rowIcon = (name: keyof typeof Ionicons.glyphMap, color: string) => (
    <View
      style={[
        styles.rowIcon,
        { backgroundColor: color + '1A', borderColor: color + '33' },
      ]}
    >
      <Ionicons name={name} size={14} color={color} />
    </View>
  );

  return (
    <ThemedCard variant="outlined" style={styles.card}>
      {title ? (
        <ThemedText
          variant="caption"
          color={theme.colors.textTertiary}
          style={styles.title}
        >
          {title}
        </ThemedText>
      ) : null}

      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {audienceCopy.headline}
          </ThemedText>
          <ThemedText variant="title" style={styles.grossAmount}>
            {fmt(breakdown.gross)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.netPill,
            {
              backgroundColor: theme.colors.primary + '14',
              borderColor: theme.colors.primary + '33',
            },
          ]}
        >
          <ThemedText variant="caption" color={theme.colors.primary}>
            {audienceCopy.netLabel}
          </ThemedText>
          <ThemedText
            variant="subtitle"
            color={theme.colors.primary}
            style={styles.netAmount}
          >
            {fmt(breakdown.net)}
          </ThemedText>
        </View>
      </View>

      <ThemedText
        variant="caption"
        color={theme.colors.textTertiary}
        style={styles.subtitle}
      >
        {audienceCopy.subtitle}
      </ThemedText>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.feeRow}>
        <View style={styles.feeLeft}>
          {rowIcon('business-outline', theme.colors.secondary ?? theme.colors.primary)}
          <View style={{ flex: 1 }}>
            <ThemedText variant="bodySmall">
              {t('commission.platformFee', 'Frais plateforme EduFrais')}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
            >
              {breakdown.platformPct.toFixed(2)}%
            </ThemedText>
          </View>
        </View>
        <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
          −{fmt(breakdown.platformAmount)}
        </ThemedText>
      </View>

      <View style={styles.feeRow}>
        <View style={styles.feeLeft}>
          {rowIcon('card-outline', theme.colors.primary)}
          <View style={{ flex: 1 }}>
            <ThemedText variant="bodySmall">
              {provider?.name
                ?? t('commission.providerFallback', 'Frais prestataire')}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
            >
              {breakdown.providerPct.toFixed(2)}%
            </ThemedText>
          </View>
        </View>
        <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
          −{fmt(breakdown.providerAmount)}
        </ThemedText>
      </View>
    </ThemedCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 6,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  grossAmount: {
    marginTop: 2,
  },
  netPill: {
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '55%',
  },
  netAmount: {
    marginTop: 2,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  feeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CommissionBreakdownCard;
