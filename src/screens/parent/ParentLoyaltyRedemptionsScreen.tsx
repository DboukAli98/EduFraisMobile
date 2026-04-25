import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ScreenSkeleton,
  EmptyState,
  PointsBadge,
  useAlert,
} from '../../components';
import { useTheme } from '../../theme';
import {
  useGetMyLoyaltyQuery,
  useGetMyLoyaltyRedemptionsQuery,
  useCancelMyLoyaltyRedemptionMutation,
} from '../../services/api/apiSlice';
import type { LoyaltyRedemptionDto, LoyaltyRedemptionStatus } from '../../types';

const PAGE_SIZE = 20;

/**
 * Redemption history + status. Pending rows have a Cancel CTA — tapping
 * it opens a confirmation, fires `cancelMyLoyaltyRedemption`, and the
 * `Loyalty + LoyaltyLedger + LoyaltyRewards` cache tags get invalidated
 * so the dashboard balance reflects the points refund instantly.
 *
 * Rejected rows surface the director's `reviewNotes` so the parent
 * understands why; without that, "Rejected" feels arbitrary.
 *
 * Fulfilled rows show the `fulfilledOn` date — useful when the parent
 * is checking whether the school already handed over the merchandise.
 */
const STATUS_CONFIG: Record<
  LoyaltyRedemptionStatus,
  { iconName: React.ComponentProps<typeof Ionicons>['name']; toneToken: 'success' | 'warning' | 'error' | 'info' | 'disabled' }
> = {
  Pending: { iconName: 'time-outline', toneToken: 'warning' },
  Approved: { iconName: 'checkmark-circle-outline', toneToken: 'info' },
  Rejected: { iconName: 'close-circle-outline', toneToken: 'error' },
  Fulfilled: { iconName: 'checkmark-done-circle-outline', toneToken: 'success' },
  Cancelled: { iconName: 'remove-circle-outline', toneToken: 'disabled' },
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface RedemptionRowProps {
  item: LoyaltyRedemptionDto;
  pointsLabel: string;
  onCancel?: () => void;
  cancelling: boolean;
}

const RedemptionRow: React.FC<RedemptionRowProps> = ({ item, pointsLabel, onCancel, cancelling }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.Pending;
  const tone =
    cfg.toneToken === 'success'
      ? theme.colors.success
      : cfg.toneToken === 'warning'
        ? theme.colors.warning
        : cfg.toneToken === 'error'
          ? theme.colors.error
          : cfg.toneToken === 'info'
            ? theme.colors.info
            : theme.colors.disabled;

  const statusLabel = t(`loyalty.redemption.status.${item.status}`, item.status);

  return (
    <ThemedCard variant="default" style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderLeft}>
          <View style={[styles.iconCircle, { backgroundColor: tone + '20' }]}>
            <Ionicons name={cfg.iconName} size={20} color={tone} />
          </View>
          <View style={styles.rowHeaderText}>
            <ThemedText variant="subtitle" numberOfLines={2}>
              {item.rewardName}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {formatDate(item.createdOn)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.rowHeaderRight}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: tone + '15', borderColor: tone, borderRadius: theme.borderRadius.full },
            ]}
          >
            <ThemedText variant="caption" color={tone} style={styles.statusText}>
              {statusLabel}
            </ThemedText>
          </View>
          <PointsBadge points={item.pointsSpent} pointsLabel={pointsLabel} size="sm" tone="subtle" />
        </View>
      </View>

      {item.status === 'Rejected' && item.reviewNotes ? (
        <View style={[styles.notesBlock, { backgroundColor: theme.colors.error + '08' }]}>
          <ThemedText variant="caption" color={theme.colors.error} style={styles.notesLabel}>
            {t('loyalty.redemption.rejectedReason', 'Rejection reason')}
          </ThemedText>
          <ThemedText variant="bodySmall">{item.reviewNotes}</ThemedText>
        </View>
      ) : null}

      {item.status === 'Fulfilled' && item.fulfilledOn ? (
        <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.metaText}>
          {t('loyalty.redemption.status.Fulfilled', 'Fulfilled')} · {formatDate(item.fulfilledOn)}
        </ThemedText>
      ) : null}

      {item.status === 'Pending' && onCancel ? (
        <ThemedButton
          title={t('loyalty.redemption.cancel', 'Cancel request')}
          onPress={onCancel}
          variant="ghost"
          size="md"
          loading={cancelling}
          style={styles.cancelBtn}
        />
      ) : null}
    </ThemedCard>
  );
};

const ParentLoyaltyRedemptionsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ memberId?: string }>();

  const { data: loyaltyResp, isLoading: meLoading } = useGetMyLoyaltyQuery();
  const memberships = loyaltyResp?.data ?? [];

  const memberId = useMemo(() => {
    const fromParam = params.memberId ? Number(params.memberId) : 0;
    if (fromParam > 0) return fromParam;
    return memberships[0]?.member.loyaltyMemberId ?? 0;
  }, [memberships, params.memberId]);

  const summary = useMemo(
    () => memberships.find((m) => m.member.loyaltyMemberId === memberId),
    [memberships, memberId],
  );
  const pointsLabel = summary?.program.pointsLabel || 'Points';

  const [pageNumber, setPageNumber] = useState(1);
  const [accumulated, setAccumulated] = useState<LoyaltyRedemptionDto[]>([]);

  const {
    data: redemptionsResp,
    isLoading: redemptionsLoading,
    isFetching,
    refetch,
  } = useGetMyLoyaltyRedemptionsQuery(
    { loyaltyMemberId: memberId, pageNumber, pageSize: PAGE_SIZE },
    { skip: !memberId },
  );

  const [cancelMutation, { isLoading: cancelling }] = useCancelMyLoyaltyRedemptionMutation();
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);

  React.useEffect(() => {
    if (!redemptionsResp?.data) return;
    if (pageNumber === 1) {
      setAccumulated(redemptionsResp.data);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((r) => r.loyaltyRedemptionId));
        const fresh = redemptionsResp.data!.filter((r) => !seen.has(r.loyaltyRedemptionId));
        return [...prev, ...fresh];
      });
    }
  }, [redemptionsResp, pageNumber]);

  const totalCount = redemptionsResp?.totalCount ?? 0;
  const hasMore = accumulated.length < totalCount;

  const onEndReached = useCallback(() => {
    if (!isFetching && hasMore) {
      setPageNumber((p) => p + 1);
    }
  }, [isFetching, hasMore]);

  const onRefresh = useCallback(async () => {
    setPageNumber(1);
    await refetch();
  }, [refetch]);

  const requestCancel = useCallback(
    (redemption: LoyaltyRedemptionDto) => {
      showAlert({
        title: t('loyalty.redemption.cancelConfirmTitle', 'Cancel this redemption?'),
        message: t(
          'loyalty.redemption.cancelConfirmMessage',
          'Your points will be restored.',
        ),
        type: 'warning',
        buttons: [
          { text: t('common.notNow', 'Not now'), style: 'cancel' },
          {
            text: t('loyalty.redemption.cancelCta', 'Confirm cancellation'),
            style: 'destructive',
            onPress: async () => {
              setPendingCancelId(redemption.loyaltyRedemptionId);
              try {
                await cancelMutation({
                  loyaltyRedemptionId: redemption.loyaltyRedemptionId,
                }).unwrap();
                // Re-load page 1 so the cancelled row reflects the
                // server-side status flip immediately, and points
                // restoration shows up on the dashboard.
                setPageNumber(1);
                await refetch();
              } catch (err: any) {
                showAlert({
                  title: t('common.error', 'Something went wrong'),
                  message:
                    err?.data?.error || err?.data?.message || t('common.error', 'Something went wrong'),
                  type: 'error',
                });
              } finally {
                setPendingCancelId(null);
              }
            },
          },
        ],
      });
    },
    [cancelMutation, refetch, showAlert, t],
  );

  if (meLoading || (redemptionsLoading && accumulated.length === 0)) {
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
          icon="checkmark-done-outline"
          title={t('loyalty.redemptions', 'My redemptions')}
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
        <ThemedText variant="h2">{t('loyalty.redemptions', 'My redemptions')}</ThemedText>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {summary.schoolName}
        </ThemedText>
      </View>

      <FlatList
        data={accumulated}
        keyExtractor={(item) => String(item.loyaltyRedemptionId)}
        renderItem={({ item }) => (
          <RedemptionRow
            item={item}
            pointsLabel={pointsLabel}
            onCancel={() => requestCancel(item)}
            cancelling={cancelling && pendingCancelId === item.loyaltyRedemptionId}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && pageNumber === 1}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListFooterComponent={
          hasMore && isFetching ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title={t('loyalty.redemptions', 'My redemptions')}
            description={t(
              'loyalty.unavailable.outOfStock',
              'No redemptions yet — visit the rewards screen to spend your points.',
            )}
          />
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  rowHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: {
    fontWeight: '600',
  },
  notesBlock: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  notesLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  metaText: {
    marginTop: 6,
  },
  cancelBtn: {
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  footerSpinner: {
    marginVertical: 16,
  },
});

export default ParentLoyaltyRedemptionsScreen;
