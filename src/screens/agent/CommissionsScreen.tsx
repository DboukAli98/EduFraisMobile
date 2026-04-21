import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  PaymentStatusBadge,
  SectionHeader,
  LoadingSkeleton,
  useAlert,
} from '../../components';
import {
  useGetMyCommissionsQuery,
  useRequestCommissionApprovalMutation,
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';

// --- Types ---
type CommissionFilter = 'all' | 'pending' | 'approved';

const FILTERS: { key: CommissionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
];

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 80),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function CommissionsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const agentId = parseInt(user?.entityUserId || '0');
  const [activeFilter, setActiveFilter] = useState<CommissionFilter>('all');
  const { showAlert } = useAlert();

  const { data: commissionsData, isLoading } = useGetMyCommissionsQuery({ pageNumber: 1, pageSize: 100 });
  const [requestCommissionApproval, { isLoading: isSubmitting }] = useRequestCommissionApprovalMutation();

  const commissions = commissionsData?.data ?? [];

  // Calculate totals from real data
  const totals = useMemo(() => {
    const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const pendingAmount = commissions.filter((c) => !c.isApproved).reduce((sum, c) => sum + c.commissionAmount, 0);
    const approvedAmount = commissions.filter((c) => c.isApproved).reduce((sum, c) => sum + c.commissionAmount, 0);
    return { totalEarned, pendingAmount, approvedAmount };
  }, [commissions]);

  const filteredCommissions = commissions.filter((c) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return !c.isApproved;
    return c.isApproved;
  });

  const handleRequestPayout = async () => {
    const pendingCommissions = commissions.filter((c) => !c.isApproved);
    if (pendingCommissions.length === 0) {
      showAlert({
        type: 'info',
        title: t('agent.noPending', 'No Pending Commissions'),
        message: t('agent.noPendingDesc', 'There are no pending commissions to request payout for.'),
      });
      return;
    }
    try {
      await requestCommissionApproval({ commissionIds: pendingCommissions.map((c) => c.commissionId) }).unwrap();
      showAlert({
        type: 'success',
        title: t('common.success', 'Success'),
        message: t('agent.payoutRequested', 'Payout request submitted successfully.'),
      });
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: t('common.error', 'Error'),
        message: error?.data?.message || t('agent.payoutError', 'Failed to submit payout request.'),
      });
    }
  };

  return (
    <ScreenContainer>
      {/* Summary Card */}
      <AnimatedSection index={0}>
        {isLoading ? (
          <LoadingSkeleton width="100%" height={100} borderRadius={16} style={{ marginTop: 8 }} />
        ) : (
          <ThemedCard variant="elevated" style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons
                  name="wallet"
                  size={20}
                  color={theme.colors.primary}
                />
                <ThemedText variant="numeric" style={styles.summaryValue}>
                  {formatCurrency(totals.totalEarned)}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('agent.totalEarned', 'Total Earned')}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: theme.colors.borderLight },
                ]}
              />
              <View style={styles.summaryItem}>
                <Ionicons
                  name="time"
                  size={20}
                  color={theme.colors.warning}
                />
                <ThemedText variant="numeric" style={styles.summaryValue}>
                  {formatCurrency(totals.pendingAmount)}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('agent.pendingApproval', 'Pending')}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: theme.colors.borderLight },
                ]}
              />
              <View style={styles.summaryItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.success}
                />
                <ThemedText variant="numeric" style={styles.summaryValue}>
                  {formatCurrency(totals.approvedAmount)}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('agent.paidOut', 'Approved')}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>
        )}
      </AnimatedSection>

      {/* Filter Chips */}
      <AnimatedSection index={1}>
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.inputBackground,
                    borderRadius: theme.borderRadius.full,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                  style={{ fontWeight: '600' }}
                >
                  {t(`agent.commissionFilter.${filter.key}`, filter.label)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </AnimatedSection>

      {/* Commission List */}
      <AnimatedSection index={2}>
        <SectionHeader
          title={t('agent.commissionHistory', 'Commission History')}
          style={styles.listHeader}
        />
      </AnimatedSection>

      {isLoading ? (
        <>
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 8 }} />
        </>
      ) : (
        filteredCommissions.map((commission, index) => (
          <AnimatedSection key={commission.commissionId} index={index + 3}>
            <ThemedCard variant="outlined" style={styles.commissionCard}>
              <View style={styles.commissionHeader}>
                <ThemedText variant="bodySmall" style={{ fontWeight: '600', flex: 1 }}>
                  {commission.commissionType}
                </ThemedText>
                <PaymentStatusBadge
                  status={commission.isApproved ? 'Paid' : 'Pending'}
                  size="sm"
                />
              </View>
              <View style={styles.commissionDetails}>
                <View style={styles.commissionDetailRow}>
                  <ThemedText variant="caption" color={theme.colors.textTertiary}>
                    {t('agent.commissionLabel', 'Commission')} ({commission.commissionRate}%)
                  </ThemedText>
                  <ThemedText
                    variant="bodySmall"
                    color={theme.colors.success}
                    style={{ fontWeight: '700' }}
                  >
                    {formatCurrency(commission.commissionAmount)}
                  </ThemedText>
                </View>
                <View style={styles.commissionDetailRow}>
                  <ThemedText variant="caption" color={theme.colors.textTertiary}>
                    {t('agent.transactionId', 'Transaction ID')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    #{commission.fK_PaymentTransactionId}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          </AnimatedSection>
        ))
      )}

      {/* Request Payout */}
      <AnimatedSection index={filteredCommissions.length + 3}>
        <ThemedButton
          title={isSubmitting ? t('common.loading', 'Loading...') : t('agent.requestPayout', 'Request Payout')}
          onPress={handleRequestPayout}
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSubmitting}
          icon={<Ionicons name="cash" size={20} color="#FFFFFF" />}
          style={styles.payoutButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 16,
  },
  summaryDivider: {
    width: 1,
    height: 48,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  listHeader: {
    marginTop: 12,
  },
  commissionCard: {
    marginBottom: 8,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commissionDetails: {
    gap: 6,
  },
  commissionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutButton: {
    marginTop: 16,
  },
});
