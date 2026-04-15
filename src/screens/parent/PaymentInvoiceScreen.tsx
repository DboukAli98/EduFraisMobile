import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Share, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetParentInstallmentsQuery,
  useGetSchoolFeesPaymentHistoryQuery,
  useGetMerchandisePaymentHistoryQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';
import type {
  ParentInstallmentDto,
  SchoolFeesPaymentHistoryDto,
  MerchandisePaymentHistoryDto,
} from '../../types';

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
// PaymentInvoiceScreen
// ---------------------------------------------------------------------------

const PaymentInvoiceScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { installmentId, transactionId, type } = useLocalSearchParams<{
    installmentId?: string;
    transactionId?: string;
    type?: string;
  }>();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');
  const userId = user?.userId || '';

  // -------------------------------------------------------------------------
  // Data fetching – leverage cached RTK Query data
  // -------------------------------------------------------------------------

  const { data: installmentsData, isLoading: isLoadingInstallments } =
    useGetParentInstallmentsQuery({ parentId }, { skip: !parentId || !installmentId });

  const { data: schoolFeesHistory, isLoading: isLoadingSchoolFees } =
    useGetSchoolFeesPaymentHistoryQuery(
      { userId, pageNumber: 1, pageSize: 100 },
      { skip: !userId || !transactionId || type === 'merchandise' },
    );

  const { data: merchandiseHistory, isLoading: isLoadingMerchandise } =
    useGetMerchandisePaymentHistoryQuery(
      { userId, pageNumber: 1, pageSize: 100 },
      { skip: !userId || !transactionId || type !== 'merchandise' },
    );

  // -------------------------------------------------------------------------
  // Resolve the data depending on route params
  // -------------------------------------------------------------------------

  const installment: ParentInstallmentDto | undefined = useMemo(() => {
    if (!installmentId) return undefined;
    return (installmentsData?.data || []).find(
      (i) => String(i.installmentId) === installmentId,
    );
  }, [installmentsData, installmentId]);

  const schoolFeesTransaction: SchoolFeesPaymentHistoryDto | undefined = useMemo(() => {
    if (!transactionId || type === 'merchandise') return undefined;
    return (schoolFeesHistory?.data || []).find(
      (tx) => String(tx.paymentTransactionId) === transactionId,
    );
  }, [schoolFeesHistory, transactionId, type]);

  const merchandiseTransaction: MerchandisePaymentHistoryDto | undefined = useMemo(() => {
    if (!transactionId || type !== 'merchandise') return undefined;
    return (merchandiseHistory?.data || []).find(
      (tx) => String(tx.paymentTransactionId) === transactionId,
    );
  }, [merchandiseHistory, transactionId, type]);

  // -------------------------------------------------------------------------
  // Derive display values
  // -------------------------------------------------------------------------

  const isPaid = useMemo(() => {
    if (installment) return installment.isPaid;
    if (schoolFeesTransaction) return schoolFeesTransaction.statusName === 'Paid';
    if (merchandiseTransaction) return merchandiseTransaction.statusName === 'Paid';
    return false;
  }, [installment, schoolFeesTransaction, merchandiseTransaction]);

  const amount = useMemo(() => {
    if (installment) return installment.amount + installment.lateFee;
    if (schoolFeesTransaction) return schoolFeesTransaction.amountPaid;
    if (merchandiseTransaction) return merchandiseTransaction.amountPaid;
    return 0;
  }, [installment, schoolFeesTransaction, merchandiseTransaction]);

  const receiptNumber = useMemo(() => {
    if (schoolFeesTransaction) return schoolFeesTransaction.transactionReference;
    if (merchandiseTransaction) return merchandiseTransaction.transactionReference;
    if (installment) return `INV-${installment.installmentId}`;
    return '---';
  }, [installment, schoolFeesTransaction, merchandiseTransaction]);

  const paidDate = useMemo(() => {
    if (installment?.paidDate) return formatDate(installment.paidDate);
    if (schoolFeesTransaction) return formatDate(schoolFeesTransaction.paidDate);
    if (merchandiseTransaction) return formatDate(merchandiseTransaction.paidDate);
    return formatDate(new Date().toISOString());
  }, [installment, schoolFeesTransaction, merchandiseTransaction]);

  const paymentMethod = useMemo(() => {
    if (schoolFeesTransaction?.paymentMethod) return schoolFeesTransaction.paymentMethod;
    if (merchandiseTransaction?.paymentMethod) return merchandiseTransaction.paymentMethod;
    return 'Airtel Money';
  }, [schoolFeesTransaction, merchandiseTransaction]);

  // -------------------------------------------------------------------------
  // Animations
  // -------------------------------------------------------------------------

  const headerAnim = useAnimatedEntry({ type: 'scaleIn', delay: staggerDelay(0) });
  const statusAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(1) });
  const amountAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });
  const detailsAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });
  const payerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(4) });
  const actionsAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(5) });

  // -------------------------------------------------------------------------
  // Share handler
  // -------------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    const lines: string[] = [
      t('parent.invoice.receiptTitle', 'Payment Receipt'),
      '---',
      `${t('parent.invoice.receiptNumber', 'Receipt #')}: ${receiptNumber}`,
      `${t('parent.invoice.date', 'Date')}: ${paidDate}`,
      `${t('parent.invoice.amount', 'Amount')}: ${formatCurrency(amount)}`,
      `${t('parent.invoice.paymentMethod', 'Payment Method')}: ${paymentMethod}`,
    ];

    if (installment || schoolFeesTransaction) {
      const childName = installment?.childName ?? schoolFeesTransaction?.childName ?? '';
      const schoolName = installment?.schoolName ?? schoolFeesTransaction?.schoolName ?? '';
      const gradeName = installment?.gradeName ?? schoolFeesTransaction?.gradeName ?? '';
      if (childName) lines.push(`${t('parent.invoice.child', 'Child')}: ${childName}`);
      if (schoolName) lines.push(`${t('parent.invoice.school', 'School')}: ${schoolName}`);
      if (gradeName) lines.push(`${t('parent.invoice.grade', 'Grade')}: ${gradeName}`);
      if (installment?.paymentCycleName) {
        lines.push(`${t('parent.invoice.cycle', 'Payment Cycle')}: ${installment.paymentCycleName}`);
      }
    }

    if (merchandiseTransaction) {
      if (merchandiseTransaction.merchandiseName) {
        lines.push(
          `${t('parent.invoice.merchandise', 'Merchandise')}: ${merchandiseTransaction.merchandiseName}`,
        );
      }
      if (merchandiseTransaction.schoolName) {
        lines.push(`${t('parent.invoice.school', 'School')}: ${merchandiseTransaction.schoolName}`);
      }
    }

    lines.push('---');
    lines.push(
      `${t('parent.invoice.payer', 'Payer')}: ${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
    );
    if (user?.phoneNumber) lines.push(`${t('parent.invoice.phone', 'Phone')}: ${user.phoneNumber}`);

    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // User cancelled share dialog – do nothing
    }
  }, [
    receiptNumber,
    paidDate,
    amount,
    paymentMethod,
    installment,
    schoolFeesTransaction,
    merchandiseTransaction,
    user,
    t,
  ]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  const isLoading = isLoadingInstallments || isLoadingSchoolFees || isLoadingMerchandise;

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  const hasData = !!(installment || schoolFeesTransaction || merchandiseTransaction);

  if (!hasData) {
    return (
      <ScreenContainer>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          <ThemedText variant="body" style={styles.backLabel}>
            {t('common.back', 'Back')}
          </ThemedText>
        </TouchableOpacity>
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={48} color={theme.colors.textSecondary} />
          <ThemedText variant="body" color={theme.colors.textSecondary} style={styles.emptyText}>
            {t('parent.invoice.notFound', 'Payment record not found')}
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <ScreenContainer>
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        <ThemedText variant="body" style={styles.backLabel}>
          {t('common.back', 'Back')}
        </ThemedText>
      </TouchableOpacity>

      {/* Invoice Header */}
      <Animated.View style={[styles.invoiceHeader, headerAnim]}>
        <View
          style={[
            styles.receiptIconContainer,
            {
              backgroundColor: isPaid ? theme.colors.success + '15' : theme.colors.textSecondary + '15',
              borderRadius: theme.borderRadius.lg,
            },
          ]}
        >
          <Ionicons
            name={isPaid ? 'checkmark-circle' : 'time-outline'}
            size={56}
            color={isPaid ? theme.colors.success : theme.colors.textSecondary}
          />
        </View>
        <ThemedText variant="title" align="center" style={styles.invoiceTitle}>
          {t('parent.invoice.receiptTitle', 'Payment Receipt')}
        </ThemedText>
      </Animated.View>

      {/* Status Badge */}
      <Animated.View style={[styles.statusContainer, statusAnim]}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isPaid ? theme.colors.success + '15' : theme.colors.textSecondary + '15',
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <ThemedText
            variant="bodySmall"
            color={isPaid ? theme.colors.success : theme.colors.textSecondary}
            style={styles.statusText}
          >
            {isPaid
              ? t('parent.invoice.paid', 'PAID')
              : t('parent.invoice.pending', 'PENDING')}
          </ThemedText>
        </View>
      </Animated.View>

      {/* Amount */}
      <Animated.View style={[styles.amountSection, amountAnim]}>
        <ThemedText variant="caption" color={theme.colors.textSecondary} align="center">
          {t('parent.invoice.totalAmount', 'Total Amount')}
        </ThemedText>
        <ThemedText
          variant="display"
          color={theme.colors.primary}
          align="center"
          style={styles.amountValue}
        >
          {formatCurrency(amount)}
        </ThemedText>
      </Animated.View>

      {/* Invoice Details Card */}
      <Animated.View style={detailsAnim}>
        <ThemedCard variant="outlined" style={styles.detailsCard}>
          <ThemedText variant="subtitle" style={styles.cardTitle}>
            {t('parent.invoice.details', 'Invoice Details')}
          </ThemedText>

          <DetailRow
            label={t('parent.invoice.receiptNumber', 'Receipt #')}
            value={receiptNumber}
          />
          <DetailRow
            label={t('parent.invoice.date', 'Date')}
            value={paidDate}
          />
          <DetailRow
            label={t('parent.invoice.paymentMethod', 'Payment Method')}
            value={paymentMethod}
          />

          {/* School fees details */}
          {(installment || schoolFeesTransaction) && (
            <>
              {(installment?.childName || schoolFeesTransaction?.childName) && (
                <DetailRow
                  label={t('parent.invoice.child', 'Child')}
                  value={installment?.childName ?? schoolFeesTransaction?.childName ?? ''}
                />
              )}
              {(installment?.schoolName || schoolFeesTransaction?.schoolName) && (
                <DetailRow
                  label={t('parent.invoice.school', 'School')}
                  value={installment?.schoolName ?? schoolFeesTransaction?.schoolName ?? ''}
                />
              )}
              {(installment?.gradeName || schoolFeesTransaction?.gradeName) && (
                <DetailRow
                  label={t('parent.invoice.grade', 'Grade')}
                  value={installment?.gradeName ?? schoolFeesTransaction?.gradeName ?? ''}
                />
              )}
              {installment?.paymentCycleName && (
                <DetailRow
                  label={t('parent.invoice.cycle', 'Payment Cycle')}
                  value={installment.paymentCycleName}
                />
              )}
            </>
          )}

          {/* Merchandise details */}
          {merchandiseTransaction && (
            <>
              {merchandiseTransaction.merchandiseName && (
                <DetailRow
                  label={t('parent.invoice.merchandise', 'Merchandise')}
                  value={merchandiseTransaction.merchandiseName}
                />
              )}
              {merchandiseTransaction.schoolName && (
                <DetailRow
                  label={t('parent.invoice.school', 'School')}
                  value={merchandiseTransaction.schoolName}
                />
              )}
            </>
          )}
        </ThemedCard>
      </Animated.View>

      {/* Payer Info Card */}
      <Animated.View style={payerAnim}>
        <ThemedCard variant="outlined" style={styles.payerCard}>
          <ThemedText variant="subtitle" style={styles.cardTitle}>
            {t('parent.invoice.payerInfo', 'Payer Information')}
          </ThemedText>
          <DetailRow
            label={t('parent.invoice.name', 'Name')}
            value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '---'}
          />
          {user?.phoneNumber ? (
            <DetailRow
              label={t('parent.invoice.phone', 'Phone')}
              value={user.phoneNumber}
            />
          ) : null}
          {user?.email ? (
            <DetailRow
              label={t('parent.invoice.email', 'Email')}
              value={user.email}
            />
          ) : null}
        </ThemedCard>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View style={[styles.actions, actionsAnim]}>
        <ThemedButton
          title={t('parent.invoice.share', 'Share Receipt')}
          onPress={handleShare}
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Ionicons name="share-social-outline" size={20} color={theme.colors.primary} />}
        />

        <View style={styles.buttonSpacer} />

        <ThemedButton
          title={t('parent.invoice.backToPayments', 'Back to Payments')}
          onPress={() => router.push('/payments')}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="arrow-back-outline" size={20} color="#FFFFFF" />}
        />
      </Animated.View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  backLabel: {
    marginLeft: 8,
  },

  invoiceHeader: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  receiptIconContainer: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  invoiceTitle: {
    marginBottom: 4,
  },

  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusText: {
    fontWeight: '700',
    letterSpacing: 1,
  },

  amountSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amountValue: {
    marginTop: 4,
  },

  detailsCard: {
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 12,
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
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },

  payerCard: {
    marginBottom: 24,
  },

  actions: {
    marginBottom: 32,
  },
  buttonSpacer: {
    height: 12,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 12,
  },
});

export default PaymentInvoiceScreen;
