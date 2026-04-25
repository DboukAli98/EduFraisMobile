import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
  Avatar,
  SectionHeader,
  LoadingSkeleton,
} from '../../components';
import {
  useGetMyCommissionsQuery,
  useGetMyActivitiesQuery,
  useGetMyLoyaltyQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDateTimeCongo } from '../../utils';
import { PointsBadge } from '../../components/loyalty';

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

export default function AgentDashboard() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const agentId = parseInt(user?.entityUserId || '0');

  const { data: commissionsData, isLoading: loadingCommissions } = useGetMyCommissionsQuery({ pageNumber: 1, pageSize: 50 });
  const { data: activitiesData, isLoading: loadingActivities } = useGetMyActivitiesQuery({ pageNumber: 1, pageSize: 20 });
  // Eager fetch — first call also auto-enrolls the agent and fires
  // the welcome bonus, so the home screen reflects it immediately.
  const { data: loyaltyResp } = useGetMyLoyaltyQuery();
  const loyaltySummary = loyaltyResp?.data?.[0];

  const commissions = commissionsData?.data ?? [];
  const activities = Array.isArray(activitiesData?.data) ? activitiesData.data : [];

  // Calculate commission totals from real data
  const commissionTotals = useMemo(() => {
    const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const pendingAmount = commissions.filter((c) => !c.isApproved).reduce((sum, c) => sum + c.commissionAmount, 0);
    const approvedCount = commissions.filter((c) => c.isApproved).length;
    return { totalEarned, pendingAmount, count: commissions.length, approvedCount };
  }, [commissions]);

  const isLoading = loadingCommissions || loadingActivities;

  // Extract user name parts
  const nameParts = (user?.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <ScreenContainer>
      {/* Welcome */}
      <AnimatedSection index={0}>
        <View style={styles.welcomeRow}>
          <View>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('common.welcome', 'Welcome back')}
            </ThemedText>
            <ThemedText variant="h2">
              {user?.name || ''}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/(app)/notifications')}
              style={[
                styles.headerAction,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.full,
                },
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
            <Avatar
              firstName={firstName}
              lastName={lastName}
              size="lg"
            />
          </View>
        </View>
      </AnimatedSection>

      {/* Today Summary - Gradient Card */}
      <AnimatedSection index={1}>
        {isLoading ? (
          <LoadingSkeleton width="100%" height={120} borderRadius={20} />
        ) : (
          <LinearGradient
            colors={theme.colors.gradient.primary as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryGradient}
          >
            <ThemedText variant="bodySmall" color="#FFFFFF" style={{ opacity: 0.85 }}>
              {t('agent.todaySummary', 'Commission Summary')}
            </ThemedText>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatItem}>
                <ThemedText variant="numeric" color="#FFFFFF" style={{ fontSize: 24 }}>
                  {commissionTotals.count}
                </ThemedText>
                <ThemedText variant="caption" color="#FFFFFF" style={{ opacity: 0.8 }}>
                  {t('agent.collections', 'Total')}
                </ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <ThemedText variant="numeric" color="#FFFFFF" style={{ fontSize: 20 }}>
                  {formatCurrency(commissionTotals.totalEarned)}
                </ThemedText>
                <ThemedText variant="caption" color="#FFFFFF" style={{ opacity: 0.8 }}>
                  {t('agent.collected', 'Earned')}
                </ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <ThemedText variant="numeric" color="#FFFFFF" style={{ fontSize: 20 }}>
                  {formatCurrency(commissionTotals.pendingAmount)}
                </ThemedText>
                <ThemedText variant="caption" color="#FFFFFF" style={{ opacity: 0.8 }}>
                  {t('agent.pending', 'Pending')}
                </ThemedText>
              </View>
            </View>
          </LinearGradient>
        )}
      </AnimatedSection>

      {/* Commission Stats */}
      <AnimatedSection index={2}>
        <SectionHeader
          title={t('agent.myPortfolio', 'My Portfolio')}
          style={styles.sectionSpacing}
        />
        {isLoading ? (
          <View style={styles.portfolioRow}>
            <LoadingSkeleton width={100} height={80} borderRadius={12} />
            <LoadingSkeleton width={100} height={80} borderRadius={12} />
            <LoadingSkeleton width={100} height={80} borderRadius={12} />
          </View>
        ) : (
          <View style={styles.portfolioRow}>
            <ThemedCard variant="outlined" style={styles.portfolioStat}>
              <Ionicons name="wallet" size={20} color={theme.colors.primary} />
              <ThemedText variant="numeric" style={styles.portfolioValue}>
                {commissionTotals.count}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('agent.commissions', 'Commissions')}
              </ThemedText>
            </ThemedCard>
            <ThemedCard variant="outlined" style={styles.portfolioStat}>
              <Ionicons name="time" size={20} color={theme.colors.warning} />
              <ThemedText variant="numeric" style={styles.portfolioValue}>
                {commissionTotals.count - commissionTotals.approvedCount}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('agent.pending', 'Pending')}
              </ThemedText>
            </ThemedCard>
            <ThemedCard variant="outlined" style={styles.portfolioStat}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <ThemedText variant="numeric" style={styles.portfolioValue}>
                {commissionTotals.approvedCount}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('agent.approved', 'Approved')}
              </ThemedText>
            </ThemedCard>
          </View>
        )}
      </AnimatedSection>

      {/* Loyalty quick entry — only when the agent is enrolled in
          their school's program. Commission earnings (real money) live
          on /commissions, points are non-cashable perks — labeling the
          tile "Points" keeps the two streams visually separate. */}
      {loyaltySummary ? (
        <AnimatedSection index={3}>
          <Pressable
            onPress={() => router.push('/(app)/loyalty')}
            style={[
              styles.loyaltyTile,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.lg,
                ...theme.shadows.sm,
              },
            ]}
          >
            <View style={[styles.loyaltyIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="star" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.loyaltyText}>
              <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                {t('loyalty.title', 'Loyalty program')}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                {loyaltySummary.program.programName}
              </ThemedText>
            </View>
            <PointsBadge
              points={loyaltySummary.member.currentPointsBalance}
              pointsLabel={loyaltySummary.program.pointsLabel}
              size="sm"
              tone="filled"
            />
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        </AnimatedSection>
      ) : null}

      {/* Recent Commissions */}
      <AnimatedSection index={3}>
        <SectionHeader
          title={t('agent.recentCommissions', 'Recent Commissions')}
          action={t('common.viewAll', 'View All')}
          onAction={() => router.push('/(app)/commissions')}
          style={styles.sectionSpacing}
        />
        {loadingCommissions ? (
          <>
            <LoadingSkeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 8 }} />
            <LoadingSkeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 8 }} />
          </>
        ) : (
          commissions.slice(0, 3).map((item) => (
            <ThemedCard key={item.commissionId} variant="elevated" style={styles.upcomingCard}>
              <View style={styles.upcomingRow}>
                <View style={styles.upcomingInfo}>
                  <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                    {formatCurrency(item.commissionAmount)}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    {item.commissionType} - {item.commissionRate}%
                  </ThemedText>
                </View>
                <ThemedText
                  variant="caption"
                  color={item.isApproved ? theme.colors.success : theme.colors.warning}
                  style={{ fontWeight: '600' }}
                >
                  {item.isApproved ? t('agent.approved', 'Approved') : t('agent.pending', 'Pending')}
                </ThemedText>
              </View>
            </ThemedCard>
          ))
        )}
      </AnimatedSection>

      {/* Recent Activity */}
      <AnimatedSection index={4}>
        <SectionHeader
          title={t('agent.recentActivity', 'Recent Activity')}
          action={t('common.viewAll', 'View All')}
          onAction={() => router.push('/(app)/my-activities')}
          style={styles.sectionSpacing}
        />
        <ThemedButton
          title={t('agent.activities.logNew', 'Log New Activity')}
          variant="secondary"
          onPress={() => router.push('/(app)/log-activity')}
          style={styles.logActivityBtn}
        />
        {loadingActivities ? (
          <>
            <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
            <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
          </>
        ) : activities.length > 0 ? (
          activities.slice(0, 5).map((item: any, idx: number) => (
            <ThemedCard key={item.activityId ?? idx} variant="outlined" style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View style={[styles.activityIconWrap, { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.md }]}>
                  <Ionicons name="pulse-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityTopRow}>
                    <View style={[styles.activityTypeBadge, { backgroundColor: theme.colors.primary + '18', borderRadius: theme.borderRadius.sm }]}>
                      <ThemedText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700', fontSize: 10 }}>
                        {item.activityTypeDisplayName || ''}
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.activityTime}>
                      {item.activityDate || item.createdOn
                        ? formatDateTimeCongo(item.activityDate || item.createdOn)
                        : ''}
                    </ThemedText>
                  </View>
                  <ThemedText variant="bodySmall" style={{ fontWeight: '600', marginTop: 4 }}>
                    {item.activityDescription || ''}
                  </ThemedText>
                  {item.parentName ? (
                    <View style={styles.activityParentRow}>
                      <Ionicons name="person-outline" size={12} color={theme.colors.textTertiary} />
                      <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginLeft: 4 }}>
                        {item.parentName}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </ThemedCard>
          ))
        ) : (
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            {t('agent.noActivity', 'No recent activity')}
          </ThemedText>
        )}
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  summaryGradient: {
    borderRadius: 20,
    padding: 20,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  sectionSpacing: {
    marginTop: 24,
  },
  loyaltyTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginTop: 16,
  },
  loyaltyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyText: {
    flex: 1,
    minWidth: 0,
  },
  portfolioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  portfolioStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  portfolioValue: {
    marginTop: 8,
    marginBottom: 2,
  },
  upcomingCard: {
    marginBottom: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  activityCard: {
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activityTime: {
    flexShrink: 1,
    textAlign: 'right',
  },
  activityParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  logActivityBtn: {
    marginBottom: 12,
  },
});
