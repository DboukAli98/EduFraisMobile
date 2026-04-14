import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
// Helpers
// ---------------------------------------------------------------------------

const getInstallmentStatus = (inst: ParentInstallmentDto): 'Paid' | 'Pending' | 'Overdue' => {
  if (inst.isPaid) return 'Paid';
  if (new Date(inst.dueDate) < new Date()) return 'Overdue';
  return 'Pending';
};

// ---------------------------------------------------------------------------
// DetailRow
// ---------------------------------------------------------------------------

interface DetailRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, valueColor }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.detailRow}>
      <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
        {label}
      </ThemedText>
      <ThemedText variant="body" color={valueColor} style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
};

// ---------------------------------------------------------------------------
// PaymentDetailScreen
// ---------------------------------------------------------------------------

const PaymentDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice } = useResponsive();
  const { installmentId } = useLocalSearchParams<{ installmentId: string }>();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const {
    data: installmentsData,
    isLoading,
  } = useGetParentInstallmentsQuery({ parentId }, { skip: !parentId });

  // Find the specific installment from the cached query data
  const installment = (installmentsData?.data || []).find(
    (i) => String(i.installmentId) === installmentId
  );

  const statusAnim = useAnimatedEntry({ type: 'scaleIn', delay: staggerDelay(0) });
  const amountAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const detailsAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });
  const childAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });
  const actionAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(4) });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={4} />
      </ScreenContainer>
    );
  }

  if (!installment) {
    return (
      <ScreenContainer>
        <View style={styles.statusBanner}>
          <ThemedText variant="body" color={theme.colors.textSecondary}>
            {t('parent.paymentDetail.notFound', 'Payment not found')}
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  const status = getInstallmentStatus(installment);
  const isPaid = status === 'Paid';
  const isOverdue = status === 'Overdue';

  return (
    <ScreenContainer>
      {/* Status Banner */}
      <Animated.View style={[styles.statusBanner, statusAnim]}>
        <PaymentStatusBadge status={status} />
        <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.statusSubtext}>
          {installment.paymentCycleName || t('parent.paymentDetail.installment', 'Installment')}
        </ThemedText>
      </Animated.View>

      {/* Amount Card */}
      <Animated.View style={amountAnim}>
        <ThemedCard variant="elevated" style={styles.amountCard}>
          <ThemedText variant="caption" color={theme.colors.textSecondary} align="center">
            {t('parent.paymentDetail.amount', 'Amount')}
          </ThemedText>
          <ThemedText
            variant="display"
            color={isOverdue ? theme.colors.error : theme.colors.primary}
            align="center"
            style={styles.amountValue}
          >
            {formatCurrency(installment.amount)}
          </ThemedText>
          {installment.lateFee > 0 && (
            <ThemedText variant="bodySmall" color={theme.colors.error} align="center">
              + {formatCurrency(installment.lateFee)} {t('parent.paymentDetail.lateFee', 'late fee')}
            </ThemedText>
          )}
        </ThemedCard>
      </Animated.View>

      {/* Details */}
      <Animated.View style={detailsAnim}>
        <ThemedCard variant="outlined" style={styles.detailsCard}>
          <DetailRow
            label={t('parent.paymentDetail.dueDate', 'Due Date')}
            value={formatDate(installment.dueDate)}
          />
          {installment.paidDate && (
            <DetailRow
              label={t('parent.paymentDetail.paidDate', 'Paid Date')}
              value={formatDate(installment.paidDate)}
              valueColor={theme.colors.success}
            />
          )}
          {installment.lateFee > 0 && (
            <DetailRow
              label={t('parent.paymentDetail.lateFeeLabel', 'Late Fee')}
              value={formatCurrency(installment.lateFee)}
              valueColor={theme.colors.error}
            />
          )}
        </ThemedCard>
      </Animated.View>

      {/* Child & School Info */}
      <Animated.View style={childAnim}>
        <ThemedCard variant="outlined" style={styles.childCard}>
          <View style={styles.childRow}>
            <View
              style={[
                styles.childIcon,
                { backgroundColor: theme.colors.primaryLight + '15', borderRadius: theme.borderRadius.md },
              ]}
            >
              <Ionicons name="school-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.childInfo}>
              <ThemedText variant="subtitle">{installment.childName}</ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {installment.schoolName} - {installment.gradeName}
              </ThemedText>
            </View>
          </View>
        </ThemedCard>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View style={[styles.actions, actionAnim]}>
        {isPaid ? (
          <ThemedButton
            title={t('parent.paymentDetail.downloadReceipt', 'Download Receipt')}
            onPress={() => {}}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Ionicons name="download-outline" size={20} color={theme.colors.primary} />}
          />
        ) : (
          <ThemedButton
            title={t('parent.paymentDetail.payNow', 'Pay Now')}
            onPress={() => {}}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="card-outline" size={20} color="#FFFFFF" />}
          />
        )}
      </Animated.View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  statusBanner: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  statusSubtext: {
    marginTop: 8,
  },

  amountCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 16,
  },
  amountValue: {
    marginTop: 8,
    marginBottom: 4,
  },

  detailsCard: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  detailValue: {
    fontWeight: '600',
  },

  childCard: {
    marginBottom: 24,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  childInfo: {
    flex: 1,
  },

  actions: {
    marginBottom: 16,
  },
});

export default PaymentDetailScreen;
