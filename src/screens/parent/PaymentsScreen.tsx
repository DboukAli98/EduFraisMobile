import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  PaymentStatusBadge,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useResponsive, useAppSelector } from '../../hooks';
import { useGetParentInstallmentsQuery } from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';
import type { ParentInstallmentDto } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentStatus = 'Paid' | 'Pending' | 'Overdue';
type FilterKey = 'All' | PaymentStatus;

interface MappedInstallment {
  id: string;
  installmentId: number;
  amount: number;
  dueDate: string;
  school: string;
  childName: string;
  gradeName: string;
  paymentCycleName: string;
  lateFee: number;
  isPaid: boolean;
  paidDate?: string;
  status: PaymentStatus;
}

const FILTERS: FilterKey[] = ['All', 'Pending', 'Paid', 'Overdue'];

const getInstallmentStatus = (inst: ParentInstallmentDto): PaymentStatus => {
  if (inst.isPaid) return 'Paid';
  if (new Date(inst.dueDate) < new Date()) return 'Overdue';
  return 'Pending';
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
    <Pressable
      onPress={onPress}
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
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// PaymentsScreen
// ---------------------------------------------------------------------------

const PaymentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const {
    data: installmentsData,
    isLoading,
  } = useGetParentInstallmentsQuery({ parentId }, { skip: !parentId });

  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const filtersAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(1) });

  // Map API data to display format with computed status
  const allInstallments: MappedInstallment[] = useMemo(() => {
    return (installmentsData?.data || []).map((i) => ({
      id: String(i.installmentId),
      installmentId: i.installmentId,
      amount: i.amount,
      dueDate: i.dueDate,
      school: i.schoolName,
      childName: i.childName,
      gradeName: i.gradeName,
      paymentCycleName: i.paymentCycleName,
      lateFee: i.lateFee,
      isPaid: i.isPaid,
      paidDate: i.paidDate,
      status: getInstallmentStatus(i),
    }));
  }, [installmentsData]);

  // Apply filter and search
  const filtered = useMemo(() => {
    let result = allInstallments;

    // Apply status filter
    if (activeFilter !== 'All') {
      result = result.filter((i) => i.status === activeFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.childName.toLowerCase().includes(query) ||
          i.school.toLowerCase().includes(query) ||
          i.paymentCycleName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [activeFilter, allInstallments, searchQuery]);

  // Summary stats computed from all installments (not just filtered)
  const summaryStats = useMemo(() => {
    const totalDue = allInstallments
      .filter((i) => !i.isPaid)
      .reduce((sum, i) => sum + i.amount + i.lateFee, 0);

    const totalPaid = allInstallments
      .filter((i) => i.isPaid)
      .reduce((sum, i) => sum + i.amount, 0);

    const overdueCount = allInstallments.filter((i) => i.status === 'Overdue').length;

    return { totalDue, totalPaid, overdueCount };
  }, [allInstallments]);

  // Handler: card press navigates to payment detail
  const handleCardPress = (item: MappedInstallment) => {
    router.push({ pathname: '/payment-detail', params: { installmentId: item.id } });
  };

  // Handler: FAB navigates to first unpaid installment or shows alert
  const handleMakePayment = () => {
    const firstUnpaid = allInstallments.find((i) => !i.isPaid);
    if (firstUnpaid) {
      router.push({ pathname: '/payment-detail', params: { installmentId: firstUnpaid.id } });
    } else {
      Alert.alert(
        t('parent.payments.allPaidTitle', 'All Paid'),
        t('parent.payments.allPaidMessage', 'All installments have been paid. No pending payments.')
      );
    }
  };

  // Handler: navigate to payment history
  const handleViewHistory = () => {
    router.push('/payment-history');
  };

  const renderItem = ({ item, index }: { item: MappedInstallment; index: number }) => {
    const isPaid = item.status === 'Paid';
    const isOverdue = item.status === 'Overdue';

    return (
      <ThemedCard
        variant={isOverdue ? 'outlined' : 'elevated'}
        onPress={() => handleCardPress(item)}
        style={{
          ...styles.installmentCard,
          ...(isOverdue ? { borderColor: theme.colors.error + '40', borderWidth: 1 } : {}),
          ...(isPaid ? { opacity: 0.75 } : {}),
        }}
      >
        <View style={styles.installmentHeader}>
          <View style={styles.installmentFlex}>
            <ThemedText variant="subtitle">
              {item.paymentCycleName || t('parent.payments.installment', 'Installment')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {item.childName} - {item.school}
            </ThemedText>
          </View>
          <PaymentStatusBadge status={item.status} size="sm" />
        </View>
        <View style={styles.installmentFooter}>
          <ThemedText variant="numeric" color={isOverdue ? theme.colors.error : theme.colors.primary}>
            {formatCurrency(item.amount)}
          </ThemedText>
          <View style={styles.dateRow}>
            <Ionicons
              name={isPaid ? 'checkmark-circle' : 'calendar-outline'}
              size={14}
              color={isPaid ? theme.colors.success : theme.colors.textTertiary}
            />
            <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.dateTxt}>
              {formatDate(isPaid && item.paidDate ? item.paidDate : item.dueDate)}
            </ThemedText>
          </View>
        </View>
      </ThemedCard>
    );
  };

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={64} color={theme.colors.borderLight} />
      <ThemedText
        variant="subtitle"
        color={theme.colors.textSecondary}
        style={styles.emptyTitle}
      >
        {searchQuery.trim()
          ? t('parent.payments.noSearchResults', 'No matching installments')
          : t('parent.payments.noInstallments', 'No installments found')}
      </ThemedText>
      <ThemedText
        variant="caption"
        color={theme.colors.textTertiary}
        style={styles.emptySubtitle}
      >
        {searchQuery.trim()
          ? t('parent.payments.tryDifferentSearch', 'Try adjusting your search or filter criteria.')
          : t('parent.payments.noInstallmentsHint', 'Your installments will appear here once available.')}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <Animated.View style={[styles.titleRow, headerAnim]}>
          <ThemedText variant="h1" style={styles.titlePad}>
            {t('parent.payments.title', 'Payments')}
          </ThemedText>
        </Animated.View>
        <View style={styles.list}>
          <ScreenSkeleton count={4} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      {/* Header with history link */}
      <Animated.View style={[styles.titleRow, headerAnim]}>
        <View style={styles.headerRow}>
          <ThemedText variant="h1" style={styles.titlePad}>
            {t('parent.payments.title', 'Payments')}
          </ThemedText>
          <Pressable onPress={handleViewHistory} style={styles.historyLink}>
            <ThemedText variant="caption" color={theme.colors.primary} style={styles.historyLinkText}>
              {t('parent.payments.viewHistory', 'View Payment History')} {'\u2192'}
            </ThemedText>
          </Pressable>
        </View>
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
            placeholder={t(
              'parent.payments.searchPlaceholder',
              'Search by child, school, or cycle...'
            )}
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Summary stats row */}
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md },
          ]}
        >
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('parent.payments.totalDue', 'Due')}
          </ThemedText>
          <ThemedText variant="numeric" color={theme.colors.primary} style={styles.statValue}>
            {formatCurrency(summaryStats.totalDue)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md },
          ]}
        >
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('parent.payments.totalPaid', 'Paid')}
          </ThemedText>
          <ThemedText variant="numeric" color={theme.colors.success} style={styles.statValue}>
            {formatCurrency(summaryStats.totalPaid)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md },
          ]}
        >
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('parent.payments.overdue', 'Overdue')}
          </ThemedText>
          <ThemedText
            variant="numeric"
            color={summaryStats.overdueCount > 0 ? theme.colors.error : theme.colors.textSecondary}
            style={styles.statValue}
          >
            {summaryStats.overdueCount}
          </ThemedText>
        </View>
      </View>

      {/* Filter chips */}
      <Animated.View style={[styles.filterRow, filtersAnim]}>
        {FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={t(`parent.payments.filter.${f.toLowerCase()}`, f)}
            active={activeFilter === f}
            onPress={() => setActiveFilter(f)}
          />
        ))}
      </Animated.View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Floating pay button */}
      <View style={styles.fabContainer}>
        <ThemedButton
          title={t('parent.payments.makePayment', 'Make Payment')}
          onPress={handleMakePayment}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="card-outline" size={20} color="#FFFFFF" />}
        />
      </View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  titlePad: { marginBottom: 4 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  historyLinkText: {
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

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipTxt: { fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyList: { flexGrow: 1 },

  installmentCard: { marginBottom: 12 },
  installmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  installmentFlex: { flex: 1, marginRight: 8 },
  installmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateTxt: { marginLeft: 4 },

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

  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
});

export default PaymentsScreen;
