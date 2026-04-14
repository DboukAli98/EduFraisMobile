import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, FlatList, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
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

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return allInstallments;
    return allInstallments.filter((i) => i.status === activeFilter);
  }, [activeFilter, allInstallments]);

  const renderItem = ({ item, index }: { item: MappedInstallment; index: number }) => {
    const isPaid = item.status === 'Paid';
    const isOverdue = item.status === 'Overdue';

    return (
      <ThemedCard
        variant={isOverdue ? 'outlined' : 'elevated'}
        onPress={() => {}}
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
      {/* Header */}
      <Animated.View style={[styles.titleRow, headerAnim]}>
        <ThemedText variant="h1" style={styles.titlePad}>
          {t('parent.payments.title', 'Payments')}
        </ThemedText>
      </Animated.View>

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
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating pay button */}
      <View style={styles.fabContainer}>
        <ThemedButton
          title={t('parent.payments.makePayment', 'Make Payment')}
          onPress={() => {}}
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

  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
});

export default PaymentsScreen;
