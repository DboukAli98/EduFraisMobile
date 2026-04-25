import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ScreenSkeleton,
  EmptyState,
  LedgerRow,
  PointsBadge,
} from '../../components';
import { useTheme } from '../../theme';
import {
  useGetMyLoyaltyQuery,
  useGetMyLoyaltyLedgerQuery,
} from '../../services/api/apiSlice';
import type { LoyaltyLedgerEntryDto } from '../../types';

/**
 * Paginated points history. The backend lists newest-first; we render
 * with section dividers grouped by day so the parent can quickly scan
 * "what did I earn this week".
 *
 * Pagination is page-based. Each page is loaded via a separate hook
 * call and then concatenated into local state — this avoids RTK
 * Query's default merge-by-args behavior (which would force one cache
 * entry per page) and keeps the list in memory until refresh.
 */
const PAGE_SIZE = 20;

const dayKey = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const ParentLoyaltyLedgerScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
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
  const [accumulated, setAccumulated] = useState<LoyaltyLedgerEntryDto[]>([]);

  const {
    data: ledgerResp,
    isLoading: ledgerLoading,
    isFetching,
    refetch,
  } = useGetMyLoyaltyLedgerQuery(
    { loyaltyMemberId: memberId, pageNumber, pageSize: PAGE_SIZE },
    { skip: !memberId },
  );

  // Stitch new pages onto the accumulator. Reset when the refresh fires
  // (pageNumber === 1 + new data).
  React.useEffect(() => {
    if (!ledgerResp?.data) return;
    if (pageNumber === 1) {
      setAccumulated(ledgerResp.data);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((e) => e.loyaltyPointLedgerId));
        const fresh = ledgerResp.data!.filter((e) => !seen.has(e.loyaltyPointLedgerId));
        return [...prev, ...fresh];
      });
    }
  }, [ledgerResp, pageNumber]);

  const totalCount = ledgerResp?.totalCount ?? 0;
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

  // Group rows by day for visual breaks.
  const groups = useMemo(() => {
    const map = new Map<string, LoyaltyLedgerEntryDto[]>();
    for (const entry of accumulated) {
      const key = dayKey(entry.createdOn);
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
  }, [accumulated]);

  if (meLoading || (ledgerLoading && accumulated.length === 0)) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={6} />
      </ScreenContainer>
    );
  }

  if (!memberId || !summary) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="receipt-outline"
          title={t('loyalty.ledger', 'Points history')}
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
        <View style={styles.headerLeft}>
          <ThemedText variant="h2">{t('loyalty.ledger', 'Points history')}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {summary.schoolName}
          </ThemedText>
        </View>
        <PointsBadge
          points={summary.member.currentPointsBalance}
          pointsLabel={pointsLabel}
          size="md"
          tone="subtle"
        />
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.day}
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.groupHeader}>
              {group.day}
            </ThemedText>
            <ThemedCard variant="default" style={styles.groupCard}>
              {group.items.map((entry, i) => (
                <View key={entry.loyaltyPointLedgerId}>
                  <LedgerRow entry={entry} pointsLabel={pointsLabel} />
                  {i < group.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.colors.borderLight }]} />
                  )}
                </View>
              ))}
            </ThemedCard>
          </View>
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
            <ActivityIndicator
              color={theme.colors.primary}
              style={styles.footerSpinner}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t('loyalty.ledger', 'Points history')}
            description={t(
              'loyalty.notEnrolled',
              'Make your first payment to join the loyalty program.',
            )}
          />
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  group: {
    marginBottom: 16,
  },
  groupHeader: {
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCard: {
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: -16,
  },
  listContent: {
    paddingBottom: 24,
  },
  footerSpinner: {
    marginVertical: 16,
  },
});

export default ParentLoyaltyLedgerScreen;
