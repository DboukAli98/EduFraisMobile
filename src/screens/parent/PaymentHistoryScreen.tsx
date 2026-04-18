import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetSchoolFeesPaymentHistoryQuery,
  useGetMerchandisePaymentHistoryQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';
import type {
  SchoolFeesPaymentHistoryDto,
  MerchandisePaymentHistoryDto,
} from '../../types';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type ActiveTab = 'fees' | 'merchandise';

type DateFilterKey = 'AllTime' | 'ThisMonth' | 'Last3Months' | 'ThisYear';

interface DateFilterOption {
  key: DateFilterKey;
  label: string;
}

interface StatusFilterOption {
  label: string;
  statusId: number | undefined;
}

const DATE_FILTERS: DateFilterOption[] = [
  { key: 'AllTime', label: 'All Time' },
  { key: 'ThisMonth', label: 'This Month' },
  { key: 'Last3Months', label: 'Last 3 Months' },
  { key: 'ThisYear', label: 'This Year' },
];

const STATUS_FILTERS: StatusFilterOption[] = [
  { label: 'Processed', statusId: 8 },
  { label: 'All', statusId: undefined },
  { label: 'Pending', statusId: 6 },
  { label: 'Failed', statusId: 10 },
];

// ---------------------------------------------------------------------------
// StatusBadge (inline)
// ---------------------------------------------------------------------------

const getStatusColor = (statusName: string): { bg: string; text: string } => {
  const lower = statusName.toLowerCase();
  if (lower.includes('process') || lower.includes('success') || lower.includes('complete')) {
    return { bg: '#DCFCE7', text: '#166534' };
  }
  if (lower.includes('pending') || lower.includes('wait')) {
    return { bg: '#FEF9C3', text: '#854D0E' };
  }
  if (lower.includes('fail') || lower.includes('reject') || lower.includes('cancel')) {
    return { bg: '#FEE2E2', text: '#991B1B' };
  }
  return { bg: '#F3F4F6', text: '#374151' };
};

interface StatusBadgeProps {
  statusName: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ statusName }) => {
  const colors = getStatusColor(statusName);
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
      <ThemedText
        variant="caption"
        style={[styles.statusBadgeText, { color: colors.text }]}
      >
        {statusName}
      </ThemedText>
    </View>
  );
};

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.borderLight,
          borderRadius: theme.borderRadius.full,
        },
      ]}
    >
      <ThemedText
        variant="caption"
        color={active ? '#FFFFFF' : theme.colors.textSecondary}
        style={styles.chipTxt}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// PaymentHistoryScreen
// ---------------------------------------------------------------------------

const PaymentHistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const userId = user?.id || '';

  // -- State
  const [activeTab, setActiveTab] = useState<ActiveTab>('fees');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('AllTime');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>(STATUS_FILTERS[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // -- Animations
  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const tabsAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(1) });
  const filtersAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(2) });

  // -- API queries
  const feesQueryParams = useMemo(
    () => ({
      userId,
      dateFilter,
      ...(statusFilter.statusId !== undefined ? { statusId: statusFilter.statusId } : {}),
    }),
    [userId, dateFilter, statusFilter],
  );

  const merchandiseQueryParams = useMemo(
    () => ({
      userId,
      dateFilter,
      ...(statusFilter.statusId !== undefined ? { statusId: statusFilter.statusId } : {}),
    }),
    [userId, dateFilter, statusFilter],
  );

  const {
    data: feesData,
    isLoading: feesLoading,
    isFetching: feesFetching,
  } = useGetSchoolFeesPaymentHistoryQuery(feesQueryParams, {
    skip: !userId || activeTab !== 'fees',
  });

  const {
    data: merchandiseData,
    isLoading: merchandiseLoading,
    isFetching: merchandiseFetching,
  } = useGetMerchandisePaymentHistoryQuery(merchandiseQueryParams, {
    skip: !userId || activeTab !== 'merchandise',
  });

  const isLoading =
    activeTab === 'fees' ? feesLoading : merchandiseLoading;
  const isFetching =
    activeTab === 'fees' ? feesFetching : merchandiseFetching;

  // -- Filtered data
  const filteredFees = useMemo(() => {
    const items = feesData?.data || [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) =>
        (i.childName?.toLowerCase().includes(q)) ||
        (i.schoolName?.toLowerCase().includes(q)) ||
        (i.transactionReference?.toLowerCase().includes(q)),
    );
  }, [feesData, searchQuery]);

  const filteredMerchandise = useMemo(() => {
    const items = merchandiseData?.data || [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) =>
        (i.merchandiseName?.toLowerCase().includes(q)) ||
        (i.schoolName?.toLowerCase().includes(q)) ||
        (i.transactionReference?.toLowerCase().includes(q)),
    );
  }, [merchandiseData, searchQuery]);

  // -- Handlers
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCardPress = useCallback(
    (transactionId: number) => {
      router.push({
        pathname: '/payment-invoice',
        params: {
          transactionId: String(transactionId),
          type: activeTab === 'fees' ? 'schoolfee' : 'merchandise',
        },
      });
    },
    [router, activeTab],
  );

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchQuery('');
  }, []);

  // -- Render helpers: Fee card
  const renderFeeItem = useCallback(
    ({ item }: { item: SchoolFeesPaymentHistoryDto }) => (
      <ThemedCard
        variant="elevated"
        onPress={() => handleCardPress(item.paymentTransactionId)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <ThemedText variant="numeric" color={theme.colors.primary}>
              {formatCurrency(item.amountPaid)}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
              style={styles.cardDate}
            >
              {formatDate(item.paidDate)}
            </ThemedText>
          </View>
          <StatusBadge statusName={item.statusName} />
        </View>

        <View style={styles.cardBody}>
          {item.childName ? (
            <View style={styles.cardRow}>
              <Ionicons
                name="person-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.cardRowText}
              >
                {item.childName}
                {item.gradeName ? ` - ${item.gradeName}` : ''}
              </ThemedText>
            </View>
          ) : null}
          {item.schoolName ? (
            <View style={styles.cardRow}>
              <Ionicons
                name="school-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.cardRowText}
              >
                {item.schoolName}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.cardRow}>
            <Ionicons
              name="card-outline"
              size={14}
              color={theme.colors.textTertiary}
            />
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
              style={styles.cardRowText}
            >
              {item.paymentMethod}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            Ref: {item.transactionReference}
          </ThemedText>
        </View>
      </ThemedCard>
    ),
    [theme, handleCardPress],
  );

  // -- Render helpers: Merchandise card
  const renderMerchandiseItem = useCallback(
    ({ item }: { item: MerchandisePaymentHistoryDto }) => (
      <ThemedCard
        variant="elevated"
        onPress={() => handleCardPress(item.paymentTransactionId)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <ThemedText variant="numeric" color={theme.colors.primary}>
              {formatCurrency(item.amountPaid)}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
              style={styles.cardDate}
            >
              {formatDate(item.paidDate)}
            </ThemedText>
          </View>
          <StatusBadge statusName={item.statusName} />
        </View>

        <View style={styles.cardBody}>
          {item.merchandiseName ? (
            <View style={styles.cardRow}>
              <Ionicons
                name="pricetag-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.cardRowText}
              >
                {item.merchandiseName}
              </ThemedText>
            </View>
          ) : null}
          {item.schoolName ? (
            <View style={styles.cardRow}>
              <Ionicons
                name="school-outline"
                size={14}
                color={theme.colors.textSecondary}
              />
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.cardRowText}
              >
                {item.schoolName}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.cardRow}>
            <Ionicons
              name="card-outline"
              size={14}
              color={theme.colors.textTertiary}
            />
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
              style={styles.cardRowText}
            >
              {item.paymentMethod}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            Ref: {item.transactionReference}
          </ThemedText>
        </View>
      </ThemedCard>
    ),
    [theme, handleCardPress],
  );

  // -- Empty state
  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={64} color={theme.colors.borderLight} />
        <ThemedText
          variant="subtitle"
          color={theme.colors.textSecondary}
          style={styles.emptyTitle}
        >
          {t('payments.noPaymentsFound', 'No payments found')}
        </ThemedText>
        <ThemedText
          variant="caption"
          color={theme.colors.textTertiary}
          style={styles.emptySubtitle}
        >
          {searchQuery.trim()
            ? t('payments.noMatchingPaymentsDesc', 'Try adjusting your search or filter criteria.')
            : t('payments.noPaymentsDesc', 'Your payment history will appear here once transactions are available.')}
        </ThemedText>
      </View>
    ),
    [theme, searchQuery],
  );

  // -- Loading state
  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <Animated.View style={[styles.headerRow, headerAnim]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <ThemedText variant="h1">{t('payments.history', 'Payment History')}</ThemedText>
        </Animated.View>
        <View style={styles.skeletonContainer}>
          <ScreenSkeleton count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      {/* Header with back button */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <ThemedText variant="h1">{t('payments.history', 'Payment History')}</ThemedText>
      </Animated.View>

      {/* Tab selector */}
      <Animated.View style={[styles.tabContainer, tabsAnim]}>
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.full,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => handleTabChange('fees')}
            activeOpacity={0.7}
            style={[
              styles.tabButton,
              {
                backgroundColor:
                  activeTab === 'fees' ? theme.colors.primary : 'transparent',
                borderRadius: theme.borderRadius.full,
              },
            ]}
          >
            <ThemedText
              variant="button"
              color={activeTab === 'fees' ? '#FFFFFF' : theme.colors.textSecondary}
            >
              {t('payments.schoolFees', 'School Fees')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('merchandise')}
            activeOpacity={0.7}
            style={[
              styles.tabButton,
              {
                backgroundColor:
                  activeTab === 'merchandise' ? theme.colors.primary : 'transparent',
                borderRadius: theme.borderRadius.full,
              },
            ]}
          >
            <ThemedText
              variant="button"
              color={activeTab === 'merchandise' ? '#FFFFFF' : theme.colors.textSecondary}
            >
              {t('payments.merchandiseFees', 'Merchandise')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Date filter chips */}
      <Animated.View style={filtersAnim}>
        <FlatList
          data={DATE_FILTERS}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <FilterChip
              label={t(`payments.${item.key === 'AllTime' ? 'allTime' : item.key === 'ThisMonth' ? 'thisMonth' : item.key === 'Last3Months' ? 'last3Months' : 'thisYear'}`, item.label)}
              active={dateFilter === item.key}
              onPress={() => setDateFilter(item.key)}
            />
          )}
        />

        {/* Status filter chips */}
        <FlatList
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.label}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <FilterChip
              label={t(`payments.${item.label === 'All' ? 'allStatuses' : item.label.toLowerCase()}`, item.label)}
              active={statusFilter.label === item.label}
              onPress={() => setStatusFilter(item)}
            />
          )}
        />
      </Animated.View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.borderRadius.full,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder={t('payments.searchPayments', 'Search payments...')}
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Payment list */}
      {activeTab === 'fees' ? (
        <FlatList
          data={filteredFees}
          keyExtractor={(item) => String(item.paymentTransactionId)}
          renderItem={renderFeeItem}
          contentContainerStyle={[
            styles.list,
            filteredFees.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={isFetching ? null : renderEmptyState}
        />
      ) : (
        <FlatList
          data={filteredMerchandise}
          keyExtractor={(item) => String(item.paymentTransactionId)}
          renderItem={renderMerchandiseItem}
          contentContainerStyle={[
            styles.list,
            filteredMerchandise.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={isFetching ? null : renderEmptyState}
        />
      )}
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipTxt: {
    fontWeight: '600',
  },

  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    paddingHorizontal: 14,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  skeletonContainer: {
    flex: 1,
  },

  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardDate: {
    marginTop: 2,
  },
  cardBody: {
    marginBottom: 10,
    gap: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardRowText: {
    marginLeft: 6,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontWeight: '600',
    fontSize: 11,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PaymentHistoryScreen;
