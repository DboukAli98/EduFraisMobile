import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  SectionHeader,
  PaymentStatusBadge,
  Avatar,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useResponsive, useAppSelector } from '../../hooks';
import {
  useGetParentInstallmentsQuery,
  useGetParentMonthPaymentFeeQuery,
  useGetRecentPaymentTransactionsQuery,
  useGetMyLoyaltyQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';
import type { ParentInstallmentDto, RecentPaymentTransactionDto } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInstallmentStatus = (inst: ParentInstallmentDto): 'Paid' | 'Pending' | 'Overdue' => {
  if (inst.isPaid) return 'Paid';
  if (new Date(inst.dueDate) < new Date()) return 'Overdue';
  return 'Pending';
};

// ---------------------------------------------------------------------------
// QuickAction
// ---------------------------------------------------------------------------

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  index: number;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onPress, index }) => {
  const { theme } = useTheme();
  const anim = useAnimatedEntry({ type: 'scaleIn', delay: staggerDelay(index + 3) });

  return (
    <Animated.View style={[anim, styles.qaWrapper]}>
      <Pressable onPress={onPress} style={styles.qaPressable}>
        <View
          style={[
            styles.qaCircle,
            { backgroundColor: color + '15', borderRadius: theme.borderRadius.full },
          ]}
        >
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <ThemedText variant="caption" align="center" style={styles.qaLabel}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// ParentDashboard
// ---------------------------------------------------------------------------

const ParentDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice } = useResponsive();

  // Auth / user info
  const user = useAppSelector((state) => state.auth.user);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const parentId = parseInt(user?.entityUserId || '0');
  const nameParts = (user?.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // API queries
  const {
    data: installmentsData,
    isLoading: installmentsLoading,
  } = useGetParentInstallmentsQuery({ parentId }, { skip: !parentId });
  const {
    data: monthFeeData,
    isLoading: monthFeeLoading,
  } = useGetParentMonthPaymentFeeQuery({ parentId }, { skip: !parentId });
  const {
    data: recentTxData,
    isLoading: recentTxLoading,
  } = useGetRecentPaymentTransactionsQuery({ parentId, topCount: 3 }, { skip: !parentId });

  // Loyalty membership lookup. Eager fetch so the welcome bonus fires
  // on first dashboard view (the backend auto-enrolls inside /me when
  // an enabled program exists for the parent's school). We only render
  // the points tile when a real membership exists.
  const { data: loyaltyResp } = useGetMyLoyaltyQuery();
  const primaryLoyalty = loyaltyResp?.data?.[0];

  const isLoading = installmentsLoading || monthFeeLoading || recentTxLoading;

  // Derive balance, upcoming dues, and recent payments from installments
  const installments = installmentsData?.data || [];

  const balance = useMemo(() => {
    const total = installments.reduce((sum, i) => sum + i.amount + (i.lateFee || 0), 0);
    // Include lateFee in paid too so the ratio can reach exactly 1 when
    // every installment (including its late fee) is settled — otherwise
    // the progress bar would sit just shy of full even when nothing is owed.
    const paid = installments
      .filter((i) => i.isPaid)
      .reduce((sum, i) => sum + i.amount + (i.lateFee || 0), 0);
    const pending = Math.max(0, total - paid);
    return { total, paid, pending };
  }, [installments]);

  const upcomingDues = useMemo(() => {
    return installments
      .filter((i) => !i.isPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3)
      .map((i) => ({
        id: String(i.installmentId),
        childName: i.childName,
        school: i.schoolName,
        amount: i.amount,
        dueDate: i.dueDate,
        status: getInstallmentStatus(i),
      }));
  }, [installments]);

  // Map the backend's numeric status id (or legacy statusName) to the
  // canonical union the PaymentStatusBadge understands. Default to
  // 'Pending' — we never want to crash the badge by passing undefined.
  const mapTxStatus = (
    tx: RecentPaymentTransactionDto,
  ): 'Paid' | 'Pending' | 'InProgress' | 'Failed' | 'Cancelled' => {
    if (tx.fK_StatusId === 8 || tx.statusName === 'Processed' || tx.statusName === 'Paid') {
      return 'Paid';
    }
    if (tx.fK_StatusId === 10 || tx.statusName === 'Failed') return 'Failed';
    if (tx.fK_StatusId === 9 || tx.statusName === 'Cancelled') return 'Cancelled';
    if (tx.fK_StatusId === 11 || tx.statusName === 'InProgress') return 'InProgress';
    return 'Pending';
  };

  const recentPayments = useMemo(() => {
    const txList = recentTxData?.data || [];
    return txList.map((tx: RecentPaymentTransactionDto) => ({
      id: String(tx.paymentTransactionId),
      amount: tx.amountPaid,
      date: tx.paidDate,
      status: mapTxStatus(tx),
      childName:
        tx.childFullName ||
        [tx.childFirstName, tx.childLastName].filter(Boolean).join(' ') ||
        tx.childName,
      paymentType: tx.paymentType,
    }));
  }, [recentTxData]);

  // Fully paid = full bar. Also handle the "no installments yet" case by
  // showing an empty bar rather than NaN. Clamp to [0, 1] defensively.
  const allPaid =
    installments.length > 0 && installments.every((i) => i.isPaid);
  const paidRatio = allPaid
    ? 1
    : balance.total > 0
      ? Math.min(1, Math.max(0, balance.paid / balance.total))
      : 0;

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const balanceAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const qaAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(2) });
  const upcomingAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(4) });
  const recentAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(6) });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Welcome Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <View style={styles.headerLeft}>
          <Avatar firstName={firstName} lastName={lastName} size="lg" />
          <View style={styles.headerTextWrap}>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('parent.dashboard.welcomeBack', 'Welcome back,')}
            </ThemedText>
            <ThemedText variant="h2">
              {firstName} {lastName}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          style={[
            styles.bellBtn,
            { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full },
          ]}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.notificationDot,
                { backgroundColor: theme.colors.error, borderColor: theme.colors.surface },
              ]}
            />
          ) : null}
        </Pressable>
      </Animated.View>

      {/* Balance Card */}
      <Animated.View style={balanceAnim}>
        <LinearGradient
          colors={theme.colors.gradient.primary as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, { borderRadius: theme.borderRadius.xl }]}
        >
          <ThemedText variant="caption" color="rgba(255,255,255,0.75)">
            {t('parent.dashboard.totalBalance', 'Total Balance')}
          </ThemedText>
          <ThemedText variant="display" color="#FFFFFF" style={styles.balanceAmt}>
            {formatCurrency(balance.total)}
          </ThemedText>

          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.8)" />
              <ThemedText variant="bodySmall" color="rgba(255,255,255,0.85)" style={styles.balanceStatTxt}>
                {t('parent.dashboard.paid', 'Paid')}: {formatCurrency(balance.paid)}
              </ThemedText>
            </View>
            <View style={styles.balanceStat}>
              <Ionicons name="time" size={14} color="rgba(255,255,255,0.8)" />
              <ThemedText variant="bodySmall" color="rgba(255,255,255,0.85)" style={styles.balanceStatTxt}>
                {t('parent.dashboard.pending', 'Pending')}: {formatCurrency(balance.pending)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${paidRatio * 100}%` }]} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View style={[styles.qaRow, qaAnim]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.qaScrollContent}
        >
          <QuickAction icon="wallet-outline" label={t('parent.dashboard.payNow', 'Pay Now')} color={theme.colors.primary} onPress={() => router.push('/(app)/payments')} index={0} />
          <QuickAction icon="time-outline" label={t('parent.dashboard.history', 'History')} color={theme.colors.secondary} onPress={() => router.push('/(app)/payment-history')} index={1} />
          <QuickAction icon="person-add-outline" label={t('parent.dashboard.myAgents', 'My Agents')} color="#8B5CF6" onPress={() => router.push('/(app)/my-agents')} index={2} />
          <QuickAction icon="help-circle-outline" label={t('parent.dashboard.support', 'Support')} color={theme.colors.accent} onPress={() => router.push('/(app)/support')} index={3} />
          {primaryLoyalty ? (
            <QuickAction
              icon="star-outline"
              // Show "350 Points" so the parent sees their balance at a
              // glance — no need to tap through to learn the number.
              label={`${primaryLoyalty.member.currentPointsBalance} ${primaryLoyalty.program.pointsLabel || t('loyalty.title', 'Points')}`}
              color="#F59E0B"
              onPress={() => router.push('/(app)/loyalty')}
              index={4}
            />
          ) : null}
        </ScrollView>
      </Animated.View>

      {/* Upcoming Dues */}
      <Animated.View style={upcomingAnim}>
        <SectionHeader
          title={t('parent.dashboard.upcomingDues', 'Upcoming Dues')}
          action={t('common.seeAll', 'See All')}
          onAction={() => router.push('/(app)/payments')}
        />
        {upcomingDues.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.dueCard}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t(
                'parent.dashboard.noUpcomingDues',
                'Aucune échéance à venir. Tout est à jour !',
              )}
            </ThemedText>
          </ThemedCard>
        ) : (
          upcomingDues.map((due) => (
            <ThemedCard
              key={due.id}
              variant="elevated"
              onPress={() => router.push({ pathname: '/(app)/payment-detail', params: { installmentId: due.id } })}
              style={styles.dueCard}
            >
              <View style={styles.dueHeader}>
                <View style={styles.dueFlex}>
                  <ThemedText variant="subtitle">{due.childName}</ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    {due.school}
                  </ThemedText>
                </View>
                <PaymentStatusBadge status={due.status} size="sm" />
              </View>
              <View style={styles.dueFooter}>
                <ThemedText variant="numeric" color={due.status === 'Overdue' ? theme.colors.error : theme.colors.primary}>
                  {formatCurrency(due.amount)}
                </ThemedText>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.colors.textTertiary} />
                  <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.dateTxt}>
                    {formatDate(due.dueDate)}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          ))
        )}
      </Animated.View>

      {/* Recent Payments */}
      <Animated.View style={recentAnim}>
        <SectionHeader
          title={t('parent.dashboard.recentPayments', 'Recent Payments')}
          style={styles.recentSec}
        />
        {recentPayments.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.payItem}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t(
                'parent.dashboard.noRecentPayments',
                'No recent payments. Your successful payments will appear here.',
              )}
            </ThemedText>
          </ThemedCard>
        ) : (
          recentPayments.map((p) => (
            <ThemedCard key={p.id} variant="outlined" style={styles.payItem}>
              <View style={styles.payRow}>
                <View
                  style={[
                    styles.payIcon,
                    {
                      backgroundColor: theme.colors.successLight,
                      borderRadius: theme.borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                </View>
                <View style={styles.payContent}>
                  <ThemedText variant="body">{formatCurrency(p.amount)}</ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    {formatDate(p.date)}
                  </ThemedText>
                  {p.childName ? (
                    <ThemedText variant="caption" color={theme.colors.textTertiary}>
                      {p.childName}
                    </ThemedText>
                  ) : null}
                </View>
                <PaymentStatusBadge status={p.status} size="sm" />
              </View>
            </ThemedCard>
          ))
        )}
      </Animated.View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTextWrap: { marginLeft: 12 },
  bellBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  badge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', lineHeight: 14 },

  balanceCard: { padding: 24, marginBottom: 24 },
  balanceAmt: { marginTop: 8, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  balanceStat: { flexDirection: 'row', alignItems: 'center' },
  balanceStatTxt: { marginLeft: 6 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#FFFFFF', borderRadius: 3 },

  qaRow: { marginBottom: 32 },
  qaScrollContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, paddingHorizontal: 4, paddingVertical: 2 },
  qaWrapper: { alignItems: 'center', width: 82 },
  qaPressable: { alignItems: 'center' },
  qaCircle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qaLabel: { marginTop: 4 },

  dueCard: { marginBottom: 12 },
  dueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  dueFlex: { flex: 1 },
  dueFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateTxt: { marginLeft: 4 },

  recentSec: { marginTop: 16 },
  payItem: { marginBottom: 8 },
  payRow: { flexDirection: 'row', alignItems: 'center' },
  payIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  payContent: { flex: 1 },
});

export default ParentDashboard;
