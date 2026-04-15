import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
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
import {
  useGetParentInstallmentsQuery,
  useInitiatePaymentMutation,
  useLazyCheckPaymentStatusQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';
import { API_BASE_URL, COUNTRY_CODE } from '../../constants';
import type { ParentInstallmentDto } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInstallmentStatus = (inst: ParentInstallmentDto): 'Paid' | 'Pending' | 'Overdue' => {
  if (inst.isPaid) return 'Paid';
  if (new Date(inst.dueDate) < new Date()) return 'Overdue';
  return 'Pending';
};

/**
 * Normalize a phone number to Airtel Money MSISDN format.
 * Airtel expects the full international number **without** the leading "+",
 * e.g. 242801234567 for Congo Brazzaville.
 *
 * Accepts any of:
 *   "+242 80 123 45 67", "00242801234567", "242801234567",
 *   "0801234567", "801234567"
 * and returns "242801234567".
 */
const normalizePhone = (phone: string): string => {
  let digits = (phone || '').replace(/\D/g, '');

  // Strip "00" international prefix
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // If it already starts with the country code, keep as-is
  if (digits.startsWith(COUNTRY_CODE)) {
    return digits;
  }

  // Otherwise strip leading zeros and prepend the country code
  digits = digits.replace(/^0+/, '');
  return `${COUNTRY_CODE}${digits}`;
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

  const [initiatePayment, { isLoading: isInitiating }] = useInitiatePaymentMutation();
  const [checkStatus] = useLazyCheckPaymentStatusQuery();

  const [paymentInitiated, setPaymentInitiated] = useState(false);

  // Find the specific installment from the cached query data
  const installment = (installmentsData?.data || []).find(
    (i) => String(i.installmentId) === installmentId
  );

  const statusAnim = useAnimatedEntry({ type: 'scaleIn', delay: staggerDelay(0) });
  const amountAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const detailsAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });
  const childAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });
  const actionAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(4) });

  // -------------------------------------------------------------------------
  // Pay Now handler
  // -------------------------------------------------------------------------
  const handlePayNow = useCallback(() => {
    if (!installment || !user) return;

    const totalAmount = installment.amount + installment.lateFee;

    Alert.alert(
      t('parent.paymentDetail.confirmPayment', 'Confirm Payment'),
      t(
        'parent.paymentDetail.confirmPaymentMessage',
        'You are about to pay {{amount}} via Airtel Money. A prompt will be sent to your phone to confirm.',
        { amount: formatCurrency(totalAmount) }
      ),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('parent.paymentDetail.confirm', 'Confirm'),
          onPress: async () => {
            try {
              const reference = `SF-${Date.now()}-${installment.installmentId}`;
              const rawPhone = user.phoneNumber || '';
              const subscriberMsisdn = normalizePhone(rawPhone);

              console.log('[Payment] Phone check:', {
                rawPhoneFromProfile: rawPhone,
                normalizedMsisdn: subscriberMsisdn,
                normalizedLength: subscriberMsisdn.length,
                countryCode: COUNTRY_CODE,
              });

              // Airtel MSISDN = COUNTRY_CODE + national digits.
              // Congo Brazzaville locals can be 8 or 9 digits, so accept
              // anything >= COUNTRY_CODE.length + 8 (= 11) and <= +13.
              const minLength = COUNTRY_CODE.length + 8;
              const maxLength = COUNTRY_CODE.length + 10;

              if (
                !subscriberMsisdn ||
                subscriberMsisdn.length < minLength ||
                subscriberMsisdn.length > maxLength
              ) {
                console.log(
                  `[Payment] ✖ Phone validation failed. Got "${subscriberMsisdn}" (${subscriberMsisdn.length} digits), expected ${minLength}-${maxLength} digits.`
                );
                Alert.alert(
                  t('parent.paymentDetail.paymentFailed', 'Payment Failed'),
                  `${t(
                    'parent.paymentDetail.invalidPhone',
                    'Your phone number is invalid. Please update it in Settings before paying.'
                  )}\n\n(got "${subscriberMsisdn || '(empty)'}", ${subscriberMsisdn.length} digits)`
                );
                return;
              }

              // JWT-decoded user uses `id`, not `userId` — fall back defensively.
              const resolvedUserId = (user as any).id || (user as any).userId || '';

              if (!resolvedUserId) {
                Alert.alert(
                  t('parent.paymentDetail.paymentFailed', 'Payment Failed'),
                  t(
                    'parent.paymentDetail.missingUserId',
                    'Your session is missing a user ID. Please log out and sign in again.'
                  )
                );
                return;
              }

              const payload = {
                reference,
                subscriberMsisdn,
                amount: Math.round(totalAmount), // backend expects integer (long)
                callbackUrl: `${API_BASE_URL}/payments/callback`,
                installmentId: installment.installmentId,
                paymentType: 'SCHOOLFEE',
                userId: resolvedUserId,
              };

              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('[Payment] ▶ Initiating payment');
              console.log('[Payment] Endpoint:', `${API_BASE_URL}/payments/collect`);
              console.log('[Payment] Payload:', JSON.stringify(payload, null, 2));
              console.log('[Payment] User:', {
                id: (user as any).id,
                phoneNumber: user.phoneNumber,
                entityUserId: user.entityUserId,
              });
              console.log('[Payment] Installment:', {
                installmentId: installment.installmentId,
                amount: installment.amount,
                lateFee: installment.lateFee,
                total: totalAmount,
              });
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

              const result = await initiatePayment(payload).unwrap();

              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('[Payment] ✓ Success response:', JSON.stringify(result, null, 2));
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

              setPaymentInitiated(true);

              Alert.alert(
                t('parent.paymentDetail.paymentInitiated', 'Payment Initiated'),
                t(
                  'parent.paymentDetail.paymentInitiatedMessage',
                  'Payment initiated! Check your phone to confirm via Airtel Money.'
                )
              );
            } catch (error: any) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              console.log('[Payment] ✖ FAILED');
              console.log('[Payment] HTTP status:', error?.status);
              console.log('[Payment] Response body:', JSON.stringify(error?.data, null, 2));
              console.log('[Payment] RTK error field:', error?.error);
              console.log('[Payment] JS message:', error?.message);
              console.log('[Payment] Full error object:', JSON.stringify(error, null, 2));
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

              // Backend sets response.Error (serialized as 'error' camelCase)
              // Also check common error shapes from RTK Query / network errors
              const errorMessage =
                error?.data?.error ||
                error?.data?.message ||
                error?.data?.Error ||
                error?.error ||
                error?.message ||
                (error?.status === 'FETCH_ERROR'
                  ? t(
                      'parent.paymentDetail.networkError',
                      'Network error. Check your connection and ensure the server is reachable.'
                    )
                  : t(
                      'parent.paymentDetail.paymentError',
                      'Failed to initiate payment. Please try again.'
                    ));

              Alert.alert(
                t('parent.paymentDetail.paymentFailed', 'Payment Failed'),
                `${errorMessage}\n\n(status ${error?.status ?? 'unknown'})`
              );
            }
          },
        },
      ]
    );
  }, [installment, user, initiatePayment, t]);

  // -------------------------------------------------------------------------
  // Download Receipt handler
  // -------------------------------------------------------------------------
  const handleDownloadReceipt = useCallback(() => {
    if (!installment) return;
    router.push({
      pathname: '/payment-invoice',
      params: {
        installmentId: String(installment.installmentId),
        type: 'schoolfee',
      },
    });
  }, [installment, router]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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
            onPress={handleDownloadReceipt}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Ionicons name="download-outline" size={20} color={theme.colors.primary} />}
          />
        ) : (
          <ThemedButton
            title={
              paymentInitiated
                ? t('parent.paymentDetail.paymentPending', 'Payment Pending...')
                : t('parent.paymentDetail.payNow', 'Pay Now')
            }
            onPress={handlePayNow}
            variant="primary"
            size="lg"
            fullWidth
            loading={isInitiating}
            disabled={paymentInitiated}
            icon={
              !isInitiating ? (
                <Ionicons
                  name={paymentInitiated ? 'time-outline' : 'card-outline'}
                  size={20}
                  color="#FFFFFF"
                />
              ) : undefined
            }
          />
        )}
      </Animated.View>

      {/* View History Link */}
      <TouchableOpacity
        onPress={() => router.push('/payment-history')}
        style={styles.historyLink}
      >
        <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
        <ThemedText variant="body" color={theme.colors.primary} style={styles.historyLinkText}>
          {t('parent.paymentDetail.viewHistory', 'View Payment History')}
        </ThemedText>
      </TouchableOpacity>
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

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  historyLinkText: {
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default PaymentDetailScreen;
